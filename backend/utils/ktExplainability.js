const clamp01 = (value) => Math.max(0, Math.min(1, Number(value ?? 0)));

const round4 = (value) => Number(Number(value || 0).toFixed(4));

const signLabel = (value) => (value >= 0 ? "increase" : "decrease");

const asPct = (value) => round4(clamp01(value) * 100);

const localContributionWeights = {
  topicAccuracy: 0.45,
  weightedAccuracy: 0.35,
  hintRate: -0.22,
  avgTimeSec: -0.16,
  attempts: 0.12,
  confidence: 0.2,
};

const normalizeTimePenalty = (avgTimeSec) => clamp01(Number(avgTimeSec || 0) / 120);

export const buildTabularLocalExplanation = (topicRow) => {
  const stats = topicRow.stats || {};
  const attempts = Number(stats.attempts || 0);
  const topicAccuracy = clamp01(Number(stats.correctAttempts || 0) / Math.max(1, attempts));
  const weightedAccuracy = clamp01(Number(topicRow.masteryScore || 0));
  const hintRate = clamp01(Number(stats.hintRate || 0));
  const avgTimePenalty = normalizeTimePenalty(stats.avgTimeSec);
  const confidence = clamp01(Number(topicRow.confidence || 0));
  const attemptSignal = clamp01(attempts / 20);

  const contributions = [
    {
      feature: "topic_accuracy",
      value: round4(topicAccuracy),
      contribution: round4((topicAccuracy - 0.5) * localContributionWeights.topicAccuracy),
      direction: signLabel((topicAccuracy - 0.5) * localContributionWeights.topicAccuracy),
    },
    {
      feature: "weighted_mastery_proxy",
      value: round4(weightedAccuracy),
      contribution: round4((weightedAccuracy - 0.5) * localContributionWeights.weightedAccuracy),
      direction: signLabel((weightedAccuracy - 0.5) * localContributionWeights.weightedAccuracy),
    },
    {
      feature: "hint_rate",
      value: round4(hintRate),
      contribution: round4(hintRate * localContributionWeights.hintRate),
      direction: signLabel(hintRate * localContributionWeights.hintRate),
    },
    {
      feature: "response_time_penalty",
      value: round4(Number(stats.avgTimeSec || 0)),
      contribution: round4(avgTimePenalty * localContributionWeights.avgTimeSec),
      direction: signLabel(avgTimePenalty * localContributionWeights.avgTimeSec),
    },
    {
      feature: "history_depth",
      value: round4(attemptSignal),
      contribution: round4((attemptSignal - 0.3) * localContributionWeights.attempts),
      direction: signLabel((attemptSignal - 0.3) * localContributionWeights.attempts),
    },
    {
      feature: "model_confidence",
      value: round4(confidence),
      contribution: round4((confidence - 0.5) * localContributionWeights.confidence),
      direction: signLabel((confidence - 0.5) * localContributionWeights.confidence),
    },
  ].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return {
    topicId: topicRow.topicId,
    masteryScore: round4(topicRow.masteryScore),
    weaknessScore: round4(topicRow.weaknessScore),
    confidence: round4(topicRow.confidence),
    method: "shap_style_proxy",
    topPositive: contributions.filter((c) => c.contribution > 0).slice(0, 3),
    topNegative: contributions.filter((c) => c.contribution < 0).slice(0, 3),
    allContributions: contributions,
  };
};

export const buildTabularGlobalExplanation = (topicRows = []) => {
  if (!topicRows.length) {
    return {
      method: "shap_style_proxy",
      featureImportance: [],
      totalTopics: 0,
    };
  }

  const buckets = new Map();
  for (const row of topicRows) {
    const local = buildTabularLocalExplanation(row);
    for (const item of local.allContributions) {
      const key = item.feature;
      const prev = buckets.get(key) || { totalAbs: 0, totalSigned: 0, count: 0 };
      prev.totalAbs += Math.abs(item.contribution);
      prev.totalSigned += item.contribution;
      prev.count += 1;
      buckets.set(key, prev);
    }
  }

  const featureImportance = [...buckets.entries()]
    .map(([feature, agg]) => ({
      feature,
      meanAbsContribution: round4(agg.totalAbs / Math.max(1, agg.count)),
      meanSignedContribution: round4(agg.totalSigned / Math.max(1, agg.count)),
      impactDirection: signLabel(agg.totalSigned),
    }))
    .sort((a, b) => b.meanAbsContribution - a.meanAbsContribution);

  return {
    method: "shap_style_proxy",
    totalTopics: topicRows.length,
    featureImportance,
  };
};

