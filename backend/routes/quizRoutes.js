import express from "express";
import {
  generateQuiz,
  createManualQuiz,
  getMyCreatedQuizzes,
  getQuizzesByCourse,
  getQuiz,
  updateQuiz,
  publishQuiz,
  scheduleQuiz,
  deleteQuiz,
  submitAttempt,
  getMyAttempts,
  getQuizResults,
} from "../controllers/quizController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";
import { cacheGet } from "../middleware/cacheMiddleware.js";
import { requireIdempotencyKey, idempotencyGuard } from "../middleware/idempotencyMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Student attempts (must be before /:id to avoid conflict)
router.get("/my-attempts", authorize("student"), cacheGet({ ttl: 20 }), getMyAttempts);

// Teacher: all quizzes created by me across all courses
router.get("/my-created", authorize("teacher", "admin"), cacheGet({ ttl: 20 }), getMyCreatedQuizzes);

// AI generate quiz (teacher/admin)
router.post("/generate", authorize("teacher", "admin"), generateQuiz);

// Manual quiz creation (teacher/admin)
router.post("/manual", authorize("teacher", "admin"), createManualQuiz);

// List quizzes for a course
router.get("/course/:courseId", cacheGet({ ttl: 20 }), getQuizzesByCourse);

// Get single quiz
router.get("/:id", cacheGet({ ttl: 20 }), getQuiz);

// Update quiz (edit questions)
router.put("/:id", authorize("teacher", "admin"), updateQuiz);

// Publish / unpublish quiz
router.put("/:id/publish", authorize("teacher", "admin"), publishQuiz);

// Schedule quiz (set availability window)
router.put("/:id/schedule", authorize("teacher", "admin"), scheduleQuiz);

// Delete quiz + attempts
router.delete("/:id", authorize("teacher", "admin"), deleteQuiz);

// Submit attempt (student)
router.post(
  "/:id/attempt",
  authorize("student"),
  requireIdempotencyKey,
  idempotencyGuard((req) => `quiz:${req.params.id}:student:${req.user._id}`),
  submitAttempt
);

// Teacher views all attempts for a quiz
router.get("/:id/results", authorize("teacher", "admin"), cacheGet({ ttl: 15 }), getQuizResults);

export default router;
