# KT Complete Training Dataset - Data Dictionary

## Files
- kt_complete_sequence_dataset.csv: ordered event-level records for LSTM/Transformer KT
- kt_complete_baseline_features.csv: engineered tabular features for Logistic Regression/XGBoost
- kt_sequence_train.csv / kt_sequence_val.csv / kt_sequence_test.csv
- kt_baseline_train.csv / kt_baseline_val.csv / kt_baseline_test.csv

## Sequence Columns
- studentId: unique student identifier
- courseId: course identifier
- topicId: topic tag for the event
- questionId: unique question interaction id
- sourceType: quiz or assignment
- eventType: question_attempt or assignment_attempt
- eventTimestamp: UTC timestamp for time-ordered modeling
- isCorrect: binary correctness
- label_nextCorrect: target label for KT
- normalizedScore: score in [0,1]
- rawScore: raw score integer
- difficulty: easy/medium/hard
- timeSpentSec: response duration
- responseLatencySec: latency before first action
- hintUsed: binary hint usage
- attemptNo: attempt index for repeated tries
- materialId: associated content id

## Baseline Feature Columns
All sequence identifiers + engineered features:
- topic_attempts_total_before
- topic_acc_total_before
- topic_hint_rate_total_before
- topic_weighted_acc_total_before
- topic_trend_slope_before
- overall_attempts_total_before
- overall_acc_total_before
- days_since_topic_practice
- topic_acc_last_3 / 5 / 10
- topic_hint_rate_last_3 / 5 / 10
- topic_weighted_acc_last_3 / 5 / 10
- topic_avg_time_last_3 / 5 / 10

## Split Policy
Strictly chronological time split:
- Train: first 70%
- Validation: next 15%
- Test: last 15%
