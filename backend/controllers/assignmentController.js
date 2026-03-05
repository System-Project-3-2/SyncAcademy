/**
 * Assignment Controller
 * Handles CRUD for assignments and student submissions/grading
 */
import Assignment from "../models/assignmentModel.js";
import Submission from "../models/submissionModel.js";
import Course from "../models/courseModel.js";
import Enrollment from "../models/enrollmentModel.js";
import uploadToCloudinary from "../utils/cloudinaryUpload.js";
import deletefromCloudinary from "../utils/cloudinaryDelete.js";
import path from "path";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

const uploadFiles = async (files = []) => {
  const results = [];
  for (const file of files) {
    const fileUrl = await uploadToCloudinary(file.path);
    results.push({ fileName: file.originalname, fileUrl });
  }
  return results;
};

/**
 * Check if user can manage (create/edit/delete) assignments for a course
 * Admin: always. Teacher: only own course.
 */
const canManageCourse = async (userId, courseId, userRole) => {
  if (userRole === "admin") return true;
  const course = await Course.findById(courseId).lean();
  if (!course) return false;
  return course.createdBy.toString() === userId.toString();
};

/**
 * Check if user can access a course (read)
 * Admin: always. Teacher owner: yes. Enrolled student: yes.
 */
const canAccessCourse = async (userId, courseId, userRole) => {
  if (userRole === "admin") return true;
  const course = await Course.findById(courseId).lean();
  if (!course) return false;
  if (course.createdBy.toString() === userId.toString()) return true;
  const enrollment = await Enrollment.findOne({
    student: userId,
    course: courseId,
    status: "active",
  }).lean();
  return !!enrollment;
};

// ─── Assignment CRUD ──────────────────────────────────────────────────────────

/**
 * Create assignment
 * @route POST /api/assignments
 * @access Teacher (own course), Admin
 */
