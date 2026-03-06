/**
 * Course Invitation Routes
 */
import express from "express";
import {
  sendInvitation,
  getReceivedInvitations,
  getSentInvitations,
  respondToInvitation,
  getAllTeachers,
} from "../controllers/courseInvitationController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(authorize("teacher"));

router.get("/teachers", getAllTeachers);
router.get("/received", getReceivedInvitations);
router.get("/sent", getSentInvitations);
router.post("/", sendInvitation);
router.put("/:id/respond", respondToInvitation);

export default router;
