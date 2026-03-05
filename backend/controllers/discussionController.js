/**
 * Discussion Controller
 * Course Q&A â€“ any enrolled user can post a problem and anyone can reply.
 */
import Discussion from "../models/discussionModel.js";
import Course from "../models/courseModel.js";
import Enrollment from "../models/enrollmentModel.js";
import User from "../models/userModel.js";
import uploadToCloudinary from "../utils/cloudinaryUpload.js";
import path from "path";

// â”€â”€â”€ Upload helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const uploadFiles = async (files = []) => {
  const results = [];
  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();
    const fileUrl = await uploadToCloudinary(file.path);
    results.push({ fileName: file.originalname, fileUrl, fileType: IMAGE_EXTS.has(ext) ? "image" : "document" });
  }
  return results;
};

// â”€â”€â”€ Access Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const canAccessCourse = async (userId, courseId, userRole) => {
  if (userRole === "admin") return true;
  const course = await Course.findById(courseId).lean();
  if (!course) return false;
  if (course.createdBy.toString() === userId.toString()) return true;
  const enrollment = await Enrollment.findOne({ student: userId, course: courseId, status: "active" }).lean();
  return !!enrollment;
};

// â”€â”€â”€ Discussion CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get all discussions for a course
 * @route GET /api/discussions/course/:courseId
 * @access Enrolled users, Teacher, Admin
 */
