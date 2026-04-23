import test from "node:test";
import assert from "node:assert/strict";
import {
  extractWeakTopics,
  scoreMaterialsAgainstWeakTopics,
  buildCourseFallbackRecommendations,
  canRequesterAccessRecommendations,
} from "../services/recommendationService.js";

test("extractWeakTopics keeps only mastery < 0.5 with attempts >= 3", () => {
  const rows = [
    { topicId: "cellular_networks", masteryScore: 0.25, stats: { attempts: 3 } },
    { topicId: "signals", masteryScore: 0.49, stats: { attempts: 2 } },
    { topicId: "modulation", masteryScore: 0.7, stats: { attempts: 8 } },
  ];

  const weak = extractWeakTopics(rows);
  assert.equal(weak.length, 1);
  assert.equal(weak[0].topicId, "cellular_networks");
  assert.equal(weak[0].accuracy, 0.25);
});

test("scoreMaterialsAgainstWeakTopics sorts descending by summed (1 - accuracy)", () => {
  const weakTopics = [
    { topicId: "cellular_networks", accuracy: 0.2 },
    { topicId: "wireless_communication", accuracy: 0.4 },
  ];

  const materials = [
    {
      _id: "m1",
      title: "Cellular Basics",
      topicTags: [{ topicId: "cellular_networks", confidence: 0.9 }],
    },
    {
      _id: "m2",
      title: "Wireless + Cellular Overview",
      topicTags: [
        { topicId: "cellular_networks", confidence: 0.8 },
        { topicId: "wireless_communication", confidence: 0.8 },
      ],
    },
  ];

  const topicNameMap = new Map([
    ["cellular_networks", "Cellular Networks"],
    ["wireless_communication", "Wireless Communication"],
  ]);

  const out = scoreMaterialsAgainstWeakTopics({
    materials,
    weakTopics,
    topicNameMap,
    limit: 5,
  });

  assert.equal(out.length, 2);
  assert.equal(out[0].materialId, "m2");
  assert.ok(out[0].matchScore > out[1].matchScore);
  assert.deepEqual(out[0].matchedTopics, ["Cellular Networks", "Wireless Communication"]);
});

test("scoreMaterialsAgainstWeakTopics excludes empty topicTags (fallback-only eligibility)", () => {
  const out = scoreMaterialsAgainstWeakTopics({
    materials: [
      { _id: "m1", title: "No Tags", topicTags: [] },
      { _id: "m2", title: "Missing Tags" },
    ],
    weakTopics: [{ topicId: "cellular_networks", accuracy: 0.2 }],
    topicNameMap: new Map([["cellular_networks", "Cellular Networks"]]),
    limit: 5,
  });

  assert.equal(out.length, 0);
});

test("buildCourseFallbackRecommendations returns course-level materials up to limit", () => {
  const out = buildCourseFallbackRecommendations(
    [
      { _id: "m1", title: "Older", updatedAt: "2023-01-01T00:00:00.000Z" },
      { _id: "m2", title: "Newer", updatedAt: "2024-01-01T00:00:00.000Z" },
    ],
    1
  );

  assert.equal(out.length, 1);
  assert.equal(out[0].materialId, "m2");
  assert.equal(out[0].matchScore, 0);
  assert.deepEqual(out[0].matchedTopics, []);
});

test("canRequesterAccessRecommendations enforces self-or-admin authorization", () => {
  const sameUser = canRequesterAccessRecommendations({
    requester: { _id: "user1", role: "student" },
    targetUserId: "user1",
  });
  const admin = canRequesterAccessRecommendations({
    requester: { _id: "admin1", role: "admin" },
    targetUserId: "user2",
  });
  const denied = canRequesterAccessRecommendations({
    requester: { _id: "user1", role: "student" },
    targetUserId: "user2",
  });

  assert.equal(sameUser, true);
  assert.equal(admin, true);
  assert.equal(denied, false);
});
