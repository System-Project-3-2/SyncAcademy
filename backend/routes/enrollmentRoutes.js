/**
 * Enrollment Routes
 * Routes for course enrollment management
 */
import express from "express";
import {
  enrollInCourse,
  unenrollFromCourse,
  getMyEnrolledCourses,
  getCourseStudents,
  removeStudent,
  getCourseEnrollmentCount,
} from "../controllers/enrollmentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Student routes
router.post("/enroll", authorize("student"), enrollInCourse);
router.post("/unenroll/:courseId", authorize("student"), unenrollFromCourse);
router.get("/my-courses", authorize("student"), getMyEnrolledCourses);

// Teacher/Admin routes
router.get(
  "/course/:courseId/students",
  authorize("teacher", "admin"),
  getCourseStudents
);
router.get(
  "/course/:courseId/count",
  authorize("teacher", "admin"),
  getCourseEnrollmentCount
);
router.delete(
  "/course/:courseId/student/:studentId",
  authorize("teacher", "admin"),
  removeStudent
);

export default router;
