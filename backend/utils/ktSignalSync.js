import TopicMastery from "../models/topicMasteryModel.js";
import { predictTopicMastery } from "../services/ktModelService.js";
import {
  applyTemporalSmoothing,
  deriveWeaknessReasonCodes,
  clamp01,
} from "./ktMasteryEngine.js";

export const refreshTopicMasteryForTopics = async ({ studentId, courseId, topicIds = [] }) => {
  const uniqueTopicIds = [...new Set(topicIds.map((topicId) => String(topicId || "").trim()).filter(Boolean))];

  if (!uniqueTopicIds.length) {
    return [];
  }

  const refreshed = [];

  for (const topicId of uniqueTopicIds) {
    const previous = await TopicMastery.findOne({
      student: studentId,
      course: courseId,
      topicId,
    }).lean();

    const prediction = await predictTopicMastery({
      studentId,
      courseId,
      topicId,
    });

    const smoothing = applyTemporalSmoothing({
      previousMastery: previous?.masteryScore,
      modelProbability: prediction.masteryScore,
    });

    const masteryScore = smoothing.smoothedMastery;
    const weaknessScore = clamp01(1 - masteryScore);
    const confidence = clamp01(prediction.confidence ?? 0);
    const reasonCodes = deriveWeaknessReasonCodes({
      masteryScore,
      confidence,
      stats: prediction.stats || {},
    });

    const record = await TopicMastery.findOneAndUpdate(
      { student: studentId, course: courseId, topicId },
      {
        $set: {
          student: studentId,
          course: courseId,
          topicId,
          masteryScore,
          weaknessScore,
          confidence,
          modelVersion: prediction.modelVersion,
          sourceModelType: prediction.sourceModelType,
          lastPredictionAt: new Date(),
          stats: prediction.stats || {},
          explanation: {
            ...(prediction.explanation || {}),
            reasonCodes,
            smoothing: {
              previousMastery: smoothing.previousMastery,
              rawModelProbability: smoothing.rawModelProbability,
              alpha: smoothing.alpha,
            },
          },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    refreshed.push(record);
  }

  return refreshed;
};