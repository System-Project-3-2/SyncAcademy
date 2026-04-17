import LearningEvent from "../models/learningEventModel.js";
import TopicMastery from "../models/topicMasteryModel.js";
import Material from "../models/materialModel.js";
import Course from "../models/courseModel.js";
import mongoose from "mongoose";
import { predictTopicMastery } from "../services/ktModelService.js";
import { buildFeatureRows, summarizeFeatureRows } from "../utils/ktFeaturePipeline.js";
import {
  applyTemporalSmoothing,
  deriveWeaknessReasonCodes,
  buildMaterialRecommendation,
  rankTopRecommendations,
  clamp01,
} from "../utils/ktMasteryEngine.js";
import {
  buildTabularGlobalExplanation,
  buildTabularLocalExplanation,
  buildSequenceContributionTrace,
  summarizeRecommendationDrivers,
  buildTopActionSummary,
} from "../utils/ktExplainability.js";


const ALLOWED_SOURCE_TYPES = ["quiz", "assignment", "material", "hint"];
const ALLOWED_EVENT_TYPES = [
  "question_attempt",
  "assignment_attempt",
  "material_view",
  "material_download",
  "hint_used",
];
const ALLOWED_DIFFICULTIES = ["easy", "medium", "hard", "unknown"];
const ATTEMPT_EVENT_TYPES = new Set(["question_attempt", "assignment_attempt"]);

const hasValue = (value) => value !== undefined && value !== null && value !== "";

