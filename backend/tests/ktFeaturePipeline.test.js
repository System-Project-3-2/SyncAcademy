import test from "node:test";
import assert from "node:assert/strict";
import { buildFeatureRows, summarizeFeatureRows } from "../utils/ktFeaturePipeline.js";

const sampleEvents = [
  {
    student: "s1",
    course: "c1",
    topicId: "arrays",
    questionId: "q1",
    eventType: "question_attempt",
    sourceType: "quiz",
    isCorrect: true,
    normalizedScore: 1,
    difficulty: "easy",
    timeSpentSec: 20,
    hintUsed: false,
    eventTimestamp: "2026-04-10T10:00:00.000Z",
  },
  {
    student: "s1",
    course: "c1",
    topicId: "arrays",
    questionId: "q2",
    eventType: "question_attempt",
    sourceType: "quiz",
    isCorrect: false,
    normalizedScore: 0,
    difficulty: "medium",
    timeSpentSec: 60,
    hintUsed: true,
    eventTimestamp: "2026-04-10T10:05:00.000Z",
  },
  {
    student: "s1",
    course: "c1",
    topicId: "trees",
    questionId: "q3",
    eventType: "assignment_attempt",
    sourceType: "assignment",
    isCorrect: true,
    normalizedScore: 1,
    difficulty: "hard",
    timeSpentSec: 80,
    hintUsed: false,
    eventTimestamp: "2026-04-10T10:10:00.000Z",
  },
];

test("buildFeatureRows creates rolling feature rows", () => {
  const rows = buildFeatureRows(sampleEvents);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].topic_attempts_total_before, 0);
  assert.equal(rows[1].topic_attempts_total_before, 1);
  assert.equal(rows[1].topic_acc_last_3, 1);
  assert.equal(rows[2].topic_attempts_total_before, 0);
  assert.equal(rows[2].overall_attempts_total_before, 2);
});

test("summarizeFeatureRows returns expected counts", () => {
  const rows = buildFeatureRows(sampleEvents);
  const summary = summarizeFeatureRows(rows);
  assert.equal(summary.totalRows, 3);
  assert.equal(summary.uniqueStudents, 1);
  assert.equal(summary.uniqueTopics, 2);
});
