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

## Phase 7 Sequence KT (LSTM DKT + Transformer KT)

Sequence models are trained from ordered student events using topic + behavior features:

- `topicId`
- `label_nextCorrect` (previous correctness in sequence context)
- `difficulty`
- `timeSpentSec`
- `hintUsed`
- `sourceType`

### Sequence commands

1. Export raw sequence dataset from learning events:

```bash
npm run kt:dataset:export:sequence
```

2. Train sequence models on real dataset:

```bash
npm run kt:sequence:train -- --dataset ml/data/<your-sequence-file>.csv
```

3. Smoke test training (synthetic):

```bash
npm run kt:sequence:smoke
```

4. Generate ablation/evaluation summary for latest run:

```bash
npm run kt:sequence:evaluate
```

### Sequence outputs

- Model artifacts in `ml/model_registry/<run_id>/`
  - `lstm_with_behavior.pt`
  - `lstm_topic_only.pt`
  - `transformer_with_behavior.pt`
  - `transformer_topic_only.pt`
- Reports in `ml/reports/<run_id>/`
  - `sequence_model_comparison.csv`
  - `ablation_behavior.csv`
  - `history_slice_metrics.csv`
  - `baseline_vs_sequence.csv`
  - `findings_summary.md`
  - `sequence_run_summary.json`

### Inference wrapper

`ml/sequence_inference.py` provides `SequenceKTInference` for loading `.pt` artifacts and predicting next-correct probability from recent event history.

## Phase 8 Explainability, A/B Testing, and Packaging

### Explainability API

Backend endpoint:

```bash
GET /api/kt/explainability/:courseId
```

Response includes:

- Tabular explainability
  - Global feature importance (`shap_style_proxy`)
  - Local topic-level contributions
- Sequence explainability
  - Attention-like recency contribution traces
  - Top actions that increased/decreased mastery
- Recommendation explainability
  - Local recommendation drivers
  - Global recommendation driver summary

### Research Packaging Templates

Generated templates are available in `ml/templates/`:

- `ab_experiment_plan.md`
- `paper_results_template.md`
- `reproducibility_checklist.md`

Final report draft scaffold:

- `ml/reports/final_report_draft_phase8.md`
