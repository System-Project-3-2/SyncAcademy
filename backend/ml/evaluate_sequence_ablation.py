import argparse
import json
from pathlib import Path

import pandas as pd


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate sequence KT ablation outputs")
    parser.add_argument("--reports-root", type=str, default="ml/reports", help="Reports directory root")
    parser.add_argument("--run-id", type=str, default="", help="Specific sequence run id")
    return parser.parse_args()


def select_run(root: Path, run_id: str) -> Path:
    if run_id:
        run_path = root / run_id
        if not run_path.exists():
            raise FileNotFoundError(f"Run not found: {run_path}")
        return run_path

    runs = sorted([p for p in root.glob("*") if p.is_dir()], reverse=True)
    for run in runs:
        if (run / "sequence_model_comparison.csv").exists():
            return run
    raise FileNotFoundError("No sequence run found with sequence_model_comparison.csv")


def main():
    args = parse_args()
    root = Path(args.reports_root)
    run_dir = select_run(root, args.run_id)

    seq_cmp = pd.read_csv(run_dir / "sequence_model_comparison.csv")
    baseline_file = run_dir / "baseline_vs_sequence.csv"
    history_file = run_dir / "history_slice_metrics.csv"

    baseline_vs_seq = pd.read_csv(baseline_file) if baseline_file.exists() else pd.DataFrame()
    history_df = pd.read_csv(history_file) if history_file.exists() else pd.DataFrame()

    best = seq_cmp.sort_values(["logloss", "ece"], ascending=[True, True]).iloc[0]

    behavior_effect = (
        seq_cmp.pivot_table(index="model_family", columns="feature_mode", values="logloss", aggfunc="first")
        if {"model_family", "feature_mode", "logloss"}.issubset(seq_cmp.columns)
        else pd.DataFrame()
    )

    summary = {
        "run_id": run_dir.name,
        "best_model": best["model_variant"],
        "best_metrics": {
            "auc": float(best["auc"]),
            "pr_auc": float(best["pr_auc"]),
            "logloss": float(best["logloss"]),
            "brier": float(best["brier"]),
            "ece": float(best["ece"]),
        },
        "has_baseline_comparison": not baseline_vs_seq.empty,
        "has_history_slices": not history_df.empty,
    }

    out_json = run_dir / "sequence_eval_summary.json"
    out_md = run_dir / "sequence_eval_summary.md"

    out_json.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    lines = [
        "# Sequence Evaluation Summary",
        "",
        f"Run: {run_dir.name}",
        "",
        "## Best Model",
        f"- {best['model_variant']}",
        "",
        "## Sequence Comparison",
        seq_cmp.to_string(index=False),
    ]

    if not behavior_effect.empty:
        lines.extend(["", "## Behavior Ablation (Lower logloss is better)", behavior_effect.to_string()])

    if not history_df.empty:
        lines.extend(["", "## Short vs Long History", history_df.to_string(index=False)])

    if not baseline_vs_seq.empty:
        lines.extend(["", "## Baseline vs Sequence", baseline_vs_seq.to_string(index=False)])

    out_md.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
