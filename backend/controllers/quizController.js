/**
 * Quiz Controller
 * Handles AI quiz generation, CRUD, student attempts, and results
 */
import Quiz from "../models/quizModel.js";
import QuizAttempt from "../models/quizAttemptModel.js";
import Course from "../models/courseModel.js";
import Enrollment from "../models/enrollmentModel.js";
import { generateQuiz as generateQuizFromMaterials } from "../services/quizGeneratorService.js";
import { notifyEnrolledStudents } from "../utils/notificationHelper.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const canManageCourse = async (userId, courseId, userRole) => {
  if (userRole === "admin") return true;
  const course = await Course.findById(courseId).lean();
  if (!course) return false;
  return (
    course.createdBy.toString() === userId.toString() ||
    (course.coTeachers || []).some((id) => id.toString() === userId.toString())
  );
};

const canAccessCourse = async (userId, courseId, userRole) => {
  if (userRole === "admin") return true;
  const course = await Course.findById(courseId).lean();
  if (!course) return false;
  if (course.createdBy.toString() === userId.toString()) return true;
  if ((course.coTeachers || []).some((id) => id.toString() === userId.toString())) return true;
  const enrollment = await Enrollment.findOne({
    student: userId,
    course: courseId,
    status: "active",
  }).lean();
  return !!enrollment;
};

// ─── Generate Quiz (AI) ──────────────────────────────────────────────────────

/**
 * Generate a quiz using AI from course materials
 * @route POST /api/quizzes/generate
 * @access Teacher (own course), Admin
 */
