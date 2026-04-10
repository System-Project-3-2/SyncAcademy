import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTabularLocalExplanation,
  buildTabularGlobalExplanation,
  buildSequenceContributionTrace,
  summarizeRecommendationDrivers,
  buildTopActionSummary,
} from "../utils/ktExplainability.js";

test("buildTabularLocalExplanation returns positive and negative contributors", () => {
  const out = buildTabularLocalExplanation({
    topicId: "arrays",
    masteryScore: 0.38,
    weaknessScore: 0.62,
    confidence: 0.44,
    stats: { attempts: 6, correctAttempts: 2, hintRate: 0.5, avgTimeSec: 96 },
  });

  assert.equal(out.topicId, "arrays");
  assert.ok(out.allContributions.length >= 4);
  assert.ok(out.topNegative.length >= 1);
});

test("buildTabularGlobalExplanation aggregates feature importances", () => {
  const out = buildTabularGlobalExplanation([
    {
      topicId: "arrays",
      masteryScore: 0.3,
      weaknessScore: 0.7,
      confidence: 0.5,
      stats: { attempts: 5, correctAttempts: 2, hintRate: 0.4, avgTimeSec: 90 },
    },
    {
      topicId: "trees",
      masteryScore: 0.7,
      weaknessScore: 0.3,
      confidence: 0.75,
      stats: { attempts: 8, correctAttempts: 6, hintRate: 0.1, avgTimeSec: 40 },
    },
  ]);

  assert.equal(out.totalTopics, 2);
  assert.ok(out.featureImportance.length > 0);
});

test("buildSequenceContributionTrace generates attention-like trace and top actions", () => {
  const trace = buildSequenceContributionTrace({
    topicId: "arrays",
    limit: 5,
    events: [
      {
        topicId: "arrays",
        eventType: "question_attempt",
        isCorrect: false,
        difficulty: "medium",
        timeSpentSec: 120,
        hintUsed: true,
        eventTimestamp: "2026-04-01T10:00:00Z",
      },
      {
        topicId: "arrays",
        eventType: "question_attempt",
        isCorrect: true,
        difficulty: "hard",
        timeSpentSec: 40,
        hintUsed: false,
        eventTimestamp: "2026-04-01T10:10:00Z",
      },
    ],
  });

  assert.equal(trace.topicId, "arrays");
  assert.equal(trace.traces.length, 2);
  assert.ok(trace.topIncreaseActions.length >= 1);
  assert.ok(trace.topDecreaseActions.length >= 1);
});

test("summarizeRecommendationDrivers and buildTopActionSummary produce stable output", () => {
  const recommendationSummary = summarizeRecommendationDrivers(
    [
      {
        materialId: "m1",
        topicId: "arrays",
        score: 0.81,
        reason: "targets weak topic",
        reasonCodes: ["TARGETS_WEAK_TOPIC"],
      },
    ],
    [
      {
        topicId: "arrays",
        weaknessScore: 0.74,
        confidence: 0.55,
      },
    ]
  );

  assert.equal(recommendationSummary.local.length, 1);
  assert.ok(recommendationSummary.globalDrivers.length >= 1);

  const actionSummary = buildTopActionSummary([
    {
      topIncreaseActions: [{ contribution: 0.12, action: "A" }],
      topDecreaseActions: [{ contribution: -0.18, action: "B" }],
    },
  ]);

  assert.equal(actionSummary.increasedMastery.length, 1);
  assert.equal(actionSummary.decreasedMastery.length, 1);
});
