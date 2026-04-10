import LearningEvent from "../models/learningEventModel.js";
import TopicMastery from "../models/topicMasteryModel.js";
import Material from "../models/materialModel.js";
import Course from "../models/courseModel.js";
import mongoose from "mongoose";
import { predictTopicMastery } from "../services/ktModelService.js";

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const scoreMaterial = ({ material, weaknessScore, topicId, seenMaterialIds }) => {
  const topic = String(topicId || "").toLowerCase();
  const title = String(material.title || "").toLowerCase();
  const text = String(material.textContent || "").toLowerCase();

  const hasTopicInTitle = topic && title.includes(topic) ? 1 : 0;
  const hasTopicInText = topic && text.includes(topic) ? 1 : 0;

  const relevance = hasTopicInTitle ? 1 : hasTopicInText ? 0.7 : 0.35;
  const noveltyPenalty = seenMaterialIds.has(String(material._id)) ? 0.2 : 0;

  const finalScore = clamp01(0.55 * weaknessScore + 0.35 * relevance - 0.1 * noveltyPenalty);

  const reasonParts = [];
  if (weaknessScore >= 0.6) reasonParts.push("high weakness on this topic");
  if (hasTopicInTitle) reasonParts.push("topic appears in material title");
  else if (hasTopicInText) reasonParts.push("topic appears in material content");
  if (reasonParts.length === 0) reasonParts.push("selected as supportive material for the weak topic");

  return {
    material,
    score: Number(finalScore.toFixed(4)),
    reason: reasonParts.join(", "),
  };
};

const validateEventPayload = (body) => {
  const required = ["courseId", "topicId", "sourceType", "eventType"];
  for (const key of required) {
    if (!body[key]) return `Missing required field: ${key}`;
  }

  if (body.normalizedScore != null && (body.normalizedScore < 0 || body.normalizedScore > 1)) {
    return "normalizedScore must be between 0 and 1";
  }

  if (body.timeSpentSec != null && body.timeSpentSec < 0) {
    return "timeSpentSec must be >= 0";
  }

  return null;
};

export const logLearningEvent = async (req, res) => {
  try {
    const error = validateEventPayload(req.body);
    if (error) return res.status(400).json({ message: error });

    const event = await LearningEvent.create({
      student: req.user._id,
      course: req.body.courseId,
      topicId: req.body.topicId,
      subtopicId: req.body.subtopicId || "",
      sourceType: req.body.sourceType,
      sourceId: req.body.sourceId || null,
      questionId: req.body.questionId || null,
      eventType: req.body.eventType,
      isCorrect: typeof req.body.isCorrect === "boolean" ? req.body.isCorrect : null,
      rawScore: req.body.rawScore ?? null,
      normalizedScore: req.body.normalizedScore ?? null,
      difficulty: req.body.difficulty || "unknown",
      timeSpentSec: Number(req.body.timeSpentSec || 0),
      responseLatencySec: Number(req.body.responseLatencySec || 0),
      attemptNo: Number(req.body.attemptNo || 1),
      hintUsed: Boolean(req.body.hintUsed),
      explanationViewed: Boolean(req.body.explanationViewed),
      materialId: req.body.materialId || null,
      materialType: req.body.materialType || "",
      materialTopicMatchScore: Number(req.body.materialTopicMatchScore || 0),
      eventTimestamp: req.body.eventTimestamp ? new Date(req.body.eventTimestamp) : new Date(),
      metadata: req.body.metadata || {},
    });

    res.status(201).json(event);
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

    const prediction = await predictTopicMastery({
      studentId: req.user._id,
      courseId,
      topicId,
    });

    const upserted = await TopicMastery.findOneAndUpdate(
      { student: req.user._id, course: courseId, topicId },
      {
        student: req.user._id,
        course: courseId,
        topicId,
        masteryScore: prediction.masteryScore,
        weaknessScore: prediction.weaknessScore,
        confidence: prediction.confidence,
        modelVersion: prediction.modelVersion,
        sourceModelType: prediction.sourceModelType,
        lastPredictionAt: new Date(),
        stats: prediction.stats || {},
        explanation: prediction.explanation || {},
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

    res.json(items);
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

    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyMaterialRecommendations = async (req, res) => {
  try {
    const { courseId } = req.params;
    const topicLimit = Math.max(1, Math.min(Number(req.query.topicLimit || 3), 10));
    const perTopic = Math.max(1, Math.min(Number(req.query.perTopic || 3), 5));

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
      .select("title type fileUrl textContent courseNo courseTitle")
      .lean();

    const seenMaterialIds = new Set();
    const recommendations = [];

    for (const topic of weakTopics) {
      const ranked = materials
        .map((m) =>
          scoreMaterial({
            material: m,
            weaknessScore: topic.weaknessScore,
            topicId: topic.topicId,
            seenMaterialIds,
          })
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, perTopic)
        .map((item) => {
          seenMaterialIds.add(String(item.material._id));
          return {
            topicId: topic.topicId,
            weaknessScore: topic.weaknessScore,
            confidence: topic.confidence,
            materialId: item.material._id,
            title: item.material.title || item.material.courseTitle,
            type: item.material.type,
            fileUrl: item.material.fileUrl,
            score: item.score,
            reason: item.reason,
          };
        });

      recommendations.push(...ranked);
    }

    res.json({
      weakTopics,
      recommendations,
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
      const prediction = await predictTopicMastery({
        studentId: req.user._id,
        courseId,
        topicId: row.topicId,
      });

      const record = await TopicMastery.findOneAndUpdate(
        { student: req.user._id, course: courseId, topicId: row.topicId },
        {
          student: req.user._id,
          course: courseId,
          topicId: row.topicId,
          masteryScore: prediction.masteryScore,
          weaknessScore: prediction.weaknessScore,
          confidence: prediction.confidence,
          modelVersion: prediction.modelVersion,
          sourceModelType: prediction.sourceModelType,
          lastPredictionAt: new Date(),
          stats: prediction.stats || {},
          explanation: prediction.explanation || {},
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
