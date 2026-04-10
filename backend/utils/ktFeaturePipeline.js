const DIFF_WEIGHT = {
  easy: 0.9,
  medium: 1,
  hard: 1.1,
  unknown: 1,
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

const scoreEvent = (event) => {
  if (typeof event.normalizedScore === "number") {
    return clamp(event.normalizedScore, 0, 1);
  }
  if (typeof event.isCorrect === "boolean") {
    return event.isCorrect ? 1 : 0;
  }
  return 0;
};

const isQuestionLike = (event) =>
  event.eventType === "question_attempt" || event.eventType === "assignment_attempt";

const windowSlice = (arr, n) => arr.slice(Math.max(0, arr.length - n));

const accuracy = (events) => {
  if (!events.length) return 0;
  const scores = events.map(scoreEvent);
  return avg(scores);
};

const hintRate = (events) => {
  if (!events.length) return 0;
  return events.filter((e) => e.hintUsed).length / events.length;
};

const trendSlope = (events) => {
  if (events.length < 2) return 0;
  const scores = events.map(scoreEvent);
  const n = scores.length;
  const xMean = (n - 1) / 2;
  const yMean = avg(scores);

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    num += dx * (scores[i] - yMean);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
};

const weightedAccuracy = (events) => {
  if (!events.length) return 0;
  const weighted = events.map((e) => {
    const base = scoreEvent(e);
    const weight = DIFF_WEIGHT[e.difficulty] || 1;
    return base / weight;
  });
  return avg(weighted);
};

const toDate = (value) => new Date(value instanceof Date ? value : String(value));

const daysDiff = (a, b) => Math.max(0, (toDate(a).getTime() - toDate(b).getTime()) / (1000 * 60 * 60 * 24));

export const buildFeatureRows = (events, options = {}) => {
  const {
    rollingWindows = [3, 5, 10],
    includeOnlyQuestionEvents = true,
  } = options;

  if (!Array.isArray(events) || events.length === 0) return [];

  const sorted = [...events].sort(
    (a, b) => toDate(a.eventTimestamp).getTime() - toDate(b.eventTimestamp).getTime()
  );

  const filtered = includeOnlyQuestionEvents ? sorted.filter(isQuestionLike) : sorted;
  if (!filtered.length) return [];

  const rows = [];
  const history = [];

  for (const event of filtered) {
    const topicHistory = history.filter((h) => h.topicId === event.topicId);

    const row = {
      studentId: String(event.student),
      courseId: String(event.course),
      topicId: String(event.topicId),
      questionId: event.questionId ? String(event.questionId) : "",
      sourceType: event.sourceType,
      eventType: event.eventType,
      eventTimestamp: toDate(event.eventTimestamp).toISOString(),
      label_nextCorrect: typeof event.isCorrect === "boolean" ? Number(event.isCorrect) : null,
      topic_attempts_total_before: topicHistory.length,
      topic_acc_total_before: accuracy(topicHistory),
      topic_hint_rate_total_before: hintRate(topicHistory),
      topic_weighted_acc_total_before: weightedAccuracy(topicHistory),
      topic_trend_slope_before: trendSlope(topicHistory),
      overall_attempts_total_before: history.length,
      overall_acc_total_before: accuracy(history),
      days_since_topic_practice: topicHistory.length
        ? Number(daysDiff(event.eventTimestamp, topicHistory[topicHistory.length - 1].eventTimestamp).toFixed(4))
        : null,
    };

    for (const w of rollingWindows) {
      const tw = windowSlice(topicHistory, w);
      row[`topic_acc_last_${w}`] = accuracy(tw);
      row[`topic_hint_rate_last_${w}`] = hintRate(tw);
      row[`topic_weighted_acc_last_${w}`] = weightedAccuracy(tw);
      row[`topic_avg_time_last_${w}`] = avg(tw.map((x) => Number(x.timeSpentSec || 0)));
    }

    rows.push(row);
    history.push(event);
  }

  return rows;
};

export const summarizeFeatureRows = (rows) => {
  if (!rows.length) {
    return {
      totalRows: 0,
      uniqueStudents: 0,
      uniqueTopics: 0,
      nullLabels: 0,
    };
  }

  return {
    totalRows: rows.length,
    uniqueStudents: new Set(rows.map((r) => r.studentId)).size,
    uniqueTopics: new Set(rows.map((r) => r.topicId)).size,
    nullLabels: rows.filter((r) => r.label_nextCorrect == null).length,
  };
};
