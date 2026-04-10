from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

import numpy as np
import torch

try:
    from .sequence_kt_models import build_sequence_model
except ImportError:
    from sequence_kt_models import build_sequence_model


class SequenceKTInference:
    def __init__(self, artifact_path: str, device: str = "cpu"):
        self.device = torch.device(device)
        bundle = torch.load(artifact_path, map_location=self.device, weights_only=False)

        self.model_name = bundle["model_name"]
        self.vocab = bundle["vocab"]
        self.config = bundle["config"]
        self.include_behavior = bool(bundle.get("include_behavior", True))

        topic_vocab_size = int(self.vocab["topic_size"])
        max_seq_len = int(self.config["max_seq_len"])
        self.model = build_sequence_model(self.model_name, topic_vocab_size, max_seq_len)
        self.model.load_state_dict(bundle["state_dict"])
        self.model.to(self.device)
        self.model.eval()

    def _encode_topic(self, topic_id: str) -> int:
        return int(self.vocab["topic2idx"].get(topic_id, 1))

    def _encode_difficulty(self, difficulty: str) -> float:
        diff_map = self.vocab["difficulty2idx"]
        value = diff_map.get(str(difficulty or "unknown"), diff_map.get("unknown", 0))
        return float(value) / max(1, len(diff_map) - 1)

    def _encode_source(self, source_type: str) -> float:
        src_map = self.vocab["source2idx"]
        value = src_map.get(str(source_type or "quiz"), src_map.get("quiz", 0))
        return float(value) / max(1, len(src_map) - 1)

    def predict_next_correct(self, history_events: List[Dict]) -> float:
        if not history_events:
            return 0.5

        max_seq_len = int(self.config["max_seq_len"])
        events = history_events[-max_seq_len:]

        topic_ids = []
        behavior = []

        time_cap = float(self.config.get("time_cap_sec", 600.0))

        for event in events:
            topic_ids.append(self._encode_topic(str(event.get("topicId", "<unk>"))))

            if self.include_behavior:
                prev_correct = float(event.get("correct", event.get("label_nextCorrect", 0.0)))
                difficulty = self._encode_difficulty(str(event.get("difficulty", "unknown")))
                time_norm = float(np.clip(float(event.get("timeSpentSec", 0.0)) / time_cap, 0.0, 1.0))
                hint = float(np.clip(float(event.get("hintUsed", 0.0)), 0.0, 1.0))
                source = self._encode_source(str(event.get("sourceType", "quiz")))
            else:
                prev_correct = difficulty = time_norm = hint = source = 0.0

            behavior.append([prev_correct, difficulty, time_norm, hint, source])

        pad_len = max_seq_len - len(events)
        if pad_len > 0:
            topic_ids = [0] * pad_len + topic_ids
            behavior = [[0.0] * 5 for _ in range(pad_len)] + behavior

        topic_t = torch.tensor([topic_ids], dtype=torch.long, device=self.device)
        beh_t = torch.tensor([behavior], dtype=torch.float32, device=self.device)
        len_t = torch.tensor([max(1, len(events))], dtype=torch.long, device=self.device)

        with torch.no_grad():
            logit = self.model(topic_t, beh_t, len_t)
            prob = torch.sigmoid(logit).item()
        return float(prob)


def export_inference_manifest(artifact_path: str, output_json: str):
    bundle = torch.load(artifact_path, map_location="cpu", weights_only=False)
    manifest = {
        "model_name": bundle["model_name"],
        "include_behavior": bool(bundle.get("include_behavior", True)),
        "metrics": bundle.get("metrics", {}),
        "config": bundle.get("config", {}),
    }
    Path(output_json).write_text(json.dumps(manifest, indent=2), encoding="utf-8")
