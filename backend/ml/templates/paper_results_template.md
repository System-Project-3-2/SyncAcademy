# Paper-Ready Results Template

## Title
Adaptive Knowledge Tracing for Topic-Level Mastery Recovery in LMS Systems

## Abstract
- Problem statement
- Method summary (baseline + sequence + explainability)
- Key numerical outcomes
- Practical implication

## 1. Introduction
- Motivation
- Gaps in current tutoring support
- Contributions

## 2. Method
### 2.1 Dataset
- Event schema
- Inclusion/exclusion
- Time split policy

### 2.2 Models
- Baselines: Logistic Regression, XGBoost
- Sequence: LSTM DKT, Transformer KT

### 2.3 Explainability
- Tabular SHAP-style proxy
- Sequence attention-like contribution traces
- Recommendation driver decomposition

### 2.4 Evaluation
- Offline metrics: AUC, PR-AUC, LogLoss, Brier, ECE
- Ablations: behavior features on/off, short vs long history
- Online A/B KPI definitions

## 3. Results
### 3.1 Offline Model Comparison
| Model | AUC | PR-AUC | LogLoss | Brier | ECE |
|---|---:|---:|---:|---:|---:|
| Baseline LR |  |  |  |  |  |
| Baseline XGBoost |  |  |  |  |  |
| LSTM + behavior |  |  |  |  |  |
| LSTM topic-only |  |  |  |  |  |
| Transformer + behavior |  |  |  |  |  |
| Transformer topic-only |  |  |  |  |  |

### 3.2 Subgroup and History Slice Analysis
- Short history
- Long history
- Cold start
- Sparse history

### 3.3 Explainability Findings
- Top global drivers
- Representative local examples
- Top increasing/decreasing actions from sequence traces

### 3.4 Online A/B Results
| Metric | Control | Treatment | Lift | CI | p-value |
|---|---:|---:|---:|---:|---:|
| Weak-topic recovery delta |  |  |  |  |  |
| Engagement rate |  |  |  |  |  |
| Completion rate |  |  |  |  |  |
| Time-to-recovery |  |  |  |  |  |

## 4. Discussion
- What worked and why
- Limitations
- Validity threats

## 5. Production Recommendation
- Selected model and rationale
- Rollout constraints and monitoring

## 6. Reproducibility Statement
- Versioned data contracts
- Fixed seeds
- Artifact paths
- Config snapshot

## Appendix
- Hyperparameter tables
- Additional calibration plots
- Error analysis slices
