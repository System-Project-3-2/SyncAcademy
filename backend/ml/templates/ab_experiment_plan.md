# Adaptive Recommendation A/B Experiment Plan

## 1. Experiment Objective
Measure whether adaptive, explainable recommendations improve student recovery on weak topics compared to standard non-adaptive recommendations.

## 2. Variants
- Control (A): existing recommendation flow without personalized weakness-aware ranking.
- Treatment (B): adaptive ranking using KT weakness score + relevance + novelty + explainability cards.

## 3. Eligibility
- Role: student
- At least one active enrolled course
- At least one topic mastery record in target course

## 4. Randomization Strategy
- Unit: student-course pair
- Method: deterministic hash bucketing on `studentId:courseId`
- Allocation: 50/50
- Sticky assignment through entire experiment window

## 5. KPIs
### Primary KPI
- Weak-topic recovery delta:
  - Definition: average increase in topic mastery score for topics where baseline weakness >= 0.55
  - Window: 14 days post first exposure

### Secondary KPIs
- Recommendation engagement rate: opened / shown
- Session completion rate: quick-check completed / quick-check shown
- Time-to-recovery: time to reach mastery >= 0.65 on weak topics
- Recommendation helpfulness rate: helpful / feedback actions

## 6. Statistical Plan
- Power target: 80%
- Alpha: 0.05 (two-sided)
- Primary test:
  - Welch t-test on student-level weak-topic recovery delta
  - Confirm with bootstrap CI (10k resamples)
- Secondary metrics:
  - Proportion tests for engagement/completion/helpfulness
  - Survival analysis (Kaplan-Meier + log-rank) for time-to-recovery
- Multiple comparisons:
  - Benjamini-Hochberg FDR across secondary KPIs

## 7. Guardrails
- No drop in overall correctness > 2 percentage points
- No increase in low-confidence recommendations > 10%
- No subgroup harm beyond threshold in fairness checks

## 8. Ethics and Fairness Checks
- Slice by:
  - prior achievement quantiles
  - short vs long history students
  - course cohort
- Fairness criteria:
  - no subgroup with negative primary KPI lift below -0.02 absolute without mitigation
- Privacy:
  - aggregate reporting only
  - de-identify student IDs in exports

## 9. Instrumentation Events
- `ab_assignment`
- `recommendation_impression`
- `recommendation_open`
- `recommendation_feedback_helpful`
- `recommendation_feedback_dismiss`
- `quick_check_started`
- `quick_check_completed`
- `mastery_snapshot_daily`

## 10. Rollout and Stop Rules
- Start with 10% ramp for 48h sanity check
- Expand to 100% eligible traffic if guardrails pass
- Stop early if severe guardrail violation or data quality breach

## 11. Reporting Cadence
- Daily monitoring dashboard
- Weekly decision memo
- Final readout at experiment completion
