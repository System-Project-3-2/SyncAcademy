import Course from "../models/courseModel.js";
import Material from "../models/materialModel.js";
import TopicMastery from "../models/topicMasteryModel.js";
import TopicTaxonomy from "../models/topicTaxonomyModel.js";
import { normalizeTopicTags } from "../utils/topicTagValidation.js";
import { rankTopRecommendations } from "../utils/ktMasteryEngine.js";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

export const normalizeTopicName = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value ?? 0)));

const toSafeLimit = (value) => {
  const parsed = Number(value || DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(Math.floor(parsed), MAX_LIMIT));
};

const toStableDisplayTopic = (topicId, topicNameMap = new Map()) =>
  topicNameMap.get(topicId) || String(topicId || "");

export const canRequesterAccessRecommendations = ({ requester, targetUserId }) => {
  if (!requester?._id || !targetUserId) return false;
  if (String(requester.role || "").toLowerCase() === "admin") return true;
  return String(requester._id) === String(targetUserId);
};

export const extractWeakTopics = (masteryRows = []) => {
  return masteryRows
    .filter((row) => {
      const masteryScore = Number(row?.masteryScore ?? 1);
      const attempts = Number(row?.stats?.attempts ?? 0);
      return masteryScore < 0.5 && attempts >= 3;
    })
    .map((row) => ({
      topicId: String(row.topicId || ""),
      accuracy: clamp01(row.masteryScore),
    }));
};

export const buildCourseFallbackRecommendations = (materials = [], limit = DEFAULT_LIMIT) => {
  const safeLimit = toSafeLimit(limit);

  return [...materials]
    .sort((a, b) => {
      const left = new Date(b.updatedAt || b.createdAt || 0).getTime();
      const right = new Date(a.updatedAt || a.createdAt || 0).getTime();
      return left - right;
    })
    .slice(0, safeLimit)
    .map((material) => ({
      materialId: String(material._id),
      title: material.title || material.courseTitle || "Untitled material",
      matchScore: 0,
      matchedTopics: [],
    }));
};

export const scoreMaterialsAgainstWeakTopics = ({
  materials = [],
  weakTopics = [],
  topicNameMap = new Map(),
  limit = DEFAULT_LIMIT,
}) => {
  const safeLimit = toSafeLimit(limit);
  const weakByKey = new Map(
    weakTopics.map((topic) => [normalizeTopicName(topic.topicId), topic])
  );

  const candidates = [];

  for (const material of materials) {
    const tags = normalizeTopicTags(material.topicTags || []);
    // Materials with no tags are intentionally excluded from topic-matching
    // and can only appear in course-level fallback recommendations.
    if (!tags.length) continue;

    let score = 0;
    const matchedTopics = [];
    const matchedTopicSet = new Set();

    for (const tag of tags) {
      const key = normalizeTopicName(tag.topicId);
      const weakTopic = weakByKey.get(key);
      if (!weakTopic) continue;

      score += 1 - clamp01(weakTopic.accuracy);
      if (!matchedTopicSet.has(weakTopic.topicId)) {
        matchedTopicSet.add(weakTopic.topicId);
        matchedTopics.push(toStableDisplayTopic(weakTopic.topicId, topicNameMap));
      }
    }

    if (score <= 0 || !matchedTopics.length) continue;

    candidates.push({
      materialId: String(material._id),
      title: material.title || material.courseTitle || "Untitled material",
      score,
      matchedTopics,
    });
  }

  const ranked = rankTopRecommendations({ candidates, topN: safeLimit });
  return ranked.map((item) => ({
    materialId: item.materialId,
    title: item.title,
    matchScore: Number(item.score.toFixed(4)),
    matchedTopics: item.matchedTopics,
  }));
};

export const getTopicBasedRecommendations = async ({ userId, courseId, limit = DEFAULT_LIMIT }) => {
  const safeLimit = toSafeLimit(limit);

  const course = await Course.findById(courseId).select("courseNo").lean();
  if (!course?.courseNo) {
    const error = new Error("Course not found");
    error.status = 404;
    throw error;
  }

  const [masteryRows, materials] = await Promise.all([
    TopicMastery.find({ student: userId, course: courseId })
      .select("topicId masteryScore stats.attempts")
      .lean(),
    Material.find({ courseNo: course.courseNo })
      .select("title courseTitle topicTags updatedAt createdAt")
      .lean(),
  ]);

  const weakTopicRows = extractWeakTopics(masteryRows);
  const weakTopicIds = [...new Set(weakTopicRows.map((row) => row.topicId).filter(Boolean))];

  const taxonomyRows = weakTopicIds.length
    ? await TopicTaxonomy.find({
        course: courseId,
        status: "active",
        topicId: { $in: weakTopicIds },
      })
        .select("topicId topicName")
        .lean()
    : [];

  const topicNameMap = new Map();
  for (const row of taxonomyRows) {
    if (!topicNameMap.has(row.topicId)) {
      topicNameMap.set(row.topicId, row.topicName);
    }
  }

  const weakTopics = weakTopicRows.map((row) => ({
    topic: toStableDisplayTopic(row.topicId, topicNameMap),
    accuracy: Number(row.accuracy.toFixed(4)),
  }));

  if (!weakTopicRows.length) {
    return {
      recommendations: buildCourseFallbackRecommendations(materials, safeLimit),
      weakTopics,
    };
  }

  const recommendations = scoreMaterialsAgainstWeakTopics({
    materials,
    weakTopics: weakTopicRows,
    topicNameMap,
    limit: safeLimit,
  });

  if (!recommendations.length) {
    return {
      recommendations: buildCourseFallbackRecommendations(materials, safeLimit),
      weakTopics,
    };
  }

  return {
    recommendations,
    weakTopics,
  };
};
