import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";
import {
  createTaxonomyEntry,
  listTaxonomyByCourse,
  createAlias,
  autoTagMaterial,
  autoTagQuiz,
  updateMaterialTopicTags,
  updateQuizQuestionTopicTags,
  getTopicTagCoverageReport,
} from "../controllers/topicTagController.js";

const router = express.Router();

router.use(protect);
router.use(authorize("teacher", "admin"));

router.post("/taxonomy", createTaxonomyEntry);
router.get("/taxonomy/:courseId", listTaxonomyByCourse);

router.post("/aliases", createAlias);

router.post("/materials/:id/auto-tag", autoTagMaterial);
router.put("/materials/:id/topic-tags", updateMaterialTopicTags);

router.post("/quizzes/:quizId/auto-tag", autoTagQuiz);
router.put("/quizzes/:quizId/questions/:questionId/topic-tags", updateQuizQuestionTopicTags);

router.get("/reports/:courseId", getTopicTagCoverageReport);

export default router;
