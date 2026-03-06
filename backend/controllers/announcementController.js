/**
 * Announcement Controller
 * Handles course-notice-style announcements with comments
 */
import Announcement from "../models/announcementModel.js";
import Course from "../models/courseModel.js";
import Enrollment from "../models/enrollmentModel.js";
import uploadToCloudinary from "../utils/cloudinaryUpload.js";
import { notifyEnrolledStudents, createNotification } from "../utils/notificationHelper.js";
import path from "path";

// â”€â”€â”€ Upload helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

/**
 * Helper: check if user can access (read) a course's announcements
 * - Admin: always yes
 * - Teacher who owns the course: yes
 * - Student enrolled (active) in the course: yes
 */
const canAccessCourse = async (userId, courseId, userRole) => {
  if (userRole === "admin") return { access: true, course: null };

  const course = await Course.findById(courseId).lean();
  if (!course) return { access: false, course: null };

  // Course teacher owns this course
  if (course.createdBy.toString() === userId.toString()) {
    return { access: true, course };
  }

  // Co-teachers get full access
  if ((course.coTeachers || []).some((id) => id.toString() === userId.toString())) {
    return { access: true, course };
  }

  // Check if student (or other teachers) are enrolled
  const enrollment = await Enrollment.findOne({
    student: userId,
    course: courseId,
    status: "active",
  }).lean();

  return { access: !!enrollment, course };
};

/**
 * Helper: check if user can MANAGE (write) announcements for a course
 * - Admin: yes
 * - Teacher who owns the course: yes
 */
const canManageCourse = async (userId, courseId, userRole) => {
  if (userRole === "admin") return true;

  const course = await Course.findById(courseId).lean();
  if (!course) return false;

  return (
    course.createdBy.toString() === userId.toString() ||
    (course.coTeachers || []).some((id) => id.toString() === userId.toString())
  );
};

/**
 * Create an announcement
 * @route POST /api/announcements
 * @access Teacher (own course), Admin
 */
