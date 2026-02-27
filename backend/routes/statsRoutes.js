/**
 * Statistics Routes
 * Routes for dashboard statistics
 */
import express from "express";
import {
  getAdminStats,
  getTeacherStats,
  getStudentStats,
} from "../controllers/statsController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Admin statistics
router.get("/admin", authorize("admin"), getAdminStats);

// Teacher statistics
router.get("/teacher", authorize("teacher"), getTeacherStats);

// Student statistics
router.get("/student", authorize("student"), getStudentStats);

export default router;
