const clamp01 = (value) => Math.max(0, Math.min(1, Number(value ?? 0)));

export const applyTemporalSmoothing = ({
  previousMastery,
  modelProbability,
  alpha = Number(process.env.KT_MASTERY_SMOOTHING_ALPHA || 0.75),
}) => {
  const pPrev = previousMastery == null ? 0.5 : clamp01(previousMastery);
  const pModel = clamp01(modelProbability);
  const smoothed = clamp01(alpha * pPrev + (1 - alpha) * pModel);
  return {
    smoothedMastery: smoothed,
    previousMastery: pPrev,
    rawModelProbability: pModel,
    alpha,
  };
};

export const deriveWeaknessReasonCodes = ({
  masteryScore,
  confidence,
  stats = {},
}) => {
  const reasons = [];
  const weakness = 1 - clamp01(masteryScore);

  if (weakness >= 0.55) reasons.push("LOW_MASTERY");
  if ((stats.attempts || 0) < 3) reasons.push("LOW_HISTORY");
  if ((stats.hintRate || 0) >= 0.4) reasons.push("HIGH_HINT_USAGE");
  if ((stats.avgTimeSec || 0) >= 75) reasons.push("SLOW_RESPONSE_TIME");
  if ((stats.correctAttempts || 0) === 0 && (stats.attempts || 0) > 0) reasons.push("NO_CORRECT_ATTEMPT");
  if (confidence < 0.5) reasons.push("LOW_CONFIDENCE");

  return reasons;
};

const topicTagMatchScore = (material, topicId) => {
  const tags = Array.isArray(material.topicTags) ? material.topicTags : [];
  const normalizedTopic = String(topicId || "").trim().toLowerCase();
  let best = 0;

  for (const tag of tags) {
    const matches = String(tag.topicId || "").trim().toLowerCase() === normalizedTopic;
    if (matches) {
      best = Math.max(best, Number(tag.confidence || 0.7));
    }
  }

  return clamp01(best);
};

const textMatchScore = (material, topicId) => {
  const topic = String(topicId || "").toLowerCase();
  if (!topic) return 0;
  const title = String(material.title || "").toLowerCase();
  const content = String(material.textContent || "").toLowerCase();
  if (title.includes(topic)) return 0.9;
  if (content.includes(topic)) return 0.6;
  return 0.2;
};

export const buildMaterialRecommendation = ({
  material,
  topic,
  seenMaterialIds,
}) => {
  const weaknessScore = clamp01(topic.weaknessScore);
  const confidence = clamp01(topic.confidence);

  const explicitTopicMatch = topicTagMatchScore(material, topic.topicId);
  const fallbackTextMatch = explicitTopicMatch > 0 ? explicitTopicMatch : textMatchScore(material, topic.topicId);

  const successPrior = clamp01((1 - (topic.stats?.hintRate || 0)) * 0.7 + confidence * 0.3);
  const noveltyPenalty = seenMaterialIds.has(String(material._id)) ? 0.18 : 0;

  const finalScore = clamp01(
    0.5 * weaknessScore +
      0.3 * fallbackTextMatch +
      0.2 * successPrior -
      noveltyPenalty
  );

  const reasonCodes = [];
  if (weaknessScore >= 0.55) reasonCodes.push("TARGETS_WEAK_TOPIC");
  if (explicitTopicMatch > 0) reasonCodes.push("EXPLICIT_TOPIC_TAG_MATCH");
  else if (fallbackTextMatch >= 0.6) reasonCodes.push("TEXT_TOPIC_MATCH");
  if (successPrior >= 0.55) reasonCodes.push("LIKELY_HELPFUL_BASED_ON_PROFILE");
  if (!reasonCodes.length) reasonCodes.push("GENERAL_REINFORCEMENT");

  const reason = reasonCodes
    .map((code) => {
      if (code === "TARGETS_WEAK_TOPIC") return "targets weak topic";
      if (code === "EXPLICIT_TOPIC_TAG_MATCH") return "material has explicit matching topic tag";
      if (code === "TEXT_TOPIC_MATCH") return "material content matches topic text";
      if (code === "LIKELY_HELPFUL_BASED_ON_PROFILE") return "likely helpful from recent performance profile";
      return "recommended for reinforcement";
    })
    .join(", ");

  return {
    topicId: topic.topicId,
    weaknessScore,
    confidence,
    materialId: material._id,
    title: material.title || material.courseTitle,
    type: material.type,
    fileUrl: material.fileUrl,
    score: Number(finalScore.toFixed(4)),
    reason,
    reasonCodes,
  };
};

export const rankTopRecommendations = ({ candidates, topN = 3 }) =>
  [...candidates]
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, topN));

export { clamp01 };
