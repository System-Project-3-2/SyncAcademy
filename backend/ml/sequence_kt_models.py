from __future__ import annotations

import torch
import torch.nn as nn


class LSTMDKT(nn.Module):
    def __init__(self, topic_vocab_size: int, d_model: int = 64, hidden_size: int = 96, n_layers: int = 1):
        super().__init__()
        self.topic_emb = nn.Embedding(topic_vocab_size, d_model, padding_idx=0)
        self.behavior_proj = nn.Linear(5, d_model)
        self.lstm = nn.LSTM(input_size=d_model * 2, hidden_size=hidden_size, num_layers=n_layers, batch_first=True)
        self.head = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(0.15),
            nn.Linear(hidden_size // 2, 1),
        )

    def forward(self, topic_ids: torch.Tensor, behavior: torch.Tensor, lengths: torch.Tensor) -> torch.Tensor:
        topic_vec = self.topic_emb(topic_ids)
        behavior_vec = self.behavior_proj(behavior)
        x = torch.cat([topic_vec, behavior_vec], dim=-1)

        packed = nn.utils.rnn.pack_padded_sequence(
            x,
            lengths.cpu(),
            batch_first=True,
            enforce_sorted=False,
        )
        _, (h_n, _) = self.lstm(packed)
        last_hidden = h_n[-1]
        logits = self.head(last_hidden).squeeze(-1)
        return logits


class TransformerKT(nn.Module):
    def __init__(
        self,
        topic_vocab_size: int,
        d_model: int = 96,
        n_heads: int = 4,
        n_layers: int = 2,
        max_seq_len: int = 100,
    ):
        super().__init__()
        self.topic_emb = nn.Embedding(topic_vocab_size, d_model, padding_idx=0)
        self.behavior_proj = nn.Linear(5, d_model)
        self.pos_emb = nn.Embedding(max_seq_len, d_model)
        enc_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=n_heads,
            dim_feedforward=d_model * 4,
            dropout=0.15,
            batch_first=True,
            activation="gelu",
        )
        self.encoder = nn.TransformerEncoder(enc_layer, num_layers=n_layers)
        self.head = nn.Sequential(
            nn.Linear(d_model, d_model // 2),
            nn.GELU(),
            nn.Dropout(0.15),
            nn.Linear(d_model // 2, 1),
        )

    def forward(self, topic_ids: torch.Tensor, behavior: torch.Tensor, lengths: torch.Tensor) -> torch.Tensor:
        batch_size, seq_len = topic_ids.size()
        pos = torch.arange(seq_len, device=topic_ids.device).unsqueeze(0).expand(batch_size, -1)

        token = self.topic_emb(topic_ids) + self.behavior_proj(behavior) + self.pos_emb(pos)
        key_padding_mask = topic_ids.eq(0)
        encoded = self.encoder(token, src_key_padding_mask=key_padding_mask)

        idx = (lengths - 1).clamp(min=0)
        pooled = encoded[torch.arange(batch_size, device=topic_ids.device), idx]
        logits = self.head(pooled).squeeze(-1)
        return logits


def build_sequence_model(model_name: str, topic_vocab_size: int, max_seq_len: int):
    if model_name == "lstm":
        return LSTMDKT(topic_vocab_size=topic_vocab_size)
    if model_name == "transformer":
        return TransformerKT(topic_vocab_size=topic_vocab_size, max_seq_len=max_seq_len)
    raise ValueError(f"Unsupported model_name: {model_name}")
