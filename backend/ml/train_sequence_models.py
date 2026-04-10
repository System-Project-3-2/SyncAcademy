import argparse
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import average_precision_score, brier_score_loss, log_loss, roc_auc_score
from torch import nn
from torch.utils.data import DataLoader, Dataset

from sequence_kt_models import build_sequence_model


@dataclass
class SplitFrames:
    train: pd.DataFrame
    val: pd.DataFrame
    test: pd.DataFrame


def parse_args():
    parser = argparse.ArgumentParser(description="Train sequence KT models (LSTM + Transformer) with ablations")
    parser.add_argument("--dataset", type=str, default="", help="Path to sequence CSV")
    parser.add_argument("--output", type=str, default="ml/model_registry", help="Model registry root")
    parser.add_argument("--reports", type=str, default="ml/reports", help="Report root")
    parser.add_argument("--epochs", type=int, default=6, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=64, help="Batch size")
    parser.add_argument("--max-seq-len", type=int, default=40, help="Sequence context length")
    parser.add_argument("--min-history", type=int, default=3, help="Minimum history events for a supervised sample")
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate")
    parser.add_argument("--smoke-test", action="store_true", help="Train on synthetic data")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    return parser.parse_args()


def set_seed(seed: int):
    np.random.seed(seed)
    torch.manual_seed(seed)


def generate_synthetic_data(n_students: int = 36, events_per_student: int = 30) -> pd.DataFrame:
    rng = np.random.default_rng(42)
    topics = ["arrays", "trees", "graphs", "dp", "db", "ml"]
    difficulties = ["easy", "medium", "hard"]
    sources = ["quiz", "assignment"]

    rows = []
    base_time = pd.Timestamp("2025-01-01")
    for student in range(n_students):
        mastery = {topic: rng.uniform(0.25, 0.75) for topic in topics}
        ts = base_time + pd.Timedelta(hours=student)
        for step in range(events_per_student):
            topic = rng.choice(topics)
            difficulty = rng.choice(difficulties, p=[0.3, 0.5, 0.2])
            source = rng.choice(sources)
            hint = float(rng.uniform() < 0.25)
            time_spent = float(np.clip(rng.normal(55, 18), 8, 200))

            diff_penalty = {"easy": 0.06, "medium": 0.12, "hard": 0.2}[difficulty]
            p_correct = np.clip(mastery[topic] - diff_penalty - hint * 0.05 + rng.normal(0, 0.04), 0.02, 0.98)
            correct = int(rng.uniform() < p_correct)

            rows.append(
                {
                    "studentId": f"s{student+1}",
                    "courseId": "c1",
                    "topicId": topic,
                    "sourceType": source,
                    "eventType": "question_attempt",
                    "eventTimestamp": (ts + pd.Timedelta(minutes=step * 9)).isoformat(),
                    "label_nextCorrect": correct,
                    "difficulty": difficulty,
                    "timeSpentSec": time_spent,
                    "hintUsed": hint,
                }
            )

            # Mild mastery update to mimic learning over time.
            mastery[topic] = np.clip(mastery[topic] + (0.03 if correct else -0.015), 0.05, 0.98)

    return pd.DataFrame(rows)


def load_dataset(dataset_path: str, smoke: bool) -> pd.DataFrame:
    if smoke:
        return generate_synthetic_data()
    if not dataset_path:
        raise ValueError("--dataset is required unless --smoke-test is provided")

    df = pd.read_csv(dataset_path)
    required = {
        "studentId",
        "topicId",
        "eventTimestamp",
        "label_nextCorrect",
        "difficulty",
        "timeSpentSec",
        "hintUsed",
        "sourceType",
    }
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Dataset missing required columns: {sorted(missing)}")
    return df


