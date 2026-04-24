# Reproducibility Checklist

## Data
- [ ] Data contract version is documented
- [ ] Event schema and feature dictionary committed
- [ ] Train/val/test split is strictly time-based
- [ ] Data extraction scripts and parameters are logged
- [ ] Filtering and preprocessing rules are documented

## Training
- [ ] Random seed fixed and recorded
- [ ] Model hyperparameters saved per run
- [ ] Dependency versions pinned/recorded
- [ ] Training command and runtime environment recorded
- [ ] Run summary JSON written to reports directory

## Evaluation
- [ ] Primary metrics computed (AUC, PR-AUC, LogLoss, Brier, ECE)
- [ ] Subgroup metrics computed (cold-start, sparse history)
- [ ] Ablation results reported (with/without behavior features)
- [ ] Calibration output included
- [ ] Baseline vs sequence comparison table generated

## Explainability
- [ ] Global tabular feature attribution generated
- [ ] Local topic-level explanations generated
- [ ] Sequence contribution traces generated for weak topics
- [ ] Recommendation driver explanations generated
- [ ] Top increasing/decreasing action summary exported

## Experimentation
- [ ] A/B assignment method documented
- [ ] KPI definitions versioned
- [ ] Statistical test plan documented
- [ ] Fairness and ethics checks included
- [ ] Guardrails and stop rules defined

## Packaging
- [ ] Model artifacts stored in model registry
- [ ] Inference wrapper tested on saved artifact
- [ ] README updated with commands
- [ ] Final report draft template updated
- [ ] Checklist reviewed and signed by both owners
