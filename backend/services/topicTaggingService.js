import TopicAlias from "../models/topicAliasModel.js";
import TopicTaxonomy from "../models/topicTaxonomyModel.js";
import { normalizeTopicTags } from "../utils/topicTagValidation.js";

const normalizeText = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const countOccurrences = (haystack, needle) => {
  if (!haystack || !needle) return 0;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = haystack.match(new RegExp(`\\b${escaped}\\b`, "g"));
  return match ? match.length : 0;
};

const buildAliasCandidates = async (courseId) => {
  const [taxonomyRows, aliasRows] = await Promise.all([
    TopicTaxonomy.find({ course: courseId, status: "active" }).lean(),
    TopicAlias.find({ $or: [{ course: null }, { course: courseId }] }).lean(),
  ]);

  const generatedAliases = taxonomyRows.flatMap((row) => {
    const base = [row.topicName, row.topicId, row.subtopicName, row.subtopicId]
      .filter(Boolean)
      .map((item) => normalizeText(item));

    return base.map((alias) => ({
      alias,
      normalizedAlias: alias,
      topicId: row.topicId,
      subtopicId: row.subtopicId || "",
      confidence: 0.7,
      source: "taxonomy",
    }));
  });

  const explicitAliases = aliasRows.map((row) => ({
    alias: row.alias,
    normalizedAlias: row.normalizedAlias,
    topicId: row.topicId,
    subtopicId: row.subtopicId || "",
    confidence: Number(row.confidence || 0.8),
    source: row.source,
  }));

  const mergedMap = new Map();
  for (const item of [...generatedAliases, ...explicitAliases]) {
    if (!item.normalizedAlias) continue;
    const key = `${item.normalizedAlias}::${item.topicId}::${item.subtopicId}`;
    const existing = mergedMap.get(key);
    if (!existing || item.confidence > existing.confidence) {
      mergedMap.set(key, item);
    }
  }

  return [...mergedMap.values()];
};

const mergeGeneratedWithExisting = (existingTags = [], generatedTags = []) => {
  const normalizedExisting = normalizeTopicTags(existingTags);
  const normalizedGenerated = normalizeTopicTags(generatedTags);

  const map = new Map();

  for (const tag of normalizedExisting) {
    const key = `${tag.topicId}::${tag.subtopicId}`;
    map.set(key, tag);
  }

  for (const tag of normalizedGenerated) {
    const key = `${tag.topicId}::${tag.subtopicId}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, tag);
      continue;
    }

    if (existing.source === "manual") {
      continue;
    }

    if (tag.confidence >= existing.confidence) {
      map.set(key, tag);
    }
  }

  return [...map.values()];
};

export const inferTopicTagsFromText = async ({ text, courseId, limit = 5, taggedBy = null }) => {
  const normalized = normalizeText(text);
  if (!normalized) {
    return {
      tags: [],
      ambiguous: false,
      candidates: [],
    };
  }

  const aliases = await buildAliasCandidates(courseId);
  const candidates = aliases
    .map((item) => {
      const occurrences = countOccurrences(normalized, item.normalizedAlias);
      if (occurrences === 0) return null;

      const score = Math.min(0.98, item.confidence + Math.min(0.2, occurrences * 0.05));
      return {
        topicId: item.topicId,
        subtopicId: item.subtopicId || "",
        score,
        alias: item.normalizedAlias,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  const byTopic = new Map();
  for (const row of candidates) {
    const key = `${row.topicId}::${row.subtopicId}`;
    if (!byTopic.has(key) || row.score > byTopic.get(key).score) {
      byTopic.set(key, row);
    }
  }

  const top = [...byTopic.values()].sort((a, b) => b.score - a.score).slice(0, limit);

  const tags = top.map((item) => ({
    topicId: item.topicId,
    subtopicId: item.subtopicId,
    confidence: Number(item.score.toFixed(4)),
    source: "auto",
    taggedBy,
    taggedAt: new Date(),
  }));

  const ambiguous = top.length >= 2 && top[0].score - top[1].score < 0.1;

  return {
    tags,
    ambiguous,
    candidates: top,
  };
};

export const mergeTopicTags = ({ existingTags = [], generatedTags = [] }) =>
  mergeGeneratedWithExisting(existingTags, generatedTags);
