import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTemporalSmoothing,
  deriveWeaknessReasonCodes,
  buildMaterialRecommendation,
  rankTopRecommendations,
} from "../utils/ktMasteryEngine.js";

test("applyTemporalSmoothing blends previous and model probabilities", () => {
  const out = applyTemporalSmoothing({ previousMastery: 0.8, modelProbability: 0.2, alpha: 0.75 });
  assert.equal(Number(out.smoothedMastery.toFixed(4)), 0.65);
});

test("deriveWeaknessReasonCodes provides expected reason flags", () => {
  const reasons = deriveWeaknessReasonCodes({
    masteryScore: 0.3,
    confidence: 0.2,
    stats: { attempts: 2, hintRate: 0.5, avgTimeSec: 100, correctAttempts: 0 },
  });
  assert.ok(reasons.includes("LOW_MASTERY"));
  assert.ok(reasons.includes("LOW_HISTORY"));
  assert.ok(reasons.includes("LOW_CONFIDENCE"));
});

test("buildMaterialRecommendation ranks explicit topic tags strongly", () => {
  const topic = { topicId: "arrays", weaknessScore: 0.8, confidence: 0.7, stats: { hintRate: 0.2 } };
  const material = {
    _id: "m1",
    title: "Array Basics",
    type: "slides",
    fileUrl: "x",
    textContent: "array traversal",
    topicTags: [{ topicId: "arrays", confidence: 0.9 }],
  };
  const rec = buildMaterialRecommendation({ material, topic, seenMaterialIds: new Set() });
  assert.ok(rec.score > 0.6);
  assert.ok(rec.reasonCodes.includes("EXPLICIT_TOPIC_TAG_MATCH"));
});

test("rankTopRecommendations returns requested top N", () => {
  const ranked = rankTopRecommendations({
    candidates: [{ score: 0.1 }, { score: 0.9 }, { score: 0.5 }],
    topN: 2,
  });
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].score, 0.9);
});