export const createAssignment = async (req, res) => {
  try {
    const { courseId, title, description, dueDate, totalMarks, isPublished } = req.body;

    if (!courseId || !title) {
      return res.status(400).json({ message: "courseId and title are required" });
    }

    const canManage = await canManageCourse(req.user._id, courseId, req.user.role);
    if (!canManage) {
      return res.status(403).json({ message: "You can only create assignments in your own courses" });
    }

    const uploadedAttachments = await uploadFiles(req.files || []);

    const assignment = await Assignment.create({
      course: courseId,
      createdBy: req.user._id,
      title: title.trim(),
      description: description ? description.trim() : "",
      dueDate: dueDate || undefined,
      totalMarks: totalMarks ? Number(totalMarks) : 100,
      isPublished: isPublished !== undefined ? isPublished === "true" || isPublished === true : true,
      attachments: uploadedAttachments,
    });

    const populated = await Assignment.findById(assignment._id)
      .populate("createdBy", "name email avatar")
      .populate("course", "courseNo courseTitle");

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get assignments for a course (paginated)
 * @route GET /api/assignments/course/:courseId
 * @access Enrolled students, Course teacher, Admin
 */
export const getAssignmentsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const hasAccess = await canAccessCourse(req.user._id, courseId, req.user.role);
    if (!hasAccess) {
      return res.status(403).json({ message: "You do not have access to this course" });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const filter = { course: courseId, isPublished: true };

    // Teachers/admins also see unpublished
    if (req.user.role === "teacher" || req.user.role === "admin") {
      delete filter.isPublished;
    }

    const [assignments, total] = await Promise.all([
      Assignment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("createdBy", "name email avatar")
        .lean(),
      Assignment.countDocuments(filter),
    ]);

    // For students, attach their submission status
    if (req.user.role === "student") {
      const assignmentIds = assignments.map((a) => a._id);
      const submissions = await Submission.find({
        assignment: { $in: assignmentIds },
        student: req.user._id,
      }).lean();

      const subMap = {};
      submissions.forEach((s) => {
        subMap[s.assignment.toString()] = s;
      });

      assignments.forEach((a) => {
        const sub = subMap[a._id.toString()];
        if (sub) {
          a.submissionStatus = sub.grade !== null && sub.grade !== undefined ? "graded" : "submitted";
          a.myGrade = sub.grade;
        } else {
          a.submissionStatus = "not_submitted";
        }
      });
    }

    res.json({
      assignments,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get single assignment
 * @route GET /api/assignments/:id
 * @access Enrolled students, Course teacher, Admin
 */
export const getAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate("createdBy", "name email avatar")
      .populate("course", "courseNo courseTitle");

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const hasAccess = await canAccessCourse(req.user._id, assignment.course._id, req.user.role);
    if (!hasAccess) {
      return res.status(403).json({ message: "You do not have access to this assignment" });
    }

    res.json(assignment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update assignment
 * @route PUT /api/assignments/:id
 * @access Teacher (own course), Admin
 */
export const updateAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const canManage = await canManageCourse(req.user._id, assignment.course, req.user.role);
    if (!canManage) {
      return res.status(403).json({ message: "You can only edit assignments in your own courses" });
    }

    const { title, description, dueDate, totalMarks, isPublished, removeAttachments } = req.body;

    if (title) assignment.title = title.trim();
    if (description !== undefined) assignment.description = description.trim();
    if (dueDate !== undefined) assignment.dueDate = dueDate || undefined;
    if (totalMarks !== undefined) assignment.totalMarks = Number(totalMarks);
    if (isPublished !== undefined) assignment.isPublished = isPublished === "true" || isPublished === true;

    // Remove specified attachments
    if (removeAttachments) {
      const toRemove = Array.isArray(removeAttachments) ? removeAttachments : [removeAttachments];
      for (const url of toRemove) {
        try { await deletefromCloudinary(url); } catch { /* best effort */ }
      }
      assignment.attachments = assignment.attachments.filter(
        (a) => !toRemove.includes(a.fileUrl)
      );
    }

    // Upload new attachments
    const newFiles = await uploadFiles(req.files || []);
    assignment.attachments.push(...newFiles);

    await assignment.save();

    const populated = await Assignment.findById(assignment._id)
      .populate("createdBy", "name email avatar")
      .populate("course", "courseNo courseTitle");

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete assignment (cascade deletes submissions)
 * @route DELETE /api/assignments/:id
 * @access Teacher (own course), Admin
 */
export const deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const canManage = await canManageCourse(req.user._id, assignment.course, req.user.role);
    if (!canManage) {
      return res.status(403).json({ message: "You can only delete assignments in your own courses" });
    }

    // Delete attachments from cloudinary
    for (const att of assignment.attachments) {
      try { await deletefromCloudinary(att.fileUrl); } catch { /* best effort */ }
    }

    // Delete submission files from cloudinary
    const submissions = await Submission.find({ assignment: assignment._id }).lean();
    for (const sub of submissions) {
      if (sub.fileUrl) {
        try { await deletefromCloudinary(sub.fileUrl); } catch { /* best effort */ }
      }
    }

    // Cascade delete submissions
    await Submission.deleteMany({ assignment: assignment._id });
    await Assignment.findByIdAndDelete(assignment._id);

    res.json({ message: "Assignment and all submissions deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Submissions ──────────────────────────────────────────────────────────────

/**
 * Submit assignment (student uploads file)
 * @route POST /api/assignments/:id/submit
 * @access Student (enrolled)
 */
export const submitAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Check enrollment
    const enrolled = await Enrollment.findOne({
      student: req.user._id,
      course: assignment.course,
      status: "active",
    }).lean();

    if (!enrolled) {
      return res.status(403).json({ message: "You are not enrolled in this course" });
    }

    // Check if already submitted
    const existing = await Submission.findOne({
      assignment: assignment._id,
      student: req.user._id,
    });

    let fileUrl = existing?.fileUrl || "";
    let fileName = existing?.fileName || "";

    // Upload new file if provided
    if (req.file) {
      // Delete old file if re-submitting
      if (existing?.fileUrl) {
        try { await deletefromCloudinary(existing.fileUrl); } catch { /* best effort */ }
      }
      fileUrl = await uploadToCloudinary(req.file.path);
      fileName = req.file.originalname;
    }

    const { textContent } = req.body;
    const now = new Date();
    const isLate = assignment.dueDate ? now > new Date(assignment.dueDate) : false;

    if (existing) {
      // Update existing submission
      existing.fileUrl = fileUrl;
      existing.fileName = fileName;
      if (textContent !== undefined) existing.textContent = textContent;
      existing.submittedAt = now;
      existing.isLate = isLate;
      await existing.save();

      const populated = await Submission.findById(existing._id)
        .populate("student", "name email avatar")
        .populate("assignment", "title dueDate totalMarks");

      return res.json(populated);
    }

    // Create new submission
    const submission = await Submission.create({
      assignment: assignment._id,
      student: req.user._id,
      fileUrl,
      fileName,
      textContent: textContent || "",
      submittedAt: now,
      isLate,
    });

    const populated = await Submission.findById(submission._id)
      .populate("student", "name email avatar")
      .populate("assignment", "title dueDate totalMarks");

    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "You have already submitted this assignment" });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get student's own submission for an assignment
 * @route GET /api/assignments/:id/my-submission
 * @access Student
 */
export const getMySubmission = async (req, res) => {
  try {
    const submission = await Submission.findOne({
      assignment: req.params.id,
      student: req.user._id,
    })
      .populate("student", "name email avatar")
      .populate("gradedBy", "name email avatar")
      .populate("assignment", "title dueDate totalMarks");

    res.json(submission || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all submissions for an assignment (teacher view)
 * @route GET /api/assignments/:id/submissions
 * @access Teacher (own course), Admin
 */
export const getSubmissions = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const canManage = await canManageCourse(req.user._id, assignment.course, req.user.role);
    if (!canManage) {
      return res.status(403).json({ message: "Access denied" });
    }

    const submissions = await Submission.find({ assignment: assignment._id })
      .populate("student", "name email avatar")
      .populate("gradedBy", "name email avatar")
      .sort({ submittedAt: -1 });

    // Also get total enrolled students for stats
    const totalEnrolled = await Enrollment.countDocuments({
      course: assignment.course,
      status: "active",
    });

    res.json({
      submissions,
      stats: {
        totalEnrolled,
        totalSubmitted: submissions.length,
        totalGraded: submissions.filter((s) => s.grade !== null && s.grade !== undefined).length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Grade a submission
 * @route PUT /api/assignments/:id/submissions/:submissionId/grade
 * @access Teacher (own course), Admin
 */
export const gradeSubmission = async (req, res) => {
  try {
    const { grade, feedback } = req.body;

    if (grade === undefined || grade === null) {
      return res.status(400).json({ message: "Grade is required" });
    }

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const canManage = await canManageCourse(req.user._id, assignment.course, req.user.role);
    if (!canManage) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (Number(grade) < 0 || Number(grade) > assignment.totalMarks) {
      return res.status(400).json({ message: `Grade must be between 0 and ${assignment.totalMarks}` });
    }

    const submission = await Submission.findOne({
      _id: req.params.submissionId,
      assignment: assignment._id,
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    submission.grade = Number(grade);
    submission.feedback = feedback || "";
    submission.gradedBy = req.user._id;
    submission.gradedAt = new Date();
    await submission.save();

    const populated = await Submission.findById(submission._id)
      .populate("student", "name email avatar")
      .populate("gradedBy", "name email avatar")
      .populate("assignment", "title dueDate totalMarks");

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all grades for a student across all courses
 * @route GET /api/assignments/my-grades
 * @access Student
 */
export const getMyGrades = async (req, res) => {
  try {
    const submissions = await Submission.find({ student: req.user._id })
      .populate({
        path: "assignment",
        select: "title dueDate totalMarks course",
        populate: {
          path: "course",
          select: "courseNo courseTitle",
        },
      })
      .populate("gradedBy", "name email avatar")
      .sort({ submittedAt: -1 });

    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
