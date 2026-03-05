import express from "express";
import {
  getDiscussionsByCourse,
  getDiscussion,
  createDiscussion,
  updateDiscussion,
  deleteDiscussion,
  toggleDiscussionStatus,
  addReply,
  editReply,
  deleteReply,
  acceptReply,
  voteDiscussion,
  voteReply,
  addSubReply,
  editSubReply,
  deleteSubReply,
} from "../controllers/discussionController.js";
import { protect } from "../middleware/authMiddleware.js";
import attachmentUpload from "../middleware/attachmentUploadMiddleware.js";

const router = express.Router();

// Get all discussions for a course
router.get("/course/:courseId", protect, getDiscussionsByCourse);

// Get single discussion with replies
router.get("/:id", protect, getDiscussion);

// Create a new discussion (with optional attachments)
router.post("/", protect, attachmentUpload.array("attachments", 5), createDiscussion);

// Update a discussion
router.put("/:id", protect, attachmentUpload.array("attachments", 5), updateDiscussion);

// Delete a discussion
router.delete("/:id", protect, deleteDiscussion);

// Toggle solved/open status
router.put("/:id/status", protect, toggleDiscussionStatus);

// Add a reply (with optional attachments)
router.post("/:id/replies", protect, attachmentUpload.array("attachments", 5), addReply);

// Edit a reply
router.put("/:id/replies/:replyId", protect, editReply);

// Delete a reply
router.delete("/:id/replies/:replyId", protect, deleteReply);

// Accept / un-accept a reply as solution
router.put("/:id/replies/:replyId/accept", protect, acceptReply);

// Vote on a discussion
router.put("/:id/vote", protect, voteDiscussion);

// Vote on a reply
router.put("/:id/replies/:replyId/vote", protect, voteReply);

// Sub-reply (Facebook-style nested reply on a discussion reply)
router.post("/:id/replies/:replyId/subreplies", protect, addSubReply);
router.put("/:id/replies/:replyId/subreplies/:subReplyId", protect, editSubReply);
router.delete("/:id/replies/:replyId/subreplies/:subReplyId", protect, deleteSubReply);

export default router;