def time_split(df: pd.DataFrame) -> SplitFrames:
    work = df.copy()
    work["eventTimestamp"] = pd.to_datetime(work["eventTimestamp"], errors="coerce")
    work = work.dropna(subset=["eventTimestamp", "label_nextCorrect"]).sort_values("eventTimestamp")

    n = len(work)
    if n < 120:
        raise ValueError("Need at least 120 rows for sequence time split")

    i70 = int(n * 0.7)
    i85 = int(n * 0.85)
    return SplitFrames(train=work.iloc[:i70].copy(), val=work.iloc[i70:i85].copy(), test=work.iloc[i85:].copy())


def build_vocab(train_df: pd.DataFrame):
    topics = sorted(train_df["topicId"].astype(str).unique().tolist())
    difficulties = sorted(train_df["difficulty"].fillna("unknown").astype(str).unique().tolist())
    sources = sorted(train_df["sourceType"].fillna("quiz").astype(str).unique().tolist())

    topic2idx = {"<pad>": 0, "<unk>": 1}
    for idx, topic in enumerate(topics, start=2):
        topic2idx[topic] = idx

    difficulty2idx = {name: i for i, name in enumerate(difficulties)}
    if "unknown" not in difficulty2idx:
        difficulty2idx["unknown"] = len(difficulty2idx)

    source2idx = {name: i for i, name in enumerate(sources)}
    if "quiz" not in source2idx:
        source2idx["quiz"] = len(source2idx)

    return {
        "topic2idx": topic2idx,
        "topic_size": len(topic2idx),
        "difficulty2idx": difficulty2idx,
        "source2idx": source2idx,
    }


def encode_event(row, vocab, include_behavior: bool, time_cap_sec: float):
    topic_id = vocab["topic2idx"].get(str(row.topicId), 1)

    if include_behavior:
        prev_correct = float(np.clip(row.label_nextCorrect, 0, 1))
        diff_idx = vocab["difficulty2idx"].get(str(row.difficulty), vocab["difficulty2idx"].get("unknown", 0))
        diff_norm = float(diff_idx) / max(1, len(vocab["difficulty2idx"]) - 1)
        time_norm = float(np.clip(float(row.timeSpentSec) / time_cap_sec, 0.0, 1.0))
        hint = float(np.clip(float(row.hintUsed), 0.0, 1.0))
        source_idx = vocab["source2idx"].get(str(row.sourceType), vocab["source2idx"].get("quiz", 0))
        source_norm = float(source_idx) / max(1, len(vocab["source2idx"]) - 1)
    else:
        prev_correct = diff_norm = time_norm = hint = source_norm = 0.0

    behavior = [prev_correct, diff_norm, time_norm, hint, source_norm]
    return topic_id, behavior


def build_supervised_sequences(
    df: pd.DataFrame,
    vocab,
    max_seq_len: int,
    min_history: int,
    include_behavior: bool,
    time_cap_sec: float,
):
    rows = []
    work = df.sort_values(["studentId", "eventTimestamp"])

    for _, group in work.groupby("studentId", sort=False):
        records = list(group.itertuples(index=False))
        if len(records) <= min_history:
            continue

        for idx in range(min_history, len(records)):
            history = records[max(0, idx - max_seq_len) : idx]
            target = int(records[idx].label_nextCorrect)
            history_len = len(history)
            if history_len <= 0:
                continue

            topic_ids = []
            behavior = []
            for event in history:
                t_id, beh = encode_event(event, vocab, include_behavior, time_cap_sec)
                topic_ids.append(t_id)
                behavior.append(beh)

            pad = max_seq_len - history_len
            if pad > 0:
                topic_ids = [0] * pad + topic_ids
                behavior = [[0.0] * 5 for _ in range(pad)] + behavior

            rows.append(
                {
                    "topic_ids": topic_ids,
                    "behavior": behavior,
                    "length": history_len,
                    "label": target,
                    "history_len": history_len,
                }
            )

    return rows


class SequenceDataset(Dataset):
    def __init__(self, rows):
        self.rows = rows

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, idx):
        row = self.rows[idx]
        return {
            "topic_ids": torch.tensor(row["topic_ids"], dtype=torch.long),
            "behavior": torch.tensor(row["behavior"], dtype=torch.float32),
            "length": torch.tensor(row["length"], dtype=torch.long),
            "label": torch.tensor(row["label"], dtype=torch.float32),
            "history_len": torch.tensor(row["history_len"], dtype=torch.long),
        }


