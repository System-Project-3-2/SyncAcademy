import Quiz from "../models/quizModel.js";
import Material from "../models/materialModel.js";
import Course from "../models/courseModel.js";

const LOW_CONFIDENCE_THRESHOLD = Number(process.env.TOPIC_TAG_LOW_CONFIDENCE || 0.55);

export const normalizeTopicName = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .replace(/[\s_]+/g, " ")
    .trim();

export const toTopicSlug = (value = "") =>
  normalizeTopicName(value)
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

export const normalizeTopicTags = (topicTags = []) => {
  if (!Array.isArray(topicTags)) return [];

  const normalized = topicTags
    .filter((tag) => tag && tag.topicId)
    .map((tag) => ({
      topicId: String(tag.topicId).trim(),
      subtopicId: String(tag.subtopicId || "").trim(),
      confidence: Math.max(0, Math.min(1, Number(tag.confidence ?? 0.7))),
      source: ["auto", "manual", "seed", "import"].includes(tag.source) ? tag.source : "manual",
      taggedBy: tag.taggedBy || null,
      taggedAt: tag.taggedAt ? new Date(tag.taggedAt) : new Date(),
    }));

  const map = new Map();
  for (const tag of normalized) {
    const key = `${tag.topicId}::${tag.subtopicId}`;
    const existing = map.get(key);
    if (!existing || tag.confidence > existing.confidence || existing.source !== "manual") {
      map.set(key, tag);
    }
  }

  return [...map.values()];
};

export const getLowConfidenceTags = (tags = [], threshold = LOW_CONFIDENCE_THRESHOLD) =>
  (tags || []).filter((tag) => Number(tag.confidence || 0) < threshold);

export const collectQuizTopicTagIssues = (quizDoc) => {
  const missingQuestionIndexes = [];
  const lowConfidenceQuestions = [];

  (quizDoc.questions || []).forEach((question, index) => {
    const tags = normalizeTopicTags(question.topicTags || []);
    if (!tags.length) {
      missingQuestionIndexes.push(index);
      return;
    }

    const lowTags = getLowConfidenceTags(tags);
    if (lowTags.length) {
      lowConfidenceQuestions.push({
        questionIndex: index,
        lowConfidenceTags: lowTags,
      });
    }
  });

  return {
    missingQuestionIndexes,
    lowConfidenceQuestions,
  };
};

export const validateQuizTopicTagsForPublish = (quizDoc) => {
  const issues = collectQuizTopicTagIssues(quizDoc);
  return {
    ok: issues.missingQuestionIndexes.length === 0,
    ...issues,
  };
};

export const validateMaterialTopicTags = (materialDoc) => {
  const tags = normalizeTopicTags(materialDoc.topicTags || []);
  return {
    ok: tags.length > 0,
    lowConfidenceTags: getLowConfidenceTags(tags),
    totalTags: tags.length,
  };
};

export const buildTopicCoverageReport = async (courseId) => {
  const course = await Course.findById(courseId).lean();
  if (!course?.courseNo) {
    throw new Error("Course not found");
  }

  const [quizzes, materials] = await Promise.all([
    Quiz.find({ course: courseId }).select("questions title").lean(),
    Material.find({ courseNo: course.courseNo }).select("title topicTags").lean(),
  ]);

  let totalQuestions = 0;
  let taggedQuestions = 0;
  let lowConfidenceQuestionTags = 0;
  let ambiguousQuestionMappings = 0;
  const untaggedQuestionRefs = [];
  const ambiguousQuestionRefs = [];

  for (const quiz of quizzes) {
    (quiz.questions || []).forEach((q, i) => {
      totalQuestions += 1;
      const tags = normalizeTopicTags(q.topicTags || []);
      if (tags.length) taggedQuestions += 1;
      else {
        untaggedQuestionRefs.push({
          quizId: quiz._id,
          quizTitle: quiz.title,
          questionIndex: i,
          questionText: q.questionText,
        });
      }
      lowConfidenceQuestionTags += getLowConfidenceTags(tags).length;

      if (tags.length >= 2) {
        const sorted = [...tags].sort((a, b) => b.confidence - a.confidence);
        if (Math.abs(sorted[0].confidence - sorted[1].confidence) < 0.1) {
          ambiguousQuestionMappings += 1;
          ambiguousQuestionRefs.push({
            quizId: quiz._id,
            quizTitle: quiz.title,
            questionIndex: i,
            questionText: q.questionText,
            topTopicA: sorted[0].topicId,
            topTopicB: sorted[1].topicId,
            confidenceA: sorted[0].confidence,
            confidenceB: sorted[1].confidence,
          });
        }
      }
    });
  }

  const untaggedMaterials = [];
  let lowConfidenceMaterialTags = 0;
  let ambiguousMaterialMappings = 0;
  const ambiguousMaterialRefs = [];
  for (const material of materials) {
    const tags = normalizeTopicTags(material.topicTags || []);
    if (!tags.length) {
      untaggedMaterials.push({
        materialId: material._id,
        title: material.title,
      });
    }
    lowConfidenceMaterialTags += getLowConfidenceTags(tags).length;

    if (tags.length >= 2) {
      const sorted = [...tags].sort((a, b) => b.confidence - a.confidence);
      if (Math.abs(sorted[0].confidence - sorted[1].confidence) < 0.1) {
        ambiguousMaterialMappings += 1;
        ambiguousMaterialRefs.push({
          materialId: material._id,
          title: material.title,
          topTopicA: sorted[0].topicId,
          topTopicB: sorted[1].topicId,
          confidenceA: sorted[0].confidence,
          confidenceB: sorted[1].confidence,
        });
      }
    }
  }

  return {
    courseId,
    courseNo: course.courseNo,
    summary: {
      totalQuizzes: quizzes.length,
      totalMaterials: materials.length,
      totalQuestions,
      taggedQuestions,
      untaggedQuestions: totalQuestions - taggedQuestions,
      taggedMaterials: materials.length - untaggedMaterials.length,
      untaggedMaterials: untaggedMaterials.length,
      lowConfidenceQuestionTags,
      lowConfidenceMaterialTags,
      ambiguousQuestionMappings,
      ambiguousMaterialMappings,
    },
    untaggedQuestionRefs,
    untaggedMaterials,
    ambiguousQuestionRefs,
    ambiguousMaterialRefs,
  };
};
