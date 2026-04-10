import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";
import {
  logLearningEvent,
  logLearningEventsBulk,
  getFeatureSnapshot,
  predictMyTopicMastery,
  getMyMasteryByCourse,
  getMyWeakTopics,
  getMyMaterialRecommendations,
  getMyLearningInsights,
  getMyExplainabilityByCourse,
  runBackfillMasteryForCourse,
} from "../controllers/knowledgeTracingController.js";

const router = express.Router();

router.use(protect);

// Students create their own learning events.
router.post("/events", authorize("student"), logLearningEvent);

// Students can push batched events from UI sessions.
router.post("/events/bulk", authorize("student"), logLearningEventsBulk);

// Students can inspect generated rolling features.
router.get("/features/:courseId", authorize("student"), getFeatureSnapshot);

// Students request a fresh prediction for a single topic.
router.post("/predict/topic", authorize("student"), predictMyTopicMastery);

// Students retrieve mastery profile for a course.
router.get("/mastery/:courseId", authorize("student"), getMyMasteryByCourse);

// Frontend-friendly shaped insights payload.
router.get("/insights/:courseId", authorize("student"), getMyLearningInsights);

// Explainability payload for mastery, recommendation, and sequence traces.
router.get("/explainability/:courseId", authorize("student"), getMyExplainabilityByCourse);

// Students get weak topics sorted by weakness score.
router.get("/weak-topics/:courseId", authorize("student"), getMyWeakTopics);

// Students get material suggestions driven by weak topics.
router.get("/recommendations/:courseId", authorize("student"), getMyMaterialRecommendations);

// Convenience endpoint for top-3 recommendation view.
router.get("/recommendations/:courseId/top3", authorize("student"), getMyMaterialRecommendations);

// Students can backfill predictions for all observed topics in a course.
router.post("/backfill/:courseId", authorize("student"), runBackfillMasteryForCourse);

export default router;
