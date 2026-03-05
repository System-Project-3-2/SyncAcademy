import express from "express";

import {
  createFeedback,
  getMyFeedbacks,
  getAllFeedbacks,
  respondToFeedback,
  getTeachers,
} from "../controllers/feedbackController.js";

import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

//student routes
router.get("/teachers", protect, authorize("student"), getTeachers);
router.post("/", protect, authorize("student"), createFeedback);
router.get("/my-feedbacks", protect, authorize("student"), getMyFeedbacks);

//Teacher/Admin routes
router.get("/", protect, authorize("admin", "teacher"), getAllFeedbacks);
router.put(
  "/:id/respond",
  protect,
  authorize("teacher", "admin"),
  respondToFeedback
);

export default router;
