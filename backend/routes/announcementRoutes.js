import express from "express";
import {
  createAnnouncement,
  getAnnouncementsByCourse,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  pinAnnouncement,
  addComment,
  editComment,
  deleteComment,
  addCommentReply,
  editCommentReply,
  deleteCommentReply,
} from "../controllers/announcementController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";
import attachmentUpload from "../middleware/attachmentUploadMiddleware.js";

const router = express.Router();

// Create announcement (with optional file attachments)
router.post("/", protect, authorize("teacher", "admin"), attachmentUpload.array("attachments", 5), createAnnouncement);

// Get all announcements for a course (any enrolled user, teacher, or admin)
router.get("/course/:courseId", protect, getAnnouncementsByCourse);

// Get single announcement
router.get("/:id", protect, getAnnouncement);

// Update announcement (with optional new file attachments)
router.put("/:id", protect, authorize("teacher", "admin"), attachmentUpload.array("attachments", 5), updateAnnouncement);

// Delete announcement
router.delete("/:id", protect, deleteAnnouncement);

// Pin / unpin announcement
router.put("/:id/pin", protect, authorize("teacher", "admin"), pinAnnouncement);

// Add comment
router.post("/:id/comments", protect, addComment);

// Edit comment
router.put("/:id/comments/:commentId", protect, editComment);

// Delete comment
router.delete("/:id/comments/:commentId", protect, deleteComment);

// Add reply to a comment
router.post("/:id/comments/:commentId/replies", protect, addCommentReply);

// Edit a comment reply
router.put("/:id/comments/:commentId/replies/:replyId", protect, editCommentReply);

// Delete a comment reply
router.delete("/:id/comments/:commentId/replies/:replyId", protect, deleteCommentReply);

export default router;