const parseNumberOrNull = (value) => {
  if (!hasValue(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseBooleanOrNull = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return null;
};

const parseDateOrNull = (value) => {
  if (!hasValue(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeDifficulty = (value) => {
  if (!hasValue(value)) return "unknown";
  const normalized = String(value).trim().toLowerCase();
  return ALLOWED_DIFFICULTIES.includes(normalized) ? normalized : null;
};

const normalizeEventPayload = (payload = {}) => {
  const eventType = String(payload.eventType || "").trim();
  const isAttempt = ATTEMPT_EVENT_TYPES.has(eventType);
  const normalizedScore = parseNumberOrNull(payload.normalizedScore);
  const parsedIsCorrect = parseBooleanOrNull(payload.isCorrect);

  const derivedIsCorrect =
    parsedIsCorrect != null
      ? parsedIsCorrect
      : isAttempt && normalizedScore != null
        ? normalizedScore >= 0.5
        : null;

  const eventTimestampRaw = payload.eventTimestamp ?? payload.timestamp;

  return {
    ...payload,
    topicId: String(payload.topicId || "").trim(),
    sourceType: String(payload.sourceType || "").trim(),
    eventType,
    isCorrect: derivedIsCorrect,
    normalizedScore,
    difficulty: normalizeDifficulty(payload.difficulty),
    timeSpentSec: parseNumberOrNull(payload.timeSpentSec ?? payload.timeTaken),
    responseLatencySec: parseNumberOrNull(payload.responseLatencySec),
    attemptNo: parseNumberOrNull(payload.attemptNo ?? payload.attemptIndex),
    hintUsed: parseBooleanOrNull(payload.hintUsed),
    explanationViewed: parseBooleanOrNull(payload.explanationViewed),
    materialTopicMatchScore: parseNumberOrNull(payload.materialTopicMatchScore),
    eventTimestampRaw,
    parsedEventTimestamp: parseDateOrNull(eventTimestampRaw),
  };
};


const validateEventPayload = (body) => {
  const normalized = normalizeEventPayload(body);

  const required = ["courseId", "topicId", "sourceType", "eventType"];
  for (const key of required) {
    if (!hasValue(normalized[key])) return `Missing required field: ${key}`;
  }

  if (!ALLOWED_SOURCE_TYPES.includes(normalized.sourceType)) {
    return "sourceType must be one of quiz, assignment, material, hint";
  }

  if (!ALLOWED_EVENT_TYPES.includes(normalized.eventType)) {
    return "eventType must be one of question_attempt, assignment_attempt, material_view, material_download, hint_used";
  }

  if (hasValue(body.isCorrect) && normalized.isCorrect == null) {
    return "isCorrect must be a boolean";
  }

  if (hasValue(body.hintUsed) && normalized.hintUsed == null) {
    return "hintUsed must be a boolean";
  }

  if (hasValue(body.difficulty) && normalized.difficulty == null) {
    return "difficulty must be one of easy, medium, hard, unknown";
  }

  if (hasValue(body.eventTimestamp) || hasValue(body.timestamp)) {
    if (!normalized.parsedEventTimestamp) {
      return "eventTimestamp/timestamp must be a valid date";
    }
  }

  if (hasValue(body.timeSpentSec) || hasValue(body.timeTaken)) {
    if (normalized.timeSpentSec == null) {
      return "timeSpentSec must be a valid number";
    }
  }

  if (normalized.normalizedScore != null && (normalized.normalizedScore < 0 || normalized.normalizedScore > 1)) {
    return "normalizedScore must be between 0 and 1";
  }

  if (normalized.timeSpentSec != null && normalized.timeSpentSec < 0) {
    return "timeSpentSec must be >= 0";
  }

  if (ATTEMPT_EVENT_TYPES.has(normalized.eventType)) {
    if (!hasValue(body.difficulty)) {
      return "question_attempt/assignment_attempt requires difficulty";
    }
    if (!hasValue(body.timeSpentSec) && !hasValue(body.timeTaken)) {
      return "question_attempt/assignment_attempt requires timeSpentSec";
    }
    if (!hasValue(body.hintUsed)) {
      return "question_attempt/assignment_attempt requires hintUsed";
    }
    if (normalized.isCorrect == null && normalized.normalizedScore == null) {
      return "question_attempt/assignment_attempt requires isCorrect or normalizedScore";
    }
  }

  return null;
};

const toEventDoc = (payload, studentId) => {
  const normalized = normalizeEventPayload(payload);

  return {
    student: studentId,
    course: payload.courseId,
    topicId: normalized.topicId,
    subtopicId: payload.subtopicId || "",
    sourceType: normalized.sourceType,
    sourceId: payload.sourceId || null,
    questionId: payload.questionId || null,
    eventType: normalized.eventType,
    isCorrect: normalized.isCorrect,
    rawScore: payload.rawScore ?? null,
    normalizedScore: normalized.normalizedScore,
    difficulty: normalized.difficulty || "unknown",
    timeSpentSec: normalized.timeSpentSec ?? 0,
    responseLatencySec: normalized.responseLatencySec ?? 0,
    attemptNo: Math.max(1, Math.round(normalized.attemptNo ?? 1)),
    hintUsed: normalized.hintUsed ?? false,
    explanationViewed: normalized.explanationViewed ?? false,
    materialId: payload.materialId || null,
    materialType: payload.materialType || "",
    materialTopicMatchScore: clamp01(normalized.materialTopicMatchScore ?? 0),
    eventTimestamp: normalized.parsedEventTimestamp || new Date(),
    metadata: payload.metadata || {},
  };
};

const paginateItems = (items, page = 1, limit = 10) => {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.max(1, Math.min(Number(limit || 10), 100));
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / safeLimit));
  const start = (safePage - 1) * safeLimit;
  const data = items.slice(start, start + safeLimit);

  return {
    data,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages,
    },
  };
};

const buildConfidenceBands = (items) => {
  const high = [];
  const medium = [];
  const low = [];

  items.forEach((item) => {
    const value = Number(item.confidence || 0);
    if (value >= 0.75) high.push(item.topicId);
    else if (value >= 0.5) medium.push(item.topicId);
    else low.push(item.topicId);
  });

  return { high, medium, low };
};

const enrichWeakTopics = (items) =>
  items.map((item) => ({
    ...item,
    reasonCodes: deriveWeaknessReasonCodes({
      masteryScore: item.masteryScore,
      confidence: item.confidence,
      stats: item.stats || {},
    }),
  }));

const buildRecommendationsForCourse = ({ materials, weakTopics, topicLimit = 3, perTopic = 3, topN = 3 }) => {
  const seenMaterialIds = new Set();
  const recommendations = [];

  for (const topic of weakTopics.slice(0, topicLimit)) {
    const ranked = materials
      .map((m) =>
        buildMaterialRecommendation({
          material: m,
          topic,
          seenMaterialIds,
        })
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, perTopic)
      .map((item) => {
        seenMaterialIds.add(String(item.materialId));
        return item;
      });

    recommendations.push(...ranked);
  }

  return rankTopRecommendations({
    candidates: recommendations,
    topN,
  });
};

export const logLearningEvent = async (req, res) => {
  try {
    const error = validateEventPayload(req.body);
    if (error) return res.status(400).json({ message: error });

    const event = await LearningEvent.create(toEventDoc(req.body, req.user._id));

    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const logLearningEventsBulk = async (req, res) => {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    if (!events.length) {
      return res.status(400).json({ message: "events array is required" });
    }

    const normalized = [];
    const rejected = [];

    events.forEach((event, index) => {
      const error = validateEventPayload(event || {});
      if (error) {
        rejected.push({ index, message: error });
      } else {
        normalized.push(toEventDoc(event, req.user._id));
      }
    });

    let inserted = [];
    if (normalized.length) {
      inserted = await LearningEvent.insertMany(normalized, { ordered: false });
    }

    res.status(201).json({
      insertedCount: inserted.length,
      rejectedCount: rejected.length,
      rejected,
      insertedIds: inserted.map((e) => e._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getFeatureSnapshot = async (req, res) => {
  try {
    const { courseId } = req.params;
    const topicId = req.query.topicId ? String(req.query.topicId) : null;
    const limit = Math.max(10, Math.min(Number(req.query.limit || 250), 2000));

    const filter = {
      student: req.user._id,
      course: courseId,
    };
    if (topicId) filter.topicId = topicId;

    const events = await LearningEvent.find(filter)
      .sort({ eventTimestamp: -1 })
      .limit(limit)
      .lean();

    const rows = buildFeatureRows([...events].reverse());

    res.json({
      courseId,
      topicId,
      eventsConsidered: events.length,
      summary: summarizeFeatureRows(rows),
      rows,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const predictMyTopicMastery = async (req, res) => {
  try {
    const { courseId, topicId } = req.body;
    if (!courseId || !topicId) {
      return res.status(400).json({ message: "courseId and topicId are required" });
    }

    const previous = await TopicMastery.findOne({
      student: req.user._id,
      course: courseId,
      topicId,
    }).lean();

    const prediction = await predictTopicMastery({
      studentId: req.user._id,
      courseId,
      topicId,
    });

    const smoothing = applyTemporalSmoothing({
      previousMastery: previous?.masteryScore,
      modelProbability: prediction.masteryScore,
    });

    const finalMastery = smoothing.smoothedMastery;
    const finalWeakness = clamp01(1 - finalMastery);
    const confidence = clamp01(prediction.confidence ?? 0);
    const reasonCodes = deriveWeaknessReasonCodes({
      masteryScore: finalMastery,
      confidence,
      stats: prediction.stats || {},
    });

    const explanation = {
      ...(prediction.explanation || {}),
      reasonCodes,
      smoothing: {
        previousMastery: smoothing.previousMastery,
        rawModelProbability: smoothing.rawModelProbability,
        alpha: smoothing.alpha,
      },
    };

    const upserted = await TopicMastery.findOneAndUpdate(
      { student: req.user._id, course: courseId, topicId },
      {
        student: req.user._id,
        course: courseId,
        topicId,
        masteryScore: finalMastery,
        weaknessScore: finalWeakness,
        confidence,
        modelVersion: prediction.modelVersion,
        sourceModelType: prediction.sourceModelType,
        lastPredictionAt: new Date(),
        stats: prediction.stats || {},
        explanation,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json(upserted);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyMasteryByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const items = await TopicMastery.find({
      student: req.user._id,
      course: courseId,
    })
      .sort({ weaknessScore: -1, topicId: 1 })
      .lean();

    const withReasons = items.map((item) => ({
      ...item,
      reasonCodes: deriveWeaknessReasonCodes({
        masteryScore: item.masteryScore,
        confidence: item.confidence,
        stats: item.stats || {},
      }),
    }));

    res.json(withReasons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyWeakTopics = async (req, res) => {
  try {
    const { courseId } = req.params;
    const limit = Math.max(1, Math.min(Number(req.query.limit || 5), 20));

    const items = await TopicMastery.find({
      student: req.user._id,
      course: courseId,
    })
      .sort({ weaknessScore: -1, confidence: -1 })
      .limit(limit)
      .lean();

    const enriched = enrichWeakTopics(items);

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyMaterialRecommendations = async (req, res) => {
  try {
    const { courseId } = req.params;
    const topicLimit = Math.max(1, Math.min(Number(req.query.topicLimit || 3), 10));
    const perTopic = Math.max(1, Math.min(Number(req.query.perTopic || 3), 5));
    const topN = Math.max(1, Math.min(Number(req.query.topN || 3), 10));
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(Number(req.query.limit || topN), 20));

    const weakTopics = await TopicMastery.find({
      student: req.user._id,
      course: courseId,
    })
      .sort({ weaknessScore: -1, confidence: -1 })
      .limit(topicLimit)
      .lean();

    if (!weakTopics.length) {
      return res.json({
        weakTopics: [],
        recommendations: [],
        message: "No mastery records found yet. Trigger prediction after collecting events.",
      });
    }

    const course = await Course.findById(courseId).select("courseNo").lean();
    if (!course?.courseNo) {
      return res.status(404).json({ message: "Course not found" });
    }

    const materials = await Material.find({ courseNo: course.courseNo })
      .select("title type fileUrl textContent courseNo courseTitle topicTags")
      .lean();

    const topRecommendations = buildRecommendationsForCourse({
      materials,
      weakTopics,
      topicLimit,
      perTopic,
      topN,
    });

    const weakTopicsWithReasons = enrichWeakTopics(weakTopics);
    const pagedRecommendations = paginateItems(topRecommendations, page, limit);

    res.json({
      weakTopics: weakTopicsWithReasons,
      recommendations: pagedRecommendations.data,
      pagination: pagedRecommendations.pagination,
      metadata: {
        topN,
        topicLimit,
        perTopic,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const runBackfillMasteryForCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const parsedCourseId = new mongoose.Types.ObjectId(courseId);

    const topics = await LearningEvent.aggregate([
      { $match: { student: req.user._id, course: parsedCourseId } },
      { $group: { _id: "$topicId" } },
      { $project: { _id: 0, topicId: "$_id" } },
    ]);

    const results = [];
    for (const row of topics) {
      const previous = await TopicMastery.findOne({
        student: req.user._id,
        course: courseId,
        topicId: row.topicId,
      }).lean();

      const prediction = await predictTopicMastery({
        studentId: req.user._id,
        courseId,
        topicId: row.topicId,
      });

      const smoothing = applyTemporalSmoothing({
        previousMastery: previous?.masteryScore,
        modelProbability: prediction.masteryScore,
      });

      const finalMastery = smoothing.smoothedMastery;
      const finalWeakness = clamp01(1 - finalMastery);
      const confidence = clamp01(prediction.confidence ?? 0);
      const reasonCodes = deriveWeaknessReasonCodes({
        masteryScore: finalMastery,
        confidence,
        stats: prediction.stats || {},
      });

      const explanation = {
        ...(prediction.explanation || {}),
        reasonCodes,
        smoothing: {
          previousMastery: smoothing.previousMastery,
          rawModelProbability: smoothing.rawModelProbability,
          alpha: smoothing.alpha,
        },
      };

      const record = await TopicMastery.findOneAndUpdate(
        { student: req.user._id, course: courseId, topicId: row.topicId },
        {
          student: req.user._id,
          course: courseId,
          topicId: row.topicId,
          masteryScore: finalMastery,
          weaknessScore: finalWeakness,
          confidence,
          modelVersion: prediction.modelVersion,
          sourceModelType: prediction.sourceModelType,
          lastPredictionAt: new Date(),
          stats: prediction.stats || {},
          explanation,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();

      results.push(record);
    }

    res.json({
      courseId,
      totalTopics: topics.length,
      updated: results.length,
      items: results,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyLearningInsights = async (req, res) => {
  try {
    const { courseId } = req.params;
    const weakLimit = Math.max(1, Math.min(Number(req.query.weakLimit || 5), 20));
    const recommendationTopN = Math.max(1, Math.min(Number(req.query.topN || 3), 20));
    const recommendationPage = Math.max(1, Number(req.query.page || 1));
    const recommendationLimit = Math.max(1, Math.min(Number(req.query.limit || recommendationTopN), 20));
    const perTopic = Math.max(1, Math.min(Number(req.query.perTopic || 3), 5));

    const [course, allTopics] = await Promise.all([
      Course.findById(courseId).select("courseNo courseTitle").lean(),
      TopicMastery.find({ student: req.user._id, course: courseId })
        .sort({ weaknessScore: -1, confidence: -1 })
        .lean(),
    ]);

    if (!course?.courseNo) {
      return res.status(404).json({ message: "Course not found" });
    }

    const weakTopics = enrichWeakTopics(allTopics.slice(0, weakLimit));

    const materials = await Material.find({ courseNo: course.courseNo })
      .select("title type fileUrl textContent courseNo courseTitle topicTags")
      .lean();

    const allRecommendations = buildRecommendationsForCourse({
      materials,
      weakTopics,
      topicLimit: weakLimit,
      perTopic,
      topN: recommendationTopN,
    });
    const pagedRecommendations = paginateItems(allRecommendations, recommendationPage, recommendationLimit);

    const avgMastery = allTopics.length
      ? allTopics.reduce((acc, row) => acc + Number(row.masteryScore || 0), 0) / allTopics.length
      : 0;
    const avgConfidence = allTopics.length
      ? allTopics.reduce((acc, row) => acc + Number(row.confidence || 0), 0) / allTopics.length
      : 0;

    const payload = {
      course: {
        courseId,
        courseNo: course.courseNo,
        courseTitle: course.courseTitle,
      },
      generatedAt: new Date().toISOString(),
      masterySummary: {
        totalTopics: allTopics.length,
        overallMastery: Number(avgMastery.toFixed(4)),
        overallWeakness: Number((1 - avgMastery).toFixed(4)),
        averageConfidence: Number(avgConfidence.toFixed(4)),
        highRiskTopics: allTopics.filter((row) => Number(row.weaknessScore || 0) >= 0.65).length,
      },
      confidenceBands: buildConfidenceBands(allTopics),
      weakTopics: {
        items: weakTopics,
        pagination: {
          page: 1,
          limit: weakLimit,
          total: allTopics.length,
          pages: Math.max(1, Math.ceil(allTopics.length / weakLimit)),
        },
      },
      recommendations: {
        items: pagedRecommendations.data,
        pagination: pagedRecommendations.pagination,
      },
      explanationDetails: {
        weakTopicReasonCodes: weakTopics.map((item) => ({
          topicId: item.topicId,
          reasonCodes: item.reasonCodes || [],
        })),
      },
    };

    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyExplainabilityByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const weakLimit = Math.max(1, Math.min(Number(req.query.weakLimit || 5), 20));
    const recommendationTopN = Math.max(1, Math.min(Number(req.query.topN || 3), 20));
    const perTopic = Math.max(1, Math.min(Number(req.query.perTopic || 3), 5));
    const traceLimit = Math.max(4, Math.min(Number(req.query.traceLimit || 12), 40));

    const [course, masteryRows] = await Promise.all([
      Course.findById(courseId).select("courseNo courseTitle").lean(),
      TopicMastery.find({ student: req.user._id, course: courseId })
        .sort({ weaknessScore: -1, confidence: -1 })
        .lean(),
    ]);

    if (!course?.courseNo) {
      return res.status(404).json({ message: "Course not found" });
    }

    const weakTopics = enrichWeakTopics(masteryRows.slice(0, weakLimit));
    const materials = await Material.find({ courseNo: course.courseNo })
      .select("title type fileUrl textContent courseNo courseTitle topicTags")
      .lean();

    const recommendations = buildRecommendationsForCourse({
      materials,
      weakTopics,
      topicLimit: weakLimit,
      perTopic,
      topN: recommendationTopN,
    });

    const recentEvents = await LearningEvent.find({
      student: req.user._id,
      course: courseId,
      eventType: { $in: ["question_attempt", "assignment_attempt"] },
    })
      .sort({ eventTimestamp: -1 })
      .limit(200)
      .lean();

    const chronologicalEvents = [...recentEvents].reverse();
    const sequenceTraces = weakTopics.slice(0, 3).map((topic) =>
      buildSequenceContributionTrace({
        events: chronologicalEvents,
        topicId: topic.topicId,
        limit: traceLimit,
      })
    );

    const localTabular = weakTopics.map((row) => buildTabularLocalExplanation(row));
    const globalTabular = buildTabularGlobalExplanation(masteryRows);
    const recommendationExplanations = summarizeRecommendationDrivers(recommendations, weakTopics);
    const topActions = buildTopActionSummary(sequenceTraces);

    res.json({
      course: {
        courseId,
        courseNo: course.courseNo,
        courseTitle: course.courseTitle,
      },
      generatedAt: new Date().toISOString(),
      modelHints: {
        tabular: "shap_style_proxy",
        sequence: "attention_like_recency_trace",
      },
      tabularExplainability: {
        global: globalTabular,
        local: localTabular,
      },
      sequenceExplainability: {
        traces: sequenceTraces,
      },
      recommendationExplainability: recommendationExplanations,
      topContributingActions: topActions,
      metadata: {
        weakTopicsAnalyzed: weakTopics.length,
        recommendationsAnalyzed: recommendations.length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