export const createAnnouncement = async (req, res) => {
  try {
    const { courseId, title, content } = req.body;
    let links = [];
    if (req.body.links) {
      links = Array.isArray(req.body.links) ? req.body.links : JSON.parse(req.body.links);
    }

    if (!courseId || !title || !content) {
      return res.status(400).json({ message: "courseId, title, and content are required" });
    }

    const canManage = await canManageCourse(req.user._id, courseId, req.user.role);
    if (!canManage) {
      return res.status(403).json({ message: "You can only post announcements in your own courses" });
    }

    const uploadedAttachments = await uploadFiles(req.files || []);

    const announcement = await Announcement.create({
      course: courseId,
      author: req.user._id,
      title: title.trim(),
      content: content.trim(),
      attachments: uploadedAttachments,
      links: links.filter(Boolean),
    });

    const populated = await Announcement.findById(announcement._id)
      .populate("author", "name email avatar role contribution")
      .populate("course", "courseNo courseTitle")
      .populate("comments.user", "name email avatar role contribution")
      .populate("comments.replies.user", "name email avatar role contribution");

    res.status(201).json(populated);

    // Non-blocking: notify enrolled students about new announcement
    notifyEnrolledStudents({
      courseId,
      type: "announcement",
      title: `New Notice: ${title.trim()}`,
      message: `A new notice "${title.trim()}" has been posted in your course.`,
      link: `/courses/${courseId}/stream`,
      sendEmailFlag: true,
    }).catch(() => {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all announcements for a course (paginated, pinned first then newest)
 * @route GET /api/announcements/course/:courseId
 * @access Enrolled students, Course teacher, Admin
 */
export const getAnnouncementsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const { access } = await canAccessCourse(req.user._id, courseId, req.user.role);
    if (!access) {
      return res.status(403).json({ message: "Access denied. You must be enrolled in this course." });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Announcement.countDocuments({ course: courseId });

    // Pinned first, then by newest
    const announcements = await Announcement.find({ course: courseId })
      .populate("author", "name email avatar role contribution")
      .populate("comments.user", "name email avatar role contribution")
      .populate("comments.replies.user", "name email avatar role contribution")
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get course info
    const course = await Course.findById(courseId)
      .populate("createdBy", "name email")
      .lean();

    // Get enrollment count for this course
    const enrollmentCount = await Enrollment.countDocuments({
      course: courseId,
      status: "active",
    });

    res.status(200).json({
      course: course ? { ...course, enrollmentCount } : null,
      announcements,
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
 * Get single announcement with all comments
 * @route GET /api/announcements/:id
 * @access Enrolled students, Course teacher, Admin
 */
export const getAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate("author", "name email avatar role contribution")
      .populate("course", "courseNo courseTitle createdBy")
      .populate("comments.user", "name email avatar role contribution")
      .populate("comments.replies.user", "name email avatar role contribution");

    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    const { access } = await canAccessCourse(
      req.user._id,
      announcement.course._id,
      req.user.role
    );
    if (!access) {
      return res.status(403).json({ message: "Access denied." });
    }

    res.status(200).json(announcement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update an announcement
 * @route PUT /api/announcements/:id
 * @access Announcement author (teacher), Admin
 */
export const updateAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    const isAuthor = announcement.author.toString() === req.user._id.toString();
    if (!isAuthor && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only edit your own announcements" });
    }

    const { title, content, removeAttachments } = req.body;
    let links = [];
    if (req.body.links) {
      links = Array.isArray(req.body.links) ? req.body.links : JSON.parse(req.body.links);
    }
    if (title) announcement.title = title.trim();
    if (content) announcement.content = content.trim();
    announcement.links = links.filter(Boolean);
    if (removeAttachments) {
      const toRemove = Array.isArray(removeAttachments) ? removeAttachments : JSON.parse(removeAttachments);
      announcement.attachments = announcement.attachments.filter((a) => !toRemove.includes(a.fileUrl));
    }
    const newAttachments = await uploadFiles(req.files || []);
    announcement.attachments = [...announcement.attachments, ...newAttachments];

    const updated = await announcement.save();
    const populated = await Announcement.findById(updated._id)
      .populate("author", "name email avatar role contribution")
      .populate("comments.user", "name email avatar role contribution")
      .populate("comments.replies.user", "name email avatar role contribution");

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete an announcement
 * @route DELETE /api/announcements/:id
 * @access Announcement author (teacher), Admin
 */
export const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    const isAuthor = announcement.author.toString() === req.user._id.toString();
    if (!isAuthor && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only delete your own announcements" });
    }

    await Announcement.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Announcement deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Toggle pin/unpin an announcement
 * @route PUT /api/announcements/:id/pin
 * @access Course teacher, Admin
 */
export const pinAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id).populate("course", "createdBy");
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    const canManage = await canManageCourse(
      req.user._id,
      announcement.course._id,
      req.user.role
    );
    if (!canManage) {
      return res.status(403).json({ message: "Only the course teacher or admin can pin announcements" });
    }

    announcement.isPinned = !announcement.isPinned;
    await announcement.save();

    res.status(200).json({
      isPinned: announcement.isPinned,
      message: announcement.isPinned ? "Announcement pinned" : "Announcement unpinned",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Add a comment to an announcement
 * @route POST /api/announcements/:id/comments
 * @access Enrolled students, Course teacher, Admin
 */
export const addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const announcement = await Announcement.findById(req.params.id).populate("course", "_id");
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    const { access } = await canAccessCourse(
      req.user._id,
      announcement.course._id,
      req.user.role
    );
    if (!access) {
      return res.status(403).json({ message: "Access denied. You must be enrolled in this course." });
    }

    announcement.comments.push({
      user: req.user._id,
      text: text.trim(),
    });
    await announcement.save();

    // Return the populated announcement
    const populated = await Announcement.findById(announcement._id)
      .populate("author", "name email avatar role contribution")
      .populate("comments.user", "name email avatar role contribution")
      .populate("comments.replies.user", "name email avatar role contribution");

    res.status(201).json(populated);

    // Non-blocking: notify announcement author about the comment
    if (announcement.author.toString() !== req.user._id.toString()) {
      createNotification({
        recipient: announcement.author,
        type: "comment",
        title: "New Comment",
        message: `${req.user.name} commented on your announcement.`,
        link: `/courses/${announcement.course._id}/stream`,
      }).catch(() => {});
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Edit a comment
 * @route PUT /api/announcements/:id/comments/:commentId
 * @access Comment owner, Admin
 */
export const editComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: "Comment text is required" });

    const announcement = await Announcement.findById(id);
    if (!announcement) return res.status(404).json({ message: "Announcement not found" });

    const comment = announcement.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const isOwner = comment.user.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only edit your own comments" });
    }

    comment.text = text.trim();
    comment.editedAt = new Date();
    await announcement.save();

    const populated = await Announcement.findById(announcement._id)
      .populate("author", "name email avatar role contribution")
      .populate("comments.user", "name email avatar role contribution")
      .populate("comments.replies.user", "name email avatar role contribution");

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete a comment
 * @route DELETE /api/announcements/:id/comments/:commentId
 * @access Comment author (own comment), Admin
 */
export const deleteComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    const comment = announcement.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const isOwner = comment.user.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only delete your own comments" });
    }

    // Remove comment using subdocument remove
    announcement.comments = announcement.comments.filter(
      (c) => c._id.toString() !== commentId
    );
    await announcement.save();

    const populated = await Announcement.findById(announcement._id)
      .populate("author", "name email avatar role contribution")
      .populate("comments.user", "name email avatar role contribution")
      .populate("comments.replies.user", "name email avatar role contribution");

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// â”€â”€â”€ Comment Reply CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Add a reply to a comment
 * @route POST /api/announcements/:id/comments/:commentId/replies
 * @access Enrolled students, Course teacher, Admin
 */
export const addCommentReply = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Reply text is required" });
    }

    const announcement = await Announcement.findById(id).populate("course", "_id");
    if (!announcement) return res.status(404).json({ message: "Announcement not found" });

    const { access } = await canAccessCourse(req.user._id, announcement.course._id, req.user.role);
    if (!access) return res.status(403).json({ message: "Access denied." });

    const comment = announcement.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const commentAuthor = comment.user;
    comment.replies.push({ user: req.user._id, text: text.trim() });
    await announcement.save();

    const populated = await Announcement.findById(announcement._id)
      .populate("author", "name email avatar role contribution")
      .populate("comments.user", "name email avatar role contribution")
      .populate("comments.replies.user", "name email avatar role contribution");

    res.status(201).json(populated);

    // Non-blocking: notify the comment author about the reply
    if (commentAuthor.toString() !== req.user._id.toString()) {
      createNotification({
        recipient: commentAuthor,
        type: "comment",
        title: "New Reply to Your Comment",
        message: `${req.user.name} replied to your comment on an announcement.`,
        link: `/courses/${announcement.course._id}/stream`,
      }).catch(() => {});
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Edit a comment reply
 * @route PUT /api/announcements/:id/comments/:commentId/replies/:replyId
 * @access Reply owner, Admin
 */
export const editCommentReply = async (req, res) => {
  try {
    const { id, commentId, replyId } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: "Reply text is required" });

    const announcement = await Announcement.findById(id);
    if (!announcement) return res.status(404).json({ message: "Announcement not found" });

    const comment = announcement.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const reply = comment.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    const isOwner = reply.user.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only edit your own replies" });
    }

    reply.text = text.trim();
    reply.editedAt = new Date();
    await announcement.save();

    const populated = await Announcement.findById(announcement._id)
      .populate("author", "name email avatar role contribution")
      .populate("comments.user", "name email avatar role contribution")
      .populate("comments.replies.user", "name email avatar role contribution");

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete a comment reply
 * @route DELETE /api/announcements/:id/comments/:commentId/replies/:replyId
 * @access Reply owner, Admin
 */
export const deleteCommentReply = async (req, res) => {
  try {
    const { id, commentId, replyId } = req.params;

    const announcement = await Announcement.findById(id);
    if (!announcement) return res.status(404).json({ message: "Announcement not found" });

    const comment = announcement.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const reply = comment.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    const isOwner = reply.user.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ message: "You can only delete your own replies" });
    }

    comment.replies = comment.replies.filter((r) => r._id.toString() !== replyId);
    await announcement.save();

    const populated = await Announcement.findById(announcement._id)
      .populate("author", "name email avatar role contribution")
      .populate("comments.user", "name email avatar role contribution")
      .populate("comments.replies.user", "name email avatar role contribution");

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
