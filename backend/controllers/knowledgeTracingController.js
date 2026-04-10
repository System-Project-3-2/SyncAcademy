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


const validateEventPayload = (body) => {
  const required = ["courseId", "topicId", "sourceType", "eventType"];
  for (const key of required) {
    if (!body[key]) return `Missing required field: ${key}`;
  }

  if (!["quiz", "assignment", "material", "hint"].includes(body.sourceType)) {
    return "sourceType must be one of quiz, assignment, material, hint";
  }

  if (
    (body.eventType === "question_attempt" || body.eventType === "assignment_attempt") &&
    typeof body.isCorrect !== "boolean" &&
    typeof body.normalizedScore !== "number"
  ) {
    return "question_attempt/assignment_attempt requires isCorrect or normalizedScore";
  }

  if (body.normalizedScore != null && (body.normalizedScore < 0 || body.normalizedScore > 1)) {
    return "normalizedScore must be between 0 and 1";
  }

  if (body.timeSpentSec != null && body.timeSpentSec < 0) {
    return "timeSpentSec must be >= 0";
  }

  return null;
};

const toEventDoc = (payload, studentId) => ({
  student: studentId,
  course: payload.courseId,
  topicId: payload.topicId,
  subtopicId: payload.subtopicId || "",
  sourceType: payload.sourceType,
  sourceId: payload.sourceId || null,
  questionId: payload.questionId || null,
  eventType: payload.eventType,
  isCorrect: typeof payload.isCorrect === "boolean" ? payload.isCorrect : null,
  rawScore: payload.rawScore ?? null,
  normalizedScore: payload.normalizedScore ?? null,
  difficulty: payload.difficulty || "unknown",
  timeSpentSec: Number(payload.timeSpentSec || payload.timeTaken || 0),
  responseLatencySec: Number(payload.responseLatencySec || 0),
  attemptNo: Number(payload.attemptNo || payload.attemptIndex || 1),
  hintUsed: Boolean(payload.hintUsed),
  explanationViewed: Boolean(payload.explanationViewed),
  materialId: payload.materialId || null,
  materialType: payload.materialType || "",
  materialTopicMatchScore: Number(payload.materialTopicMatchScore || 0),
  eventTimestamp: payload.eventTimestamp || payload.timestamp
    ? new Date(payload.eventTimestamp || payload.timestamp)
    : new Date(),
  metadata: payload.metadata || {},
});

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

    const enriched = items.map((item) => ({
      ...item,
      reasonCodes: deriveWeaknessReasonCodes({
        masteryScore: item.masteryScore,
        confidence: item.confidence,
        stats: item.stats || {},
      }),
    }));

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

    const seenMaterialIds = new Set();
    const recommendations = [];

    for (const topic of weakTopics) {
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

    const topRecommendations = rankTopRecommendations({
      candidates: recommendations,
      topN,
    });

    const weakTopicsWithReasons = weakTopics.map((item) => ({
      ...item,
      reasonCodes: deriveWeaknessReasonCodes({
        masteryScore: item.masteryScore,
        confidence: item.confidence,
        stats: item.stats || {},
      }),
    }));

    res.json({
      weakTopics: weakTopicsWithReasons,
      recommendations: topRecommendations,
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