export const generateQuiz = async (req, res) => {
  try {
    const { courseId, title, description, numQuestions, difficulty, timeLimit, materialId } = req.body;

    if (!courseId || !title) {
      return res.status(400).json({ message: "courseId and title are required" });
    }

    const canManage = await canManageCourse(req.user._id, courseId, req.user.role);
    if (!canManage) {
      return res.status(403).json({ message: "You can only generate quizzes for your own courses" });
    }

    // Get course to find courseNo
    const course = await Course.findById(courseId).lean();
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const count = Math.min(Math.max(Number(numQuestions) || 5, 1), 20);
    const diff = ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium";

    // Generate questions using AI
    const questions = await generateQuizFromMaterials(course.courseNo, count, diff, materialId || null, courseId);

    // Create quiz (unpublished so teacher can review)
    const quiz = await Quiz.create({
      course: courseId,
      createdBy: req.user._id,
      title: title.trim(),
      description: description ? description.trim() : "",
      questions,
      isPublished: false,
      timeLimit: timeLimit ? Number(timeLimit) : null,
      totalQuestions: questions.length,
    });

    const populated = await Quiz.findById(quiz._id)
      .populate("createdBy", "name email avatar")
      .populate("course", "courseNo courseTitle");

    res.status(201).json(populated);
  } catch (error) {
    console.error("[QuizController] generateQuiz error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// ─── Create Manual Quiz ──────────────────────────────────────────────────────

/**
 * Create a quiz manually with teacher-provided questions
 * @route POST /api/quizzes/manual
 * @access Teacher (own course), Admin
 */
export const createManualQuiz = async (req, res) => {
  try {
    const { courseId, title, description, questions, timeLimit } = req.body;

    if (!courseId || !title) {
      return res.status(400).json({ message: "courseId and title are required" });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "At least one question is required" });
    }

    const canManage = await canManageCourse(req.user._id, courseId, req.user.role);
    if (!canManage) {
      return res.status(403).json({ message: "You can only create quizzes for your own courses" });
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText || !q.questionText.trim()) {
        return res.status(400).json({ message: `Question ${i + 1} text is required` });
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        return res.status(400).json({ message: `Question ${i + 1} must have exactly 4 options` });
      }
      if (q.options.some((o) => !o || !o.trim())) {
        return res.status(400).json({ message: `All options in question ${i + 1} must be filled` });
      }
      const ca = Number(q.correctAnswer);
      if (isNaN(ca) || ca < 0 || ca > 3) {
        return res.status(400).json({ message: `Question ${i + 1} must have a valid correct answer (0-3)` });
      }
    }

    const sanitizedQuestions = questions.map((q) => ({
      questionText: q.questionText.trim(),
      options: q.options.map((o) => o.trim()),
      correctAnswer: Number(q.correctAnswer),
      explanation: q.explanation ? q.explanation.trim() : "",
      difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium",
    }));

    const quiz = await Quiz.create({
      course: courseId,
      createdBy: req.user._id,
      title: title.trim(),
      description: description ? description.trim() : "",
      questions: sanitizedQuestions,
      isPublished: false,
      timeLimit: timeLimit ? Number(timeLimit) : null,
      totalQuestions: sanitizedQuestions.length,
    });

    const populated = await Quiz.findById(quiz._id)
      .populate("createdBy", "name email avatar")
      .populate("course", "courseNo courseTitle");

    res.status(201).json(populated);
  } catch (error) {
    console.error("[QuizController] createManualQuiz error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// ─── Get Quizzes by Course ───────────────────────────────────────────────────

/**
 * List quizzes for a course
 * @route GET /api/quizzes/course/:courseId
 * @access Enrolled students (published only), Course teacher, Admin
 */
export const getQuizzesByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const hasAccess = await canAccessCourse(req.user._id, courseId, req.user.role);
    if (!hasAccess) {
      return res.status(403).json({ message: "You do not have access to this course" });
    }

    const filter = { course: courseId };

    // Students only see published quizzes
    if (req.user.role === "student") {
      filter.isPublished = true;
    }

    const quizzes = await Quiz.find(filter)
      .sort({ createdAt: -1 })
      .select("-questions")
      .populate("createdBy", "name email avatar")
      .lean();

    // For students, attach their attempt status
    if (req.user.role === "student") {
      const quizIds = quizzes.map((q) => q._id);
      const attempts = await QuizAttempt.find({
        quiz: { $in: quizIds },
        student: req.user._id,
      }).lean();

      const attemptMap = {};
      attempts.forEach((a) => {
        attemptMap[a.quiz.toString()] = a;
      });

      quizzes.forEach((q) => {
        const attempt = attemptMap[q._id.toString()];
        if (attempt) {
          q.attemptStatus = "completed";
          q.myScore = attempt.score;
          q.myPercentage = attempt.percentage;
        } else {
          q.attemptStatus = "not_attempted";
        }
      });
    }

    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Get Single Quiz ─────────────────────────────────────────────────────────

/**
 * Get single quiz
 * Teachers/admin see answers; students see only questions (no correct answers)
 * @route GET /api/quizzes/:id
 * @access Enrolled students, Course teacher, Admin
 */
export const getQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate("createdBy", "name email avatar")
      .populate("course", "courseNo courseTitle");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const hasAccess = await canAccessCourse(req.user._id, quiz.course._id, req.user.role);
    if (!hasAccess) {
      return res.status(403).json({ message: "You do not have access to this quiz" });
    }

    // Students can only see published quizzes
    if (req.user.role === "student" && !quiz.isPublished) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const quizObj = quiz.toObject();

    // For students: check if they already attempted
    if (req.user.role === "student") {
      const attempt = await QuizAttempt.findOne({
        quiz: quiz._id,
        student: req.user._id,
      }).lean();

      if (attempt) {
        // Already attempted — show results with answers
        quizObj.myAttempt = attempt;
      } else {
        // Not yet attempted — hide correct answers and explanations
        quizObj.questions = quizObj.questions.map((q) => ({
          _id: q._id,
          questionText: q.questionText,
          options: q.options,
          difficulty: q.difficulty,
        }));
      }
    }

    res.json(quizObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Update Quiz ─────────────────────────────────────────────────────────────

/**
 * Update quiz (edit questions, title, etc.)
 * @route PUT /api/quizzes/:id
 * @access Teacher (own course), Admin
 */
export const updateQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const canManage = await canManageCourse(req.user._id, quiz.course, req.user.role);
    if (!canManage) {
      return res.status(403).json({ message: "You can only edit quizzes in your own courses" });
    }

    const { title, description, questions, timeLimit } = req.body;

    if (title) quiz.title = title.trim();
    if (description !== undefined) quiz.description = description.trim();
    if (timeLimit !== undefined) quiz.timeLimit = timeLimit ? Number(timeLimit) : null;
    if (questions && Array.isArray(questions)) {
      quiz.questions = questions;
      quiz.totalQuestions = questions.length;
    }

    await quiz.save();

    const populated = await Quiz.findById(quiz._id)
      .populate("createdBy", "name email avatar")
      .populate("course", "courseNo courseTitle");

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Publish Quiz ────────────────────────────────────────────────────────────

/**
 * Publish or unpublish a quiz
 * @route PUT /api/quizzes/:id/publish
 * @access Teacher (own course), Admin
 */
export const publishQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const canManage = await canManageCourse(req.user._id, quiz.course, req.user.role);
    if (!canManage) {
      return res.status(403).json({ message: "You can only publish quizzes in your own courses" });
    }

    const wasPublished = quiz.isPublished;
    quiz.isPublished = req.body.publish !== undefined ? Boolean(req.body.publish) : !quiz.isPublished;
    await quiz.save();

    // Notify students when publishing for the first time
    if (!wasPublished && quiz.isPublished) {
      notifyEnrolledStudents({
        courseId: quiz.course,
        type: "quiz_published",
        title: "New Quiz Available",
        message: `A new quiz "${quiz.title}" is now available.`,
        link: `/courses/${quiz.course}/quizzes`,
      }).catch(() => {});
    }

    res.json({ message: quiz.isPublished ? "Quiz published" : "Quiz unpublished", quiz });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Delete Quiz ─────────────────────────────────────────────────────────────

/**
 * Delete quiz and all associated attempts
 * @route DELETE /api/quizzes/:id
 * @access Teacher (own course), Admin
 */
export const deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const canManage = await canManageCourse(req.user._id, quiz.course, req.user.role);
    if (!canManage) {
      return res.status(403).json({ message: "You can only delete quizzes in your own courses" });
    }

    // Delete all attempts for this quiz
    await QuizAttempt.deleteMany({ quiz: quiz._id });
    await Quiz.findByIdAndDelete(quiz._id);

    res.json({ message: "Quiz and all attempts deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Submit Attempt (Student) ────────────────────────────────────────────────

/**
 * Submit quiz attempt — auto-graded
 * @route POST /api/quizzes/:id/attempt
 * @access Student (enrolled)
 */
export const submitAttempt = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    if (!quiz.isPublished) {
      return res.status(400).json({ message: "This quiz is not yet published" });
    }

    // Check enrollment
    const hasAccess = await canAccessCourse(req.user._id, quiz.course, req.user.role);
    if (!hasAccess) {
      return res.status(403).json({ message: "You do not have access to this quiz" });
    }

    // Check if already attempted
    const existingAttempt = await QuizAttempt.findOne({
      quiz: quiz._id,
      student: req.user._id,
    });
    if (existingAttempt) {
      return res.status(400).json({ message: "You have already attempted this quiz", attempt: existingAttempt });
    }

    const { answers, startedAt } = req.body;
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: "answers array is required" });
    }

    // Auto-grade
    let score = 0;
    const totalMarks = quiz.questions.length;

    const gradedAnswers = answers.map((a) => {
      const qIndex = Number(a.questionIndex);
      const selected = Number(a.selectedAnswer);
      const question = quiz.questions[qIndex];
      if (question && question.correctAnswer === selected) {
        score++;
      }
      return { questionIndex: qIndex, selectedAnswer: selected };
    });

    const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
    const now = new Date();
    const started = startedAt ? new Date(startedAt) : now;
    const timeTaken = Math.round((now - started) / 1000);

    const attempt = await QuizAttempt.create({
      quiz: quiz._id,
      student: req.user._id,
      answers: gradedAnswers,
      score,
      totalMarks,
      percentage,
      startedAt: started,
      completedAt: now,
      timeTaken: Math.max(timeTaken, 0),
    });

    // Return full quiz with answers for review
    const fullQuiz = quiz.toObject();

    res.status(201).json({
      attempt,
      quiz: fullQuiz,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "You have already attempted this quiz" });
    }
    res.status(500).json({ message: error.message });
  }
};