const eventContribution = (event, recencyWeight) => {
  const correct = typeof event.isCorrect === "boolean" ? (event.isCorrect ? 1 : -1) : 0;
  const normalizedScore = event.normalizedScore == null ? 0 : Number(event.normalizedScore) - 0.5;
  const hintPenalty = event.hintUsed ? -0.14 : 0;
  const timePenalty = Number(event.timeSpentSec || 0) > 90 ? -0.1 : 0;
  const difficultyBoost = event.difficulty === "hard" && event.isCorrect ? 0.08 : 0;

  const raw = correct * 0.35 + normalizedScore * 0.2 + hintPenalty + timePenalty + difficultyBoost;
  return round4(raw * recencyWeight);
};

const makeActionLabel = (event) => {
  const parts = [event.eventType || "interaction"];
  if (event.topicId) parts.push(`topic:${event.topicId}`);
  if (event.difficulty) parts.push(`difficulty:${event.difficulty}`);
  if (event.hintUsed) parts.push("hint_used");
  return parts.join(" | ");
};

export const buildSequenceContributionTrace = ({ events = [], topicId, limit = 12 }) => {
  const filtered = topicId
    ? events.filter((event) => String(event.topicId) === String(topicId))
    : events;

  const sliced = filtered.slice(-Math.max(1, limit));
  if (!sliced.length) {
    return {
      topicId: topicId || "all_topics",
      method: "attention_like_recency_trace",
      traces: [],
      topIncreaseActions: [],
      topDecreaseActions: [],
    };
  }

  const weighted = sliced.map((event, idx) => {
    const recencyWeight = (idx + 1) / sliced.length;
    const contribution = eventContribution(event, recencyWeight);
    return {
      timestamp: event.eventTimestamp,
      topicId: event.topicId,
      action: makeActionLabel(event),
      attentionWeight: round4(recencyWeight),
      contribution,
      effect: signLabel(contribution),
    };
  });

  const topIncreaseActions = [...weighted]
    .filter((w) => w.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 5);
  const topDecreaseActions = [...weighted]
    .filter((w) => w.contribution < 0)
    .sort((a, b) => a.contribution - b.contribution)
    .slice(0, 5);

  return {
    topicId: topicId || "all_topics",
    method: "attention_like_recency_trace",
    traces: weighted,
    topIncreaseActions,
    topDecreaseActions,
  };
};

export const buildRecommendationExplanation = ({ recommendation, weakTopicLookup = new Map() }) => {
  const topicInfo = weakTopicLookup.get(String(recommendation.topicId)) || null;
  const weakness = clamp01(topicInfo?.weaknessScore || recommendation.weaknessScore || 0);
  const confidence = clamp01(topicInfo?.confidence || recommendation.confidence || 0);
  const relevance = clamp01(Number(recommendation.score || 0));

  const drivers = [
    {
      driver: "topic_weakness_alignment",
      value: asPct(weakness),
      contribution: round4(weakness * 0.5),
    },
    {
      driver: "material_relevance_score",
      value: asPct(relevance),
      contribution: round4(relevance * 0.3),
    },
    {
      driver: "confidence_support",
      value: asPct(confidence),
      contribution: round4(confidence * 0.2),
    },
  ].sort((a, b) => b.contribution - a.contribution);

  return {
    materialId: recommendation.materialId,
    topicId: recommendation.topicId,
    score: round4(recommendation.score),
    reason: recommendation.reason,
    reasonCodes: recommendation.reasonCodes || [],
    topDrivers: drivers,
  };
};

export const summarizeRecommendationDrivers = (recommendations = [], weakTopics = []) => {
  const lookup = new Map(weakTopics.map((t) => [String(t.topicId), t]));
  const local = recommendations.map((item) =>
    buildRecommendationExplanation({ recommendation: item, weakTopicLookup: lookup })
  );

  const global = new Map();
  for (const rec of local) {
    for (const d of rec.topDrivers) {
      const prev = global.get(d.driver) || { total: 0, count: 0 };
      prev.total += d.contribution;
      prev.count += 1;
      global.set(d.driver, prev);
    }
  }

  const globalDrivers = [...global.entries()]
    .map(([driver, agg]) => ({
      driver,
      meanContribution: round4(agg.total / Math.max(1, agg.count)),
    }))
    .sort((a, b) => b.meanContribution - a.meanContribution);

  return {
    local,
    globalDrivers,
  };
};

export const buildTopActionSummary = (sequenceTraces = []) => {
  const increases = [];
  const decreases = [];

  for (const trace of sequenceTraces) {
    increases.push(...(trace.topIncreaseActions || []));
    decreases.push(...(trace.topDecreaseActions || []));
  }

  const topIncreased = increases.sort((a, b) => b.contribution - a.contribution).slice(0, 5);
  const topDecreased = decreases.sort((a, b) => a.contribution - b.contribution).slice(0, 5);

  return {
    increasedMastery: topIncreased,
    decreasedMastery: topDecreased,
  };
};
