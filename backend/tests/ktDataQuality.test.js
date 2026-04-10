import test from "node:test";
import assert from "node:assert/strict";
import {
  computeNullRates,
  detectDuplicateEvents,
  detectTimestampAnomalies,
  computeWeeklyDistributionShift,
} from "../utils/ktDataQuality.js";

const events = [
  {
    student: "s1",
    course: "c1",
    topicId: "arrays",
    questionId: "q1",
    eventType: "question_attempt",
    eventTimestamp: "2026-03-31T10:00:00.000Z",
    sourceType: "quiz",
    isCorrect: true,
    difficulty: "easy",
    timeSpentSec: 10,
    createdAt: "2026-03-31T10:00:01.000Z",
  },
  {
    student: "s1",
    course: "c1",
    topicId: "arrays",
    questionId: "q1",
    eventType: "question_attempt",
    eventTimestamp: "2026-03-31T10:00:00.000Z",
    sourceType: "quiz",
    isCorrect: true,
    difficulty: "easy",
    timeSpentSec: 10,
    createdAt: "2026-03-31T10:00:02.000Z",
  },
  {
    student: "s2",
    course: "c1",
    topicId: "trees",
    questionId: "q4",
    eventType: "assignment_attempt",
    eventTimestamp: "2026-04-08T10:00:00.000Z",
    sourceType: "assignment",
    isCorrect: false,
    difficulty: "hard",
    timeSpentSec: 50,
    createdAt: "2026-04-08T10:00:01.000Z",
  },
];

test("computeNullRates computes null percentages", () => {
  const rates = computeNullRates(events, ["questionId", "topicId", "foo"]);
  assert.equal(rates.questionId.nullCount, 0);
  assert.equal(rates.foo.nullCount, 3);
});

test("detectDuplicateEvents finds duplicated keys", () => {
  const duplicates = detectDuplicateEvents(events);
  assert.equal(duplicates.length, 1);
});

test("detectTimestampAnomalies returns expected shape", () => {
  const anomalies = detectTimestampAnomalies(events);
  assert.ok(Array.isArray(anomalies.futureEvents));
  assert.ok(Array.isArray(anomalies.outOfOrder));
});

test("computeWeeklyDistributionShift returns week map and shifts", () => {
  const distribution = computeWeeklyDistributionShift(events);
  assert.ok(distribution.weeklyCounts);
  assert.ok(Array.isArray(distribution.shifts));
});
