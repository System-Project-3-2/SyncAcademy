import Course from "../models/courseModel.js";
import Material from "../models/materialModel.js";
import Quiz from "../models/quizModel.js";
import TopicTaxonomy from "../models/topicTaxonomyModel.js";
import TopicAlias from "../models/topicAliasModel.js";
import {
  normalizeTopicTags,
  buildTopicCoverageReport,
  toTopicSlug,
} from "../utils/topicTagValidation.js";
import {
  inferTopicTagsFromText,
  mergeTopicTags,
} from "../services/topicTaggingService.js";

const canManageCourse = async (userId, courseId, userRole) => {
  if (userRole === "admin") return true;
  const course = await Course.findById(courseId).lean();
  if (!course) return false;
  return (
    course.createdBy.toString() === userId.toString() ||
    (course.coTeachers || []).some((id) => id.toString() === userId.toString())
  );
};

const sanitizeIncomingTopicTags = (topicTags, userId, source = "manual") =>
  normalizeTopicTags(
    (topicTags || []).map((tag) => ({
      ...tag,
      source,
      taggedBy: userId,
      taggedAt: new Date(),
    }))
  );

export const createTaxonomyEntry = async (req, res) => {
  try {
    const { courseId, unitId, unitName, topicId, topicName, slug, subtopicId, subtopicName, description } = req.body;

    const normalizedTopicName = String(topicName || "").trim();
    const normalizedSlug = toTopicSlug(slug || topicId || normalizedTopicName);
    const normalizedTopicId = String(topicId || normalizedSlug).trim();

    if (!courseId || !unitId || !unitName || !normalizedTopicId || !normalizedTopicName) {
      return res.status(400).json({ message: "courseId, unitId, unitName, topicId, topicName are required" });
    }

    const allowed = await canManageCourse(req.user._id, courseId, req.user.role);
    if (!allowed) return res.status(403).json({ message: "Access denied" });

    const entry = await TopicTaxonomy.findOneAndUpdate(
      { course: courseId, unitId, topicId: normalizedTopicId, subtopicId: subtopicId || "" },
      {
        course: courseId,
        unitId,
        unitName,
        topicId: normalizedTopicId,
        topicName: normalizedTopicName,
        slug: normalizedSlug,
        subtopicId: subtopicId || "",
        subtopicName: subtopicName || "",
        description: description || "",
        status: "active",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const listTaxonomyByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const entries = await TopicTaxonomy.find({ course: courseId, status: "active" })
      .sort({ unitId: 1, topicId: 1, subtopicId: 1 })
      .lean();
    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createAlias = async (req, res) => {
  try {
    const { courseId, alias, topicId, subtopicId, confidence, source } = req.body;
    if (!alias || !topicId) {
      return res.status(400).json({ message: "alias and topicId are required" });
    }

    if (courseId) {
      const allowed = await canManageCourse(req.user._id, courseId, req.user.role);
      if (!allowed) return res.status(403).json({ message: "Access denied" });
    }

    const entry = await TopicAlias.findOneAndUpdate(
      {
        course: courseId || null,
        normalizedAlias: String(alias).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(),
        topicId,
        subtopicId: subtopicId || "",
      },
      {
        course: courseId || null,
        alias,
        topicId,
        subtopicId: subtopicId || "",
        confidence: Number(confidence ?? 0.8),
        source: source || "manual",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const autoTagMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const material = await Material.findById(id);
    if (!material) return res.status(404).json({ message: "Material not found" });

    if (req.user.role !== "admin" && material.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only auto-tag your own materials" });
    }

    const course = await Course.findOne({ courseNo: material.courseNo }).lean();
    if (!course) return res.status(404).json({ message: "Course mapping not found for material" });

    const payloadText = `${material.title || ""}\n${material.textContent || ""}`;
    const inference = await inferTopicTagsFromText({
      text: payloadText,
      courseId: course._id,
      taggedBy: req.user._id,
    });

    const merged = mergeTopicTags({
      existingTags: material.topicTags || [],
      generatedTags: inference.tags,
    });

    material.topicTags = merged;
    await material.save();

    res.json({
      materialId: material._id,
      ambiguous: inference.ambiguous,
      candidates: inference.candidates,
      topicTags: material.topicTags,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const autoTagQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    const allowed = await canManageCourse(req.user._id, quiz.course, req.user.role);
    if (!allowed) return res.status(403).json({ message: "Access denied" });

    let updatedQuestions = 0;
    const ambiguityRefs = [];

    for (let i = 0; i < quiz.questions.length; i++) {
      const question = quiz.questions[i];
      const payloadText = `${question.questionText || ""}\n${(question.explanation || "")}`;
      const inference = await inferTopicTagsFromText({
        text: payloadText,
        courseId: quiz.course,
        taggedBy: req.user._id,
      });

      const merged = mergeTopicTags({
        existingTags: question.topicTags || [],
        generatedTags: inference.tags,
      });

      quiz.questions[i].topicTags = merged;
      if (merged.length) updatedQuestions += 1;
      if (inference.ambiguous) {
        ambiguityRefs.push({
          questionIndex: i,
          questionId: question._id,
          candidates: inference.candidates,
        });
      }
    }

    await quiz.save();

    res.json({
      quizId: quiz._id,
      updatedQuestions,
      totalQuestions: quiz.questions.length,
      ambiguityRefs,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateMaterialTopicTags = async (req, res) => {
  try {
    const { id } = req.params;
    const material = await Material.findById(id);
    if (!material) return res.status(404).json({ message: "Material not found" });

    if (req.user.role !== "admin" && material.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only update your own materials" });
    }

    material.topicTags = sanitizeIncomingTopicTags(req.body.topicTags, req.user._id, "manual");
    await material.save();

    res.json(material);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateQuizQuestionTopicTags = async (req, res) => {
  try {
    const { quizId, questionId } = req.params;

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    const allowed = await canManageCourse(req.user._id, quiz.course, req.user.role);
    if (!allowed) return res.status(403).json({ message: "Access denied" });

    const question = quiz.questions.id(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found in quiz" });
    }

    question.topicTags = sanitizeIncomingTopicTags(req.body.topicTags, req.user._id, "manual");
    await quiz.save();

    res.json({
      quizId: quiz._id,
      questionId,
      topicTags: question.topicTags,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTopicTagCoverageReport = async (req, res) => {
  try {
    const { courseId } = req.params;

    const allowed = await canManageCourse(req.user._id, courseId, req.user.role);
    if (!allowed) return res.status(403).json({ message: "Access denied" });

    const report = await buildTopicCoverageReport(courseId);
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