// ─── Get My Attempts (Student) ───────────────────────────────────────────────

/**
 * Get all quiz attempts for the current student
 * @route GET /api/quizzes/my-attempts
 * @access Student
 */
export const getMyAttempts = async (req, res) => {
  try {
    const attempts = await QuizAttempt.find({ student: req.user._id })
      .sort({ completedAt: -1 })
      .populate({
        path: "quiz",
        select: "title course totalQuestions createdBy",
        populate: [
          { path: "course", select: "courseNo courseTitle" },
          { path: "createdBy", select: "name" },
        ],
      })
      .lean();

    res.json(attempts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Get Quiz Results (Teacher) ──────────────────────────────────────────────

/**
 * Get all student attempts for a quiz
 * @route GET /api/quizzes/:id/results
 * @access Teacher (own course), Admin
 */
export const getQuizResults = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const canManage = await canManageCourse(req.user._id, quiz.course, req.user.role);
    if (!canManage) {
      return res.status(403).json({ message: "Access denied" });
    }

    const attempts = await QuizAttempt.find({ quiz: quiz._id })
      .sort({ percentage: -1 })
      .populate("student", "name email idNumber avatar")
      .lean();

    const stats = {
      totalAttempts: attempts.length,
      averageScore: attempts.length
        ? Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length)
        : 0,
      highestScore: attempts.length ? Math.max(...attempts.map((a) => a.percentage)) : 0,
      lowestScore: attempts.length ? Math.min(...attempts.map((a) => a.percentage)) : 0,
    };

    res.json({ quiz, attempts, stats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
