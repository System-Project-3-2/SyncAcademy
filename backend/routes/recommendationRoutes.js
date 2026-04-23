import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getRecommendationsByUserAndCourse } from "../controllers/knowledgeTracingController.js";

const router = express.Router();

router.get("/recommendations/:userId/:courseId", protect, getRecommendationsByUserAndCourse);

export default router;
