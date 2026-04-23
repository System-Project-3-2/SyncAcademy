import LearningEvent from "../models/learningEventModel.js";

const KT_MODEL_SERVICE_URL = process.env.KT_MODEL_SERVICE_URL || "";
const KT_MODEL_SERVICE_TIMEOUT_MS = Number(process.env.KT_MODEL_SERVICE_TIMEOUT_MS || 4000);

const timeoutFetch = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KT_MODEL_SERVICE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeDifficulty = (difficulty) => {
  if (difficulty === "easy") return 0.9;
  if (difficulty === "medium") return 1;
  if (difficulty === "hard") return 1.1;
  return 1;
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const buildRuleFeatures = (events) => {
  const questionEvents = events.filter((e) => typeof e.isCorrect === "boolean");
  const attempts = questionEvents.length;
  const correctAttempts = questionEvents.filter((e) => e.isCorrect).length;
  const accuracy = attempts > 0 ? correctAttempts / attempts : 0.5;

  const avgTimeSec =
    questionEvents.length > 0
      ? questionEvents.reduce((acc, e) => acc + (e.timeSpentSec || 0), 0) / questionEvents.length
      : 0;

  const weightedAccuracy =
    questionEvents.length > 0
      ? questionEvents.reduce((acc, e) => {
          const diffWeight = normalizeDifficulty(e.difficulty);
          const score = e.isCorrect ? 1 : 0;
          return acc + score / diffWeight;
        }, 0) / questionEvents.length
      : 0.5;

  return {
    attempts,
    correctAttempts,
    accuracy,
    weightedAccuracy,
    avgTimeSec,
  };
};

const ruleBasedPredict = ({ events }) => {
  const features = buildRuleFeatures(events);
  const alpha = Number(process.env.KT_RULE_SMOOTHING_ALPHA || 0.8);

  const timePenalty = features.avgTimeSec > 0 ? Math.min(0.12, features.avgTimeSec / 1500) : 0;

  const instant = clamp01(features.weightedAccuracy - timePenalty);
  const masteryScore = clamp01(alpha * 0.5 + (1 - alpha) * instant);
  const confidence = clamp01(Math.min(1, features.attempts / 20));

  return {
    masteryScore,
    weaknessScore: 1 - masteryScore,
    confidence,
    modelVersion: "rule-baseline-v1",
    sourceModelType: "rule",
    stats: {
      attempts: features.attempts,
      correctAttempts: features.correctAttempts,
      avgTimeSec: Number(features.avgTimeSec.toFixed(2)),
      // Backward-compatible field retained for existing consumers.
      hintRate: 0,
    },
    explanation: {
      topDrivers: [
        {
          name: "topic_accuracy",
          impact: Number((features.accuracy - 0.5).toFixed(4)),
          value: Number(features.accuracy.toFixed(4)),
        },
        {
          name: "avg_time_penalty",
          impact: Number((-timePenalty).toFixed(4)),
          value: Number(features.avgTimeSec.toFixed(2)),
        },
      ],
      reason: "Rule-based fallback used because Python KT service is unavailable.",
    },
  };
};

const mapEventsForModel = (events) =>
  events.map((e) => ({
    timestamp: e.eventTimestamp,
    topicId: e.topicId,
    sourceType: e.sourceType,
    eventType: e.eventType,
    isCorrect: e.isCorrect,
    normalizedScore: e.normalizedScore,
    difficulty: e.difficulty,
    timeSpentSec: e.timeSpentSec,
    attemptNo: e.attemptNo,
    hintUsed: e.hintUsed,
  }));

export const predictTopicMastery = async ({ studentId, courseId, topicId, limit = 50 }) => {
  const events = await LearningEvent.find({
    student: studentId,
    course: courseId,
    topicId,
  })
    .sort({ eventTimestamp: -1 })
    .limit(limit)
    .lean();

  const chronological = [...events].reverse();

  if (!KT_MODEL_SERVICE_URL) {
    return ruleBasedPredict({ events: chronological });
  }

  try {
    const response = await timeoutFetch(`${KT_MODEL_SERVICE_URL}/predict/topic-mastery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        courseId,
        topicId,
        events: mapEventsForModel(chronological),
      }),
    });

    if (!response.ok) {
      throw new Error(`Python service responded with status ${response.status}`);
    }

    const payload = await response.json();
    return {
      masteryScore: clamp01(Number(payload.masteryScore ?? 0.5)),
      weaknessScore: clamp01(Number(payload.weaknessScore ?? 0.5)),
      confidence: clamp01(Number(payload.confidence ?? 0)),
      modelVersion: payload.modelVersion || "python-kt-service",
      sourceModelType: payload.sourceModelType || "xgboost",
      stats: payload.stats || {},
      explanation: payload.explanation || {},
    };
  } catch (error) {
    console.warn("[KT] Python service fallback:", error.message);
    return ruleBasedPredict({ events: chronological });
  }
};
