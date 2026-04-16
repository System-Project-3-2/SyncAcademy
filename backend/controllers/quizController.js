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
import {
  normalizeTopicTags,
  validateQuizTopicTagsForPublish,
} from "../utils/topicTagValidation.js";

const ENFORCE_QUIZ_TOPIC_TAGS_ON_PUBLISH =
  String(process.env.ENFORCE_QUIZ_TOPIC_TAGS_ON_PUBLISH || "false").toLowerCase() === "true";

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fisher-Yates in-place shuffle — returns a NEW shuffled copy */
const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * djb2 hash — converts a string to a 32-bit unsigned integer seed.
 * Used to derive a deterministic, student-specific shuffle seed.
 */
const hashSeed = (str) => {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(33, h) ^ str.charCodeAt(i)) >>> 0;
  }
  return h;
};

/** Derive a student-facing schedule status from a quiz document */
const getScheduleStatus = (quiz) => {
  const now = new Date();
  if (quiz.scheduledAt && now < new Date(quiz.scheduledAt)) return "upcoming";
  if (quiz.availableUntil && now > new Date(quiz.availableUntil)) return "expired";
  return "available";
};

const sanitizeQuestionTopicTags = (q, userId) => {
  const rawTags = normalizeTopicTags(q.topicTags || []);
  return rawTags.map((tag) => ({
    ...tag,
    taggedBy: tag.taggedBy || userId,
    taggedAt: tag.taggedAt || new Date(),
  }));
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

    // Notify enrolled students that a new quiz is available for this course
    notifyEnrolledStudents({
      courseId,
      type: "quiz_created",
      title: "New Quiz Created",
      message: `A new quiz "${title.trim()}" has been created for ${course.courseNo}. It will be available once published.`,
      link: `/courses/${courseId}/quizzes`,
    }).catch(() => {});

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
      topicTags: sanitizeQuestionTopicTags(q, req.user._id),
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

    // Notify enrolled students that a new quiz has been created
    notifyEnrolledStudents({
      courseId,
      type: "quiz_created",
      title: "New Quiz Created",
      message: `A new quiz "${title.trim()}" has been created. It will be available once published.`,
      link: `/courses/${courseId}/quizzes`,
    }).catch(() => {});

    res.status(201).json(populated);
  } catch (error) {
    console.error("[QuizController] createManualQuiz error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// ─── Get My Created Quizzes (Teacher) ───────────────────────────────────────

/**
 * Get all quizzes created by the current teacher across all their courses
 * @route GET /api/quizzes/my-created
 * @access Teacher, Admin
 */
export const getMyCreatedQuizzes = async (req, res) => {
  try {
    const filter = req.user.role === "admin" ? {} : { createdBy: req.user._id };

    const quizzes = await Quiz.find(filter)
      .sort({ createdAt: -1 })
      .select("-questions")
      .populate("course", "courseNo courseTitle")
      .lean();

    // Attach attempt count for each quiz
    const quizIds = quizzes.map((q) => q._id);
    const attemptCounts = await QuizAttempt.aggregate([
      { $match: { quiz: { $in: quizIds } } },
      { $group: { _id: "$quiz", count: { $sum: 1 } } },
    ]);
    const countMap = {};
    attemptCounts.forEach((a) => { countMap[a._id.toString()] = a.count; });
    quizzes.forEach((q) => { q.attemptCount = countMap[q._id.toString()] || 0; });

    // Add scheduleStatus for dashboard display
    quizzes.forEach((q) => { q.scheduleStatus = getScheduleStatus(q); });

    res.json(quizzes);
  } catch (error) {
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

      const now = new Date();
      quizzes.forEach((q) => {
        q.scheduleStatus = getScheduleStatus(q);
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

    // For students: enforce schedule window and randomize presentation
    if (req.user.role === "student") {
      const attempt = await QuizAttempt.findOne({
        quiz: quiz._id,
        student: req.user._id,
      }).lean();

      if (attempt) {
        // Already attempted — show results with answers (ignore schedule window)
        quizObj.myAttempt = attempt;
      } else {
        // Not yet attempted — enforce schedule window first
        const now = new Date();
        if (quiz.scheduledAt && now < quiz.scheduledAt) {
          quizObj.questions = [];
          quizObj.scheduleStatus = "upcoming";
          return res.json(quizObj);
        }
        if (quiz.availableUntil && now > quiz.availableUntil) {
          quizObj.questions = [];
          quizObj.scheduleStatus = "expired";
          return res.json(quizObj);
        }

        // Within window — shuffle questions and options (anti-cheating)
        // Seed is deterministic per student+quiz so the same student always
        // sees the same shuffle, while different students get different orders.
        const qCount = quizObj.questions.length;
        let lcgState = hashSeed(`${req.user._id}_${quiz._id}`);
        const lcgNext = () => {
          lcgState = (Math.imul(1664525, lcgState) + 1013904223) >>> 0;
          return lcgState / 0x100000000;
        };
        const seededShuffle = (arr) => {
          const a = [...arr];
          for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(lcgNext() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
          }
          return a;
        };
        const questionOrder = seededShuffle([...Array(qCount).keys()]);
        const optionOrders = questionOrder.map(() => seededShuffle([0, 1, 2, 3]));

        quizObj.questions = questionOrder.map((origIdx, shuffledPos) => {
          const q = quizObj.questions[origIdx];
          const optOrder = optionOrders[shuffledPos];
          return {
            _id: q._id,
            questionText: q.questionText,
            difficulty: q.difficulty,
            options: optOrder.map((origOpt) => q.options[origOpt]),
          };
        });
        quizObj.questionOrder = questionOrder;
        quizObj.optionOrders = optionOrders;
        quizObj.scheduleStatus = "available";
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

    const { title, description, questions, timeLimit, scheduledAt, availableUntil } = req.body;

    if (title) quiz.title = title.trim();
    if (description !== undefined) quiz.description = description.trim();
    if (timeLimit !== undefined) quiz.timeLimit = timeLimit ? Number(timeLimit) : null;
    if (scheduledAt !== undefined) quiz.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (availableUntil !== undefined) quiz.availableUntil = availableUntil ? new Date(availableUntil) : null;
    if (questions && Array.isArray(questions)) {
      quiz.questions = questions.map((q) => ({
        ...q,
        topicTags: sanitizeQuestionTopicTags(q, req.user._id),
      }));
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
    const requestedPublish = req.body.publish !== undefined ? Boolean(req.body.publish) : !quiz.isPublished;
    let validationWarning = null;

    if (requestedPublish) {
      const validation = validateQuizTopicTagsForPublish(quiz);
      if (!validation.ok) {
        if (ENFORCE_QUIZ_TOPIC_TAGS_ON_PUBLISH) {
          return res.status(400).json({
            message: "Cannot publish quiz: topic tags are missing for some questions",
            validation,
          });
        }
        validationWarning = validation;
      }
    }

    quiz.isPublished = requestedPublish;
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

    res.json({
      message: quiz.isPublished ? "Quiz published" : "Quiz unpublished",
      quiz,
      validationWarning,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Schedule Quiz ────────────────────────────────────────────────────────────

/**
 * Set or update the availability window for a quiz.
 * Auto-publishes the quiz if a scheduledAt is provided and the quiz is still a draft.
 * Sends a quiz_scheduled notification to enrolled students.
 * @route PUT /api/quizzes/:id/schedule
 * @access Teacher (own course), Admin
 */
export const scheduleQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id).populate("course", "courseNo courseTitle");
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    const canManage = await canManageCourse(req.user._id, quiz.course._id, req.user.role);
    if (!canManage) return res.status(403).json({ message: "You can only schedule your own quizzes" });

    const { scheduledAt, availableUntil } = req.body;

    if (scheduledAt && isNaN(new Date(scheduledAt).getTime())) {
      return res.status(400).json({ message: "Invalid scheduledAt date" });
    }
    if (availableUntil && isNaN(new Date(availableUntil).getTime())) {
      return res.status(400).json({ message: "Invalid availableUntil date" });
    }
    if (scheduledAt && availableUntil && new Date(scheduledAt) >= new Date(availableUntil)) {
      return res.status(400).json({ message: "End time must be after start time" });
    }

    quiz.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    quiz.availableUntil = availableUntil ? new Date(availableUntil) : null;

    // Auto-publish when scheduling so students can see the upcoming quiz in their list
    if (scheduledAt && !quiz.isPublished) {
      quiz.isPublished = true;
    }

    await quiz.save();

    // Notify enrolled students about the scheduled quiz
    if (scheduledAt) {
      const schedDate = new Date(scheduledAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      notifyEnrolledStudents({
        courseId: quiz.course._id,
        type: "quiz_scheduled",
        title: "Quiz Scheduled",
        message: `"${quiz.title}" has been scheduled for ${schedDate} in ${quiz.course.courseNo}.`,
        link: `/courses/${quiz.course._id}/quizzes`,
      }).catch(() => {});
    }

    res.json({ message: "Quiz schedule updated", quiz });
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

    // Enforce schedule window
    const nowCheck = new Date();
    if (quiz.scheduledAt && nowCheck < quiz.scheduledAt) {
      return res.status(400).json({ message: "This quiz is not yet available" });
    }
    if (quiz.availableUntil && nowCheck > quiz.availableUntil) {
      return res.status(400).json({ message: "This quiz is no longer available" });
    }

    const { answers, startedAt, questionOrder, optionOrders } = req.body;
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: "answers array is required" });
    }

    // Auto-grade (supports randomized quizzes)
    let score = 0;
    const totalMarks = quiz.questions.length;
    const hasRandomization =
      Array.isArray(questionOrder) && questionOrder.length === totalMarks &&
      Array.isArray(optionOrders) && optionOrders.length === totalMarks;

    let gradedAnswers;
    if (hasRandomization) {
      gradedAnswers = answers.map((a) => {
        const shuffledPos = Number(a.questionIndex);
        const shuffledOpt = Number(a.selectedAnswer);
        const origQIdx = questionOrder[shuffledPos];
        const origOptIdx = (optionOrders[shuffledPos] || [])[shuffledOpt];
        if (origQIdx !== undefined && origOptIdx !== undefined) {
          const question = quiz.questions[origQIdx];
          if (question && question.correctAnswer === origOptIdx) score++;
        }
        return { questionIndex: origQIdx ?? shuffledPos, selectedAnswer: origOptIdx ?? shuffledOpt };
      });
    } else {
      gradedAnswers = answers.map((a) => {
        const qIndex = Number(a.questionIndex);
        const selected = Number(a.selectedAnswer);
        const question = quiz.questions[qIndex];
        if (question && question.correctAnswer === selected) score++;
        return { questionIndex: qIndex, selectedAnswer: selected };
      });
    }

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
      questionOrder: hasRandomization ? questionOrder : [],
      optionOrders: hasRandomization ? optionOrders : [],
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
