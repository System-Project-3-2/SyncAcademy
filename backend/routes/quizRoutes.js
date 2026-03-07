import express from "express";
import {
  generateQuiz,
  createManualQuiz,
  getQuizzesByCourse,
  getQuiz,
  updateQuiz,
  publishQuiz,
  deleteQuiz,
  submitAttempt,
  getMyAttempts,
  getQuizResults,
} from "../controllers/quizController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Student attempts (must be before /:id to avoid conflict)
router.get("/my-attempts", authorize("student"), getMyAttempts);

// AI generate quiz (teacher/admin)
router.post("/generate", authorize("teacher", "admin"), generateQuiz);

// Manual quiz creation (teacher/admin)
router.post("/manual", authorize("teacher", "admin"), createManualQuiz);

// List quizzes for a course
router.get("/course/:courseId", getQuizzesByCourse);

// Get single quiz
router.get("/:id", getQuiz);

// Update quiz (edit questions)
router.put("/:id", authorize("teacher", "admin"), updateQuiz);

// Publish / unpublish quiz
router.put("/:id/publish", authorize("teacher", "admin"), publishQuiz);

// Delete quiz + attempts
router.delete("/:id", authorize("teacher", "admin"), deleteQuiz);

// Submit attempt (student)
router.post("/:id/attempt", authorize("student"), submitAttempt);

// Teacher views all attempts for a quiz
router.get("/:id/results", authorize("teacher", "admin"), getQuizResults);

export default router;