def metric_pack(y_true, y_prob):
    y_prob = np.clip(np.asarray(y_prob), 1e-7, 1 - 1e-7)
    y_true = np.asarray(y_true)
    return {
        "auc": float(roc_auc_score(y_true, y_prob)),
        "pr_auc": float(average_precision_score(y_true, y_prob)),
        "logloss": float(log_loss(y_true, y_prob)),
        "brier": float(brier_score_loss(y_true, y_prob)),
    }


def expected_calibration_error(y_true, y_prob, bins=10):
    y_true = np.asarray(y_true)
    y_prob = np.asarray(y_prob)
    edges = np.linspace(0, 1, bins + 1)
    ece = 0.0
    for i in range(bins):
        lo, hi = edges[i], edges[i + 1]
        mask = (y_prob >= lo) & (y_prob < hi if i < bins - 1 else y_prob <= hi)
        if not np.any(mask):
            continue
        conf = y_prob[mask].mean()
        acc = y_true[mask].mean()
        ece += np.abs(conf - acc) * (mask.sum() / len(y_prob))
    return float(ece)


def run_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss = 0.0
    for batch in loader:
        topic_ids = batch["topic_ids"].to(device)
        behavior = batch["behavior"].to(device)
        lengths = batch["length"].to(device)
        labels = batch["label"].to(device)

        optimizer.zero_grad(set_to_none=True)
        logits = model(topic_ids, behavior, lengths)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()

        total_loss += float(loss.item()) * labels.size(0)

    return total_loss / max(1, len(loader.dataset))


def predict_all(model, loader, device):
    model.eval()
    all_probs = []
    all_labels = []
    all_hist_len = []

    with torch.no_grad():
        for batch in loader:
            topic_ids = batch["topic_ids"].to(device)
            behavior = batch["behavior"].to(device)
            lengths = batch["length"].to(device)
            labels = batch["label"].cpu().numpy()
            hist = batch["history_len"].cpu().numpy()

            logits = model(topic_ids, behavior, lengths)
            probs = torch.sigmoid(logits).cpu().numpy()

            all_probs.extend(probs.tolist())
            all_labels.extend(labels.tolist())
            all_hist_len.extend(hist.tolist())

    return np.asarray(all_labels), np.asarray(all_probs), np.asarray(all_hist_len)


