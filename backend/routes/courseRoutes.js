/**
 * Course Routes
 * Routes for course management
 */
import express from "express";
import {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  getDepartments,
  regenerateCourseCode,
} from "../controllers/courseController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Meta routes (must be before /:id)
router.get("/meta/departments", getDepartments);

// Get all courses - all authenticated users
router.get("/", getAllCourses);

// Get single course
router.get("/:id", getCourseById);

// Create course - Teacher and Admin only
router.post("/", authorize("teacher", "admin"), createCourse);

// Update course - Teacher (own) and Admin (any)
router.put("/:id", authorize("teacher", "admin"), updateCourse);

// Delete course - Teacher (own) and Admin (any)
router.delete("/:id", authorize("teacher", "admin"), deleteCourse);

// Regenerate course code - Teacher (own) and Admin (any)
router.post("/:id/regenerate-code", authorize("teacher", "admin"), regenerateCourseCode);

export default router;
