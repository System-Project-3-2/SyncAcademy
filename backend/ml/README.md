# KT Baseline Modeling (Phase 4)

This folder contains the baseline training pipeline for Knowledge Tracing.

## Models

- Logistic Regression (scikit-learn)
- XGBoost (`xgboost` package, with fallback if unavailable)
- Calibrated probabilities via isotonic calibration using validation split

## Inputs

- CSV generated from backend events and engineered features
- Required columns: `eventTimestamp`, `label_nextCorrect`, topic/history feature columns

## Time-aware split

Rows are sorted by `eventTimestamp` and split as:
- Train: first 70%
- Validation: next 15%
- Test: last 15%

## Outputs

- Model artifacts in `ml/model_registry/<run_id>/`
- Reports in `ml/reports/<run_id>/`
  - `run_summary.json`
  - `model_comparison.csv`
  - `per_topic_metrics.csv`
  - `subgroup_metrics.csv`
  - `feature_importance_*.csv`
  - `calibration_curve_*.csv`
  - `error_slice_*.csv`
  - `calibration_comparison.png` (if matplotlib installed)

## Commands

From `backend`:

1. Export training dataset from Mongo events:

```
npm run kt:dataset:export
```

2. Train baselines (real data):

```
npm run kt:baseline:train
```

3. Smoke test training (synthetic data):

```
npm run kt:baseline:smoke
```

## Python setup

Install dependencies:

```
pip install -r ml/requirements.txt
```

If `xgboost` is not available, the trainer uses a fallback gradient-boosting baseline and marks it in outputs.