export const getDiscussionsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    const access = await canAccessCourse(req.user._id, courseId, req.user.role);
    if (!access) return res.status(403).json({ message: "Access denied." });

    const filter = { course: courseId };
    if (status && ["open", "solved"].includes(status)) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Discussion.countDocuments(filter);

    const discussions = await Discussion.find(filter)
      .populate("author", "name email avatar role contribution")
      .select("-replies")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Add reply count
    const withCount = discussions.map((d) => {
      const obj = d.toObject();
      obj.replyCount = 0; // replies not loaded; get count separately
      return obj;
    });

    // Get reply counts in a separate query
    const ids = discussions.map((d) => d._id);
    const replyCounts = await Discussion.aggregate([
      { $match: { _id: { $in: ids } } },
      { $project: { replyCount: { $size: "$replies" } } },
    ]);
    const countMap = {};
    replyCounts.forEach((r) => { countMap[r._id.toString()] = r.replyCount; });
    const final = withCount.map((d) => ({ ...d, replyCount: countMap[d._id.toString()] || 0 }));

    res.status(200).json({
      discussions: final,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get single discussion with all replies
 * @route GET /api/discussions/:id
 * @access Enrolled users, Teacher, Admin
 */
export const getDiscussion = async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id)
      .populate("author", "name email avatar role contribution")
      .populate("replies.user", "name email avatar role contribution")
      .populate("replies.subReplies.user", "name email avatar role contribution");

    if (!discussion) return res.status(404).json({ message: "Discussion not found" });

    const access = await canAccessCourse(req.user._id, discussion.course, req.user.role);
    if (!access) return res.status(403).json({ message: "Access denied." });

    res.status(200).json(discussion);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Create a discussion
 * @route POST /api/discussions
 * @access Enrolled students, Teacher, Admin
 */
export const createDiscussion = async (req, res) => {
  try {
    const { courseId, title, content } = req.body;
    let links = [];
    if (req.body.links) {
      links = Array.isArray(req.body.links) ? req.body.links : JSON.parse(req.body.links);
    }
    let tags = [];
    if (req.body.tags) {
      tags = Array.isArray(req.body.tags) ? req.body.tags : JSON.parse(req.body.tags);
    }

    if (!courseId || !title || !content) {
      return res.status(400).json({ message: "courseId, title, and content are required" });
    }

    const access = await canAccessCourse(req.user._id, courseId, req.user.role);
    if (!access) return res.status(403).json({ message: "You must be enrolled in this course to post." });

    const uploadedAttachments = await uploadFiles(req.files || []);

    const discussion = await Discussion.create({
      course: courseId,
      author: req.user._id,
      title: title.trim(),
      content: content.trim(),
      attachments: uploadedAttachments,
      links: links.filter(Boolean),
      tags: tags.filter(Boolean),
    });

    const populated = await Discussion.findById(discussion._id)
      .populate("author", "name email avatar role contribution");

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update a discussion
 * @route PUT /api/discussions/:id
 * @access Author, Admin
 */
export const updateDiscussion = async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id);
    if (!discussion) return res.status(404).json({ message: "Discussion not found" });

    const isAuthor = discussion.author.toString() === req.user._id.toString();
    if (!isAuthor && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only edit your own discussions" });
    }

    const { title, content, removeAttachments } = req.body;
    let links = [];
    if (req.body.links) {
      links = Array.isArray(req.body.links) ? req.body.links : JSON.parse(req.body.links);
    }

    if (title) discussion.title = title.trim();
    if (content) discussion.content = content.trim();
    discussion.links = links.filter(Boolean);

    if (removeAttachments) {
      const toRemove = Array.isArray(removeAttachments) ? removeAttachments : JSON.parse(removeAttachments);
      discussion.attachments = discussion.attachments.filter((a) => !toRemove.includes(a.fileUrl));
    }
    const newAttachments = await uploadFiles(req.files || []);
    discussion.attachments = [...discussion.attachments, ...newAttachments];

    await discussion.save();
    const populated = await Discussion.findById(discussion._id)
      .populate("author", "name email avatar role contribution")
      .populate("replies.user", "name email avatar role contribution")
      .populate("replies.subReplies.user", "name email avatar role contribution");

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete a discussion
 * @route DELETE /api/discussions/:id
 * @access Author, Teacher of course, Admin
 */
export const deleteDiscussion = async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id);
    if (!discussion) return res.status(404).json({ message: "Discussion not found" });

    const isAuthor = discussion.author.toString() === req.user._id.toString();
    const course = await Course.findById(discussion.course).lean();
    const isTeacher = course && course.createdBy.toString() === req.user._id.toString();
    if (!isAuthor && !isTeacher && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied." });
    }

    await Discussion.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Discussion deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Mark discussion as solved/open
 * @route PUT /api/discussions/:id/status
 * @access Author, Teacher, Admin
 */
export const toggleDiscussionStatus = async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id);
    if (!discussion) return res.status(404).json({ message: "Discussion not found" });

    const isAuthor = discussion.author.toString() === req.user._id.toString();
    const course = await Course.findById(discussion.course).lean();
    const isTeacher = course && course.createdBy.toString() === req.user._id.toString();
    if (!isAuthor && !isTeacher && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only the poster, teacher, or admin can change status." });
    }

    discussion.status = discussion.status === "open" ? "solved" : "open";
    await discussion.save();
    res.status(200).json({ status: discussion.status, message: `Marked as ${discussion.status}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// â”€â”€â”€ Reply CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Add a reply
 * @route POST /api/discussions/:id/replies
 * @access Enrolled users, Teacher, Admin
 */
export const addReply = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: "Reply content is required" });

    const discussion = await Discussion.findById(req.params.id);
    if (!discussion) return res.status(404).json({ message: "Discussion not found" });

    const access = await canAccessCourse(req.user._id, discussion.course, req.user.role);
    if (!access) return res.status(403).json({ message: "Access denied." });

    let links = [];
    if (req.body.links) {
      links = Array.isArray(req.body.links) ? req.body.links : JSON.parse(req.body.links);
    }
    const uploadedAttachments = await uploadFiles(req.files || []);

    discussion.replies.push({
      user: req.user._id,
      content: content.trim(),
      attachments: uploadedAttachments,
      links: links.filter(Boolean),
    });
    await discussion.save();

    const populated = await Discussion.findById(discussion._id)
      .populate("author", "name email avatar role contribution")
      .populate("replies.user", "name email avatar role contribution")
      .populate("replies.subReplies.user", "name email avatar role contribution");

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Edit a reply
 * @route PUT /api/discussions/:id/replies/:replyId
 * @access Reply owner, Admin
 */
export const editReply = async (req, res) => {
  try {
    const { id, replyId } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: "Reply content is required" });

    const discussion = await Discussion.findById(id);
    if (!discussion) return res.status(404).json({ message: "Discussion not found" });

    const reply = discussion.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    const isOwner = reply.user.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only edit your own replies" });
    }

    reply.content = content.trim();
    reply.editedAt = new Date();
    await discussion.save();

    const populated = await Discussion.findById(discussion._id)
      .populate("author", "name email avatar role contribution")
      .populate("replies.user", "name email avatar role contribution")
      .populate("replies.subReplies.user", "name email avatar role contribution");

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete a reply
 * @route DELETE /api/discussions/:id/replies/:replyId
 * @access Reply owner, Teacher, Admin
 */
export const deleteReply = async (req, res) => {
  try {
    const { id, replyId } = req.params;

    const discussion = await Discussion.findById(id);
    if (!discussion) return res.status(404).json({ message: "Discussion not found" });

    const reply = discussion.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    const isOwner = reply.user.toString() === req.user._id.toString();
    const course = await Course.findById(discussion.course).lean();
    const isTeacher = course && course.createdBy.toString() === req.user._id.toString();
    if (!isOwner && !isTeacher && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied." });
    }

    discussion.replies = discussion.replies.filter((r) => r._id.toString() !== replyId);
    await discussion.save();

    const populated = await Discussion.findById(discussion._id)
      .populate("author", "name email avatar role contribution")
      .populate("replies.user", "name email avatar role contribution")
      .populate("replies.subReplies.user", "name email avatar role contribution");

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Mark/unmark a reply as accepted solution
 * @route PUT /api/discussions/:id/replies/:replyId/accept
 * @access Discussion author, Teacher, Admin
 */
export const acceptReply = async (req, res) => {
  try {
    const { id, replyId } = req.params;

    const discussion = await Discussion.findById(id);
    if (!discussion) return res.status(404).json({ message: "Discussion not found" });

    const isAuthor = discussion.author.toString() === req.user._id.toString();
    const course = await Course.findById(discussion.course).lean();
    const isTeacher = course && course.createdBy.toString() === req.user._id.toString();
    if (!isAuthor && !isTeacher && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only the poster, teacher, or admin can accept a reply." });
    }

    const reply = discussion.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    // Toggle accept on this reply, un-accept all others
    const wasAccepted = reply.isAccepted;
    discussion.replies.forEach((r) => { r.isAccepted = false; });
    reply.isAccepted = !wasAccepted;

    // Auto-mark discussion as solved when accepting a reply
    if (!wasAccepted) discussion.status = "solved";
    await discussion.save();

    const populated = await Discussion.findById(discussion._id)
      .populate("author", "name email avatar role contribution")
      .populate("replies.user", "name email avatar role contribution")
      .populate("replies.subReplies.user", "name email avatar role contribution");

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Voting ───────────────────────────────────────────────────────────────────

/**
 * Vote on a discussion (upvote / downvote / remove vote)
 * @route PUT /api/discussions/:id/vote
 * @access Enrolled users, Teacher, Admin
 * @body { value: 1 | -1 | 0 }   0 = remove vote
 */
export const voteDiscussion = async (req, res) => {
  try {
    const { value } = req.body;
    if (![1, -1, 0].includes(value)) {
      return res.status(400).json({ message: "value must be 1, -1, or 0" });
    }

    const discussion = await Discussion.findById(req.params.id);
    if (!discussion) return res.status(404).json({ message: "Discussion not found" });

    const access = await canAccessCourse(req.user._id, discussion.course, req.user.role);
    if (!access) return res.status(403).json({ message: "Access denied." });

    const userId = req.user._id.toString();
    const existingIdx = discussion.votes.findIndex((v) => v.user.toString() === userId);
    const oldValue = existingIdx >= 0 ? discussion.votes[existingIdx].value : 0;

    // Remove existing vote
    if (existingIdx >= 0) discussion.votes.splice(existingIdx, 1);

    // Add new vote if not 0
    if (value !== 0) discussion.votes.push({ user: req.user._id, value });

    await discussion.save();

    // Update the discussion author's contribution
    const contributionDelta = (value !== 0 ? value : 0) - oldValue;
    if (contributionDelta !== 0 && discussion.author.toString() !== userId) {
      await User.findByIdAndUpdate(discussion.author, { $inc: { contribution: contributionDelta } });
    }

    const populated = await Discussion.findById(discussion._id)
      .populate("author", "name email avatar role contribution")
      .populate("replies.user", "name email avatar role contribution")
      .populate("replies.subReplies.user", "name email avatar role contribution");

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Vote on a reply
 * @route PUT /api/discussions/:id/replies/:replyId/vote
 * @access Enrolled users, Teacher, Admin
 * @body { value: 1 | -1 | 0 }
 */
export const voteReply = async (req, res) => {
  try {
    const { id, replyId } = req.params;
    const { value } = req.body;
    if (![1, -1, 0].includes(value)) {
      return res.status(400).json({ message: "value must be 1, -1, or 0" });
    }

    const discussion = await Discussion.findById(id);
    if (!discussion) return res.status(404).json({ message: "Discussion not found" });

    const access = await canAccessCourse(req.user._id, discussion.course, req.user.role);
    if (!access) return res.status(403).json({ message: "Access denied." });

    const reply = discussion.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    const userId = req.user._id.toString();
    const existingIdx = reply.votes.findIndex((v) => v.user.toString() === userId);
    const oldValue = existingIdx >= 0 ? reply.votes[existingIdx].value : 0;

    if (existingIdx >= 0) reply.votes.splice(existingIdx, 1);
    if (value !== 0) reply.votes.push({ user: req.user._id, value });

    await discussion.save();

    // Update reply author's contribution
    const contributionDelta = (value !== 0 ? value : 0) - oldValue;
    if (contributionDelta !== 0 && reply.user.toString() !== userId) {
      await User.findByIdAndUpdate(reply.user, { $inc: { contribution: contributionDelta } });
    }

    const populated = await Discussion.findById(discussion._id)
      .populate("author", "name email avatar role contribution")
      .populate("replies.user", "name email avatar role contribution")
      .populate("replies.subReplies.user", "name email avatar role contribution");

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Sub-replies (Facebook-style nested replies on a discussion reply)

export const addSubReply = async (req, res) => {
  try {
    const { id, replyId } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: "Content is required" });

    const discussion = await Discussion.findById(id);
    if (!discussion) return res.status(404).json({ message: "Discussion not found" });

    const access = await canAccessCourse(req.user._id, discussion.course, req.user.role);
    if (!access) return res.status(403).json({ message: "Access denied." });

    const reply = discussion.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    reply.subReplies.push({ user: req.user._id, content: content.trim() });
    await discussion.save();

    const populated = await Discussion.findById(discussion._id)
      .populate("author", "name email avatar role contribution")
      .populate("replies.user", "name email avatar role contribution")
      .populate("replies.subReplies.user", "name email avatar role contribution");

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const editSubReply = async (req, res) => {
  try {
    const { id, replyId, subReplyId } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: "Content is required" });

    const discussion = await Discussion.findById(id);
    if (!discussion) return res.status(404).json({ message: "Discussion not found" });

    const reply = discussion.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    const subReply = reply.subReplies.id(subReplyId);
    if (!subReply) return res.status(404).json({ message: "Sub-reply not found" });

    if (subReply.user.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only edit your own replies" });
    }

    subReply.content = content.trim();
    subReply.editedAt = new Date();
    await discussion.save();

    const populated = await Discussion.findById(discussion._id)
      .populate("author", "name email avatar role contribution")
      .populate("replies.user", "name email avatar role contribution")
      .populate("replies.subReplies.user", "name email avatar role contribution");

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteSubReply = async (req, res) => {
  try {
    const { id, replyId, subReplyId } = req.params;

    const discussion = await Discussion.findById(id);
    if (!discussion) return res.status(404).json({ message: "Discussion not found" });

    const reply = discussion.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    const subReply = reply.subReplies.id(subReplyId);
    if (!subReply) return res.status(404).json({ message: "Sub-reply not found" });

    const isOwner = subReply.user.toString() === req.user._id.toString();
    const course = await Course.findById(discussion.course).lean();
    const isTeacher = course && course.createdBy.toString() === req.user._id.toString();
    if (!isOwner && !isTeacher && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied." });
    }

    reply.subReplies = reply.subReplies.filter((sr) => sr._id.toString() !== subReplyId);
    await discussion.save();

    const populated = await Discussion.findById(discussion._id)
      .populate("author", "name email avatar role contribution")
      .populate("replies.user", "name email avatar role contribution")
      .populate("replies.subReplies.user", "name email avatar role contribution");

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

