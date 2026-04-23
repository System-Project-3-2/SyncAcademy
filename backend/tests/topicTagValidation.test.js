import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTopicName,
  toTopicSlug,
  normalizeTopicTags,
} from "../utils/topicTagValidation.js";

test("normalizeTopicName lowercases and strips punctuation", () => {
  const out = normalizeTopicName("  Cellular Networks!!  ");
  assert.equal(out, "cellular networks");
});

test("toTopicSlug produces stable kebab-case slug", () => {
  const out = toTopicSlug("Wireless_Communication Basics");
  assert.equal(out, "wireless-communication-basics");
});

test("normalizeTopicTags deduplicates by topic+subtopic and keeps strongest confidence", () => {
  const out = normalizeTopicTags([
    { topicId: "cellular-networks", subtopicId: "", confidence: 0.4, source: "auto" },
    { topicId: "cellular-networks", subtopicId: "", confidence: 0.9, source: "manual" },
  ]);

  assert.equal(out.length, 1);
  assert.equal(out[0].topicId, "cellular-networks");
  assert.equal(out[0].confidence, 0.9);
});