def train_and_eval(model_name, include_behavior, split, vocab, args, device, time_cap_sec):
    train_rows = build_supervised_sequences(
        split.train,
        vocab,
        args.max_seq_len,
        args.min_history,
        include_behavior,
        time_cap_sec,
    )
    val_rows = build_supervised_sequences(
        split.val,
        vocab,
        args.max_seq_len,
        args.min_history,
        include_behavior,
        time_cap_sec,
    )
    test_rows = build_supervised_sequences(
        split.test,
        vocab,
        args.max_seq_len,
        args.min_history,
        include_behavior,
        time_cap_sec,
    )

    if min(len(train_rows), len(val_rows), len(test_rows)) < 8:
        raise ValueError("Sequence dataset too small after conversion; need more event history")

    train_loader = DataLoader(SequenceDataset(train_rows), batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(SequenceDataset(val_rows), batch_size=args.batch_size, shuffle=False)
    test_loader = DataLoader(SequenceDataset(test_rows), batch_size=args.batch_size, shuffle=False)

    model = build_sequence_model(model_name, vocab["topic_size"], args.max_seq_len).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    criterion = nn.BCEWithLogitsLoss()

    best_state = None
    best_val = float("inf")

    for _ in range(args.epochs):
        run_epoch(model, train_loader, optimizer, criterion, device)
        y_val, p_val, _ = predict_all(model, val_loader, device)
        val_loss = metric_pack(y_val, p_val)["logloss"]
        if val_loss < best_val:
            best_val = val_loss
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

    model.load_state_dict(best_state)
    y_test, p_test, h_test = predict_all(model, test_loader, device)

    metrics = metric_pack(y_test, p_test)
    metrics["ece"] = expected_calibration_error(y_test, p_test)

    short_mask = h_test <= args.max_seq_len // 2
    long_mask = h_test > args.max_seq_len // 2

    history_rows = []
    for name, mask in [("short_history", short_mask), ("long_history", long_mask)]:
        if mask.sum() < 5 or len(np.unique(y_test[mask])) < 2:
            continue
        row = metric_pack(y_test[mask], p_test[mask])
        row["ece"] = expected_calibration_error(y_test[mask], p_test[mask])
        row["slice"] = name
        row["rows"] = int(mask.sum())
        history_rows.append(row)

    return {
        "model": model,
        "metrics": metrics,
        "history_metrics": history_rows,
        "rows": {
            "train": len(train_rows),
            "val": len(val_rows),
            "test": len(test_rows),
        },
    }


def maybe_load_latest_baseline(reports_root: Path):
    runs = sorted([p for p in reports_root.glob("*") if p.is_dir()], reverse=True)
    for run in runs:
        candidate = run / "model_comparison.csv"
        if candidate.exists():
            try:
                df = pd.read_csv(candidate)
                if {"model", "auc", "pr_auc", "logloss", "brier"}.issubset(df.columns):
                    return run.name, df
            except Exception:
                continue
    return None, None


def write_findings(path: Path, summary_rows: pd.DataFrame, baseline_df: pd.DataFrame | None):
    best = summary_rows.sort_values(["logloss", "ece"], ascending=[True, True]).iloc[0]
    recommendation = (
        f"Recommended production candidate: {best['model_variant']} "
        f"(logloss={best['logloss']:.4f}, ece={best['ece']:.4f}, auc={best['auc']:.4f})."
    )

    lines = [
        "# Sequence KT Findings",
        "",
        "## Model Comparison",
        summary_rows.to_string(index=False),
        "",
        "## Practical Recommendation",
        recommendation,
        "",
        "## Notes",
        "- Models were trained using a strict time-based split.",
        "- Ablation compares full behavior features vs topic-only context.",
        "- History slices compare short vs long event context.",
    ]

    if baseline_df is not None and not baseline_df.empty:
        lines.extend(["", "## Baseline Reference", baseline_df.to_string(index=False)])

    path.write_text("\n".join(lines), encoding="utf-8")


def main():
    args = parse_args()
    set_seed(args.seed)

    df = load_dataset(args.dataset, args.smoke_test)
    split = time_split(df)

    # Normalize numeric behavior features once from train split.
    split.train["timeSpentSec"] = pd.to_numeric(split.train["timeSpentSec"], errors="coerce").fillna(0)
    split.val["timeSpentSec"] = pd.to_numeric(split.val["timeSpentSec"], errors="coerce").fillna(0)
    split.test["timeSpentSec"] = pd.to_numeric(split.test["timeSpentSec"], errors="coerce").fillna(0)

    split.train["hintUsed"] = pd.to_numeric(split.train["hintUsed"], errors="coerce").fillna(0)
    split.val["hintUsed"] = pd.to_numeric(split.val["hintUsed"], errors="coerce").fillna(0)
    split.test["hintUsed"] = pd.to_numeric(split.test["hintUsed"], errors="coerce").fillna(0)

    time_cap_sec = float(np.percentile(split.train["timeSpentSec"].values, 95) or 600.0)
    vocab = build_vocab(split.train)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    run_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")

    registry_dir = Path(args.output) / run_id
    report_dir = Path(args.reports) / run_id
    registry_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)

    experiments = [
        ("lstm", True),
        ("lstm", False),
        ("transformer", True),
        ("transformer", False),
    ]

    summary_rows = []
    history_rows = []

    for model_name, include_behavior in experiments:
        result = train_and_eval(
            model_name=model_name,
            include_behavior=include_behavior,
            split=split,
            vocab=vocab,
            args=args,
            device=device,
            time_cap_sec=time_cap_sec,
        )

        variant = f"{model_name}_{'with_behavior' if include_behavior else 'topic_only'}"
        metrics = result["metrics"]
        summary_rows.append(
            {
                "model_variant": variant,
                "model_family": model_name,
                "feature_mode": "with_behavior" if include_behavior else "topic_only",
                "auc": metrics["auc"],
                "pr_auc": metrics["pr_auc"],
                "logloss": metrics["logloss"],
                "brier": metrics["brier"],
                "ece": metrics["ece"],
                "train_rows": result["rows"]["train"],
                "val_rows": result["rows"]["val"],
                "test_rows": result["rows"]["test"],
            }
        )

        for row in result["history_metrics"]:
            history_rows.append(
                {
                    "model_variant": variant,
                    "slice": row["slice"],
                    "rows": row["rows"],
                    "auc": row["auc"],
                    "pr_auc": row["pr_auc"],
                    "logloss": row["logloss"],
                    "brier": row["brier"],
                    "ece": row["ece"],
                }
            )

        artifact_path = registry_dir / f"{variant}.pt"
        torch.save(
            {
                "model_name": model_name,
                "include_behavior": include_behavior,
                "state_dict": result["model"].state_dict(),
                "vocab": vocab,
                "metrics": metrics,
                "config": {
                    "max_seq_len": args.max_seq_len,
                    "min_history": args.min_history,
                    "time_cap_sec": time_cap_sec,
                },
            },
            artifact_path,
        )

    summary_df = pd.DataFrame(summary_rows).sort_values(["logloss", "ece"], ascending=[True, True])
    history_df = pd.DataFrame(history_rows)

    summary_df.to_csv(report_dir / "sequence_model_comparison.csv", index=False)
    if not history_df.empty:
        history_df.to_csv(report_dir / "history_slice_metrics.csv", index=False)

    ablation_df = summary_df.pivot_table(
        index="model_family",
        columns="feature_mode",
        values=["auc", "pr_auc", "logloss", "brier", "ece"],
        aggfunc="first",
    )
    ablation_df.to_csv(report_dir / "ablation_behavior.csv")

    baseline_run, baseline_df = maybe_load_latest_baseline(Path(args.reports))
    combined_rows = []
    if baseline_df is not None:
        for _, row in baseline_df.iterrows():
            combined_rows.append(
                {
                    "model_variant": row["model"],
                    "family": "baseline",
                    "auc": row["auc"],
                    "pr_auc": row["pr_auc"],
                    "logloss": row["logloss"],
                    "brier": row["brier"],
                    "ece": np.nan,
                }
            )

    for _, row in summary_df.iterrows():
        combined_rows.append(
            {
                "model_variant": row["model_variant"],
                "family": "sequence",
                "auc": row["auc"],
                "pr_auc": row["pr_auc"],
                "logloss": row["logloss"],
                "brier": row["brier"],
                "ece": row["ece"],
            }
        )

    pd.DataFrame(combined_rows).to_csv(report_dir / "baseline_vs_sequence.csv", index=False)
    write_findings(report_dir / "findings_summary.md", summary_df, baseline_df)

    run_summary = {
        "run_id": run_id,
        "smoke_test": bool(args.smoke_test),
        "device": str(device),
        "split_rows": {
            "train": int(len(split.train)),
            "val": int(len(split.val)),
            "test": int(len(split.test)),
        },
        "baseline_reference_run": baseline_run,
        "best_model": summary_df.iloc[0]["model_variant"],
        "artifacts": {
            "registry_dir": str(registry_dir),
            "report_dir": str(report_dir),
        },
    }

    (report_dir / "sequence_run_summary.json").write_text(json.dumps(run_summary, indent=2), encoding="utf-8")

    print("Sequence KT training completed")
    print(json.dumps(run_summary, indent=2))


if __name__ == "__main__":
    main()
