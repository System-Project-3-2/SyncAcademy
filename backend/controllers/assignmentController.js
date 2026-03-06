/**
 * Assignment Controller
 * Handles CRUD for assignments and student submissions/grading
 */
import Assignment from "../models/assignmentModel.js";
import Submission from "../models/submissionModel.js";
import Course from "../models/courseModel.js";
import Enrollment from "../models/enrollmentModel.js";
import User from "../models/userModel.js";
import uploadToCloudinary from "../utils/cloudinaryUpload.js";
import deletefromCloudinary from "../utils/cloudinaryDelete.js";
import path from "path";
import PDFDocument from "pdfkit";
import { notifyEnrolledStudents, createNotification } from "../utils/notificationHelper.js";
import { sendEmail } from "../utils/sendEmail.js";
import fs from "fs";
import os from "os";

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
  return (
    course.createdBy.toString() === userId.toString() ||
    (course.coTeachers || []).some((id) => id.toString() === userId.toString())
  );
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
  if ((course.coTeachers || []).some((id) => id.toString() === userId.toString())) return true;
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
    const { courseId, title, description, dueDate, totalMarks, isPublished, allowLateSubmission } = req.body;

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
      allowLateSubmission: allowLateSubmission !== undefined ? allowLateSubmission === "true" || allowLateSubmission === true : true,
      attachments: uploadedAttachments,
    });

    const populated = await Assignment.findById(assignment._id)
      .populate("createdBy", "name email avatar")
      .populate("course", "courseNo courseTitle");

    res.status(201).json(populated);

    // Non-blocking: notify enrolled students
    notifyEnrolledStudents({
      courseId,
      type: "assignment_created",
      title: "New Assignment",
      message: `New assignment "${title.trim()}" has been posted.`,
      link: `/courses/${courseId}/assignments`,
      sendEmailFlag: true,
    }).catch(() => {});
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
          if (sub.grade !== null && sub.grade !== undefined) {
            a.submissionStatus = a.isResultPublished ? "graded" : "submitted";
            a.myGrade = a.isResultPublished ? sub.grade : undefined;
          } else {
            a.submissionStatus = "submitted";
          }
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

    const { title, description, dueDate, totalMarks, isPublished, removeAttachments, allowLateSubmission } = req.body;

    if (title) assignment.title = title.trim();
    if (description !== undefined) assignment.description = description.trim();
    if (dueDate !== undefined) assignment.dueDate = dueDate || undefined;
    if (totalMarks !== undefined) assignment.totalMarks = Number(totalMarks);
    if (isPublished !== undefined) assignment.isPublished = isPublished === "true" || isPublished === true;
    if (allowLateSubmission !== undefined) assignment.allowLateSubmission = allowLateSubmission === "true" || allowLateSubmission === true;

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

    // Block new/updated submissions once results are published
    if (assignment.isResultPublished) {
      return res.status(403).json({ message: "Submissions are closed. Results have been published." });
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

    // Block late submission if not allowed
    if (isLate && !assignment.allowLateSubmission) {
      return res.status(403).json({ message: "Late submission is not allowed for this assignment" });
    }

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
      .populate("assignment", "title dueDate totalMarks isResultPublished allowLateSubmission");

    if (submission) {
      const sub = submission.toObject();
      // Hide grade info if result is not published
      if (!sub.assignment?.isResultPublished) {
        sub.grade = null;
        sub.feedback = "";
        sub.gradedBy = null;
        sub.gradedAt = null;
      }
      // Hide evaluated file if teacher has not enabled visibility
      if (!sub.showEvaluatedToStudent) {
        sub.evaluatedFileUrl = "";
      }
      return res.json(sub);
    }

    res.json(null);
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
      .populate("student", "name email avatar idNumber")
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

    // Non-blocking: notify the student that their submission was graded
    createNotification({
      recipient: submission.student,
      type: "assignment_graded",
      title: "Assignment Graded",
      message: `Your submission for "${assignment.title}" has been graded.`,
      link: `/student/courses/${assignment.course}/assignments/${assignment._id}/submit`,
    }).catch(() => {});
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
        select: "title dueDate totalMarks course isResultPublished",
        populate: {
          path: "course",
          select: "courseNo courseTitle",
        },
      })
      .populate("gradedBy", "name email avatar")
      .sort({ submittedAt: -1 });

    // Hide grade info for assignments where result is not published
    const result = submissions.map((s) => {
      const sub = s.toObject();
      if (!sub.assignment?.isResultPublished) {
        sub.grade = null;
        sub.feedback = "";
        sub.gradedBy = null;
        sub.gradedAt = null;
      }
      return sub;
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Publish / unpublish result for an assignment
 * @route PUT /api/assignments/:id/publish-result
 * @access Teacher (own course), Admin
 */
export const publishResult = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const canManage = await canManageCourse(req.user._id, assignment.course, req.user.role);
    if (!canManage) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { publish } = req.body;
    assignment.isResultPublished = !!publish;
    await assignment.save();

    res.json({ message: publish ? "Result published" : "Result unpublished", isResultPublished: assignment.isResultPublished });

    // Non-blocking: notify enrolled students when result is published
    if (publish) {
      notifyEnrolledStudents({
        courseId: assignment.course,
        type: "result_published",
        title: "Result Published",
        message: `Results for "${assignment.title}" have been published.`,
        link: `/student/my-grades`,
        sendEmailFlag: true,
      }).catch(() => {});
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Generate result sheet PDF for an assignment
 * @route POST /api/assignments/:id/result-sheet
 * @access Teacher (own course), Admin
 */
export const generateResultSheet = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate("course", "courseNo courseTitle")
      .populate("createdBy", "name");

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const canManage = await canManageCourse(req.user._id, assignment.course._id, req.user.role);
    if (!canManage) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Get all enrolled students
    const enrollments = await Enrollment.find({
      course: assignment.course._id,
      status: "active",
    }).populate("student", "name email idNumber");

    // Get all submissions
    const submissions = await Submission.find({ assignment: assignment._id })
      .populate("student", "name email idNumber");

    const subMap = {};
    submissions.forEach((s) => {
      subMap[s.student._id.toString()] = s;
    });

    // Build result rows
    const rows = enrollments.map((e) => {
      const sub = subMap[e.student._id.toString()];
      return {
        idNumber: e.student.idNumber || "N/A",
        name: e.student.name,
        grade: sub
          ? sub.grade !== null && sub.grade !== undefined
            ? sub.grade
            : "Not Graded"
          : "Absent",
      };
    });

    // Sort by idNumber
    rows.sort((a, b) => (a.idNumber || "").localeCompare(b.idNumber || ""));

    // Calculate stats
    const gradedSubmissions = submissions.filter((s) => s.grade !== null && s.grade !== undefined);
    const highestMark = gradedSubmissions.length > 0 ? Math.max(...gradedSubmissions.map((s) => s.grade)) : 0;
    const lowestMark = gradedSubmissions.length > 0 ? Math.min(...gradedSubmissions.map((s) => s.grade)) : 0;
    const avgMark = gradedSubmissions.length > 0
      ? (gradedSubmissions.reduce((sum, s) => sum + s.grade, 0) / gradedSubmissions.length).toFixed(2)
      : 0;

    // Generate PDF
    const tmpFile = path.join(os.tmpdir(), `result_${assignment._id}_${Date.now()}.pdf`);
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = fs.createWriteStream(tmpFile);
    doc.pipe(stream);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    // Colors
    const primaryColor = "#1565C0";
    const darkColor = "#0D47A1";
    const headerBg = "#1565C0";
    const headerText = "#FFFFFF";
    const lightBg = "#E3F2FD";
    const accentColor = "#FF6F00";
    const borderColor = "#BBDEFB";
    const textDark = "#212121";
    const textMuted = "#616161";

    // ─── Helper: draw horizontal rule ───
    const drawLine = (yPos, color = borderColor) => {
      doc.moveTo(margin, yPos).lineTo(pageWidth - margin, yPos).strokeColor(color).lineWidth(1).stroke();
    };

    // ─── Header Banner ───
    doc.rect(0, 0, pageWidth, 100).fill(headerBg);
    doc.rect(0, 100, pageWidth, 4).fill(accentColor);

    doc.fontSize(22).font("Helvetica-Bold").fill(headerText);
    doc.text("RESULT SHEET", margin, 25, { align: "center", width: contentWidth });
    doc.fontSize(11).font("Helvetica").fill("#BBDEFB");
    doc.text("Student Aid — Academic Performance Report", margin, 55, { align: "center", width: contentWidth });
    doc.fontSize(9).fill("#90CAF5");
    doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`, margin, 75, { align: "center", width: contentWidth });

    let y = 120;

    // ─── Course & Assignment Info Box ───
    doc.roundedRect(margin, y, contentWidth, 80, 5).fill(lightBg);
    doc.roundedRect(margin, y, contentWidth, 80, 5).strokeColor(borderColor).lineWidth(1).stroke();

    doc.fontSize(13).font("Helvetica-Bold").fill(darkColor);
    doc.text(assignment.course.courseNo + " — " + assignment.course.courseTitle, margin + 15, y + 10, { width: contentWidth - 30 });
    doc.fontSize(10).font("Helvetica").fill(textDark);
    doc.text(`Assignment: ${assignment.title}`, margin + 15, y + 30, { width: contentWidth - 30 });
    const infoLine = [];
    infoLine.push(`Total Marks: ${assignment.totalMarks}`);
    if (assignment.dueDate) {
      infoLine.push(`Due: ${new Date(assignment.dueDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`);
    }
    infoLine.push(`Instructor: ${assignment.createdBy?.name || "N/A"}`);
    doc.fontSize(9).fill(textMuted);
    doc.text(infoLine.join("   |   "), margin + 15, y + 50, { width: contentWidth - 30 });

    y += 100;

    // ─── Summary Statistics Cards ───
    const statBoxWidth = (contentWidth - 30) / 4;
    const stats = [
      { label: "Enrolled", value: enrollments.length, color: "#1565C0" },
      { label: "Submitted", value: submissions.length, color: "#2E7D32" },
      { label: "Absent", value: enrollments.length - submissions.length, color: "#E65100" },
      { label: "Graded", value: gradedSubmissions.length, color: "#6A1B9A" },
    ];

    stats.forEach((stat, i) => {
      const x = margin + i * (statBoxWidth + 10);
      doc.roundedRect(x, y, statBoxWidth, 50, 4).fill("#FAFAFA");
      doc.roundedRect(x, y, statBoxWidth, 50, 4).strokeColor(stat.color).lineWidth(1.5).stroke();
      doc.fontSize(18).font("Helvetica-Bold").fill(stat.color);
      doc.text(String(stat.value), x, y + 8, { width: statBoxWidth, align: "center" });
      doc.fontSize(8).font("Helvetica").fill(textMuted);
      doc.text(stat.label, x, y + 32, { width: statBoxWidth, align: "center" });
    });

    y += 65;

    // ─── Performance Metrics ───
    const metricsBoxW = (contentWidth - 20) / 3;
    const metrics = [
      { label: "Highest Mark", value: highestMark },
      { label: "Lowest Mark", value: lowestMark },
      { label: "Average Mark", value: avgMark },
    ];
    metrics.forEach((m, i) => {
      const x = margin + i * (metricsBoxW + 10);
      doc.roundedRect(x, y, metricsBoxW, 35, 3).fill("#FFF3E0");
      doc.roundedRect(x, y, metricsBoxW, 35, 3).strokeColor("#FFB74D").lineWidth(0.5).stroke();
      doc.fontSize(12).font("Helvetica-Bold").fill(accentColor);
      doc.text(String(m.value), x + 10, y + 6, { width: metricsBoxW - 20 });
      doc.fontSize(8).font("Helvetica").fill(textMuted);
      doc.text(m.label, x + 10, y + 22, { width: metricsBoxW - 20 });
    });

    y += 50;
    drawLine(y, primaryColor);
    y += 10;

    // ─── Results Table ───
    const colWidths = { serial: 30, id: 90, name: 260, mark: 115 };
    const tableStartX = margin;
    const rowHeight = 22;

    const drawTableHeader = (yPos) => {
      doc.rect(tableStartX, yPos, contentWidth, rowHeight + 4).fill(headerBg);
      doc.fontSize(9).font("Helvetica-Bold").fill(headerText);
      let x = tableStartX + 8;
      doc.text("#", x, yPos + 6, { width: colWidths.serial });
      x += colWidths.serial;
      doc.text("Student ID", x, yPos + 6, { width: colWidths.id });
      x += colWidths.id;
      doc.text("Student Name", x, yPos + 6, { width: colWidths.name });
      x += colWidths.name;
      doc.text("Mark", x, yPos + 6, { width: colWidths.mark, align: "center" });
      return yPos + rowHeight + 4;
    };

    y = drawTableHeader(y);

    doc.font("Helvetica").fontSize(9).fill(textDark);

    rows.forEach((row, i) => {
      // Page break if needed
      if (y > pageHeight - 80) {
        // Footer on current page
        doc.fontSize(7).fill(textMuted);
        doc.text(`Page ${doc.bufferedPageRange().count}`, margin, pageHeight - 30, { width: contentWidth, align: "center" });
        doc.addPage();
        y = 30;
        // Banner stripe on continuation page
        doc.rect(0, 0, pageWidth, 4).fill(primaryColor);
        y = 15;
        y = drawTableHeader(y);
        doc.font("Helvetica").fontSize(9);
      }

      // Alternate row colors
      const rowBg = i % 2 === 0 ? "#FFFFFF" : lightBg;
      doc.rect(tableStartX, y, contentWidth, rowHeight).fill(rowBg);

      // Row borders
      doc.rect(tableStartX, y, contentWidth, rowHeight).strokeColor(borderColor).lineWidth(0.5).stroke();

      doc.fill(textDark);
      let x = tableStartX + 8;
      doc.text(String(i + 1), x, y + 5, { width: colWidths.serial });
      x += colWidths.serial;
      doc.font("Courier").text(String(row.idNumber), x, y + 5, { width: colWidths.id });
      x += colWidths.id;
      doc.font("Helvetica").text(row.name, x, y + 5, { width: colWidths.name });
      x += colWidths.name;

      // Mark with color coding
      const markStr = String(row.grade);
      if (row.grade === "Absent") {
        doc.font("Helvetica-Bold").fill("#D32F2F").text(markStr, x, y + 5, { width: colWidths.mark, align: "center" });
      } else if (row.grade === "Not Graded") {
        doc.font("Helvetica").fill(textMuted).text(markStr, x, y + 5, { width: colWidths.mark, align: "center" });
      } else {
        const pct = (Number(row.grade) / assignment.totalMarks) * 100;
        const markColor = pct >= 80 ? "#2E7D32" : pct >= 50 ? "#F57F17" : "#D32F2F";
        doc.font("Helvetica-Bold").fill(markColor).text(`${markStr} / ${assignment.totalMarks}`, x, y + 5, { width: colWidths.mark, align: "center" });
      }

      doc.font("Helvetica").fill(textDark);
      y += rowHeight;
    });

    // Bottom border of table
    drawLine(y, primaryColor);

    // ─── Footer ───
    y += 15;
    doc.rect(0, pageHeight - 40, pageWidth, 40).fill("#F5F5F5");
    doc.rect(0, pageHeight - 40, pageWidth, 1).fill(primaryColor);
    doc.fontSize(7).fill(textMuted);
    doc.text("This is a system-generated document from Student Aid.", margin, pageHeight - 30, { width: contentWidth / 2 });
    doc.text(`Page ${doc.bufferedPageRange().count}`, margin, pageHeight - 30, { width: contentWidth, align: "right" });

    doc.end();

    await new Promise((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    // Upload to Cloudinary
    const pdfUrl = await uploadToCloudinary(tmpFile);

    // Clean up temp file
    fs.unlink(tmpFile, () => {});

    // Store URL on assignment
    assignment.resultSheetUrl = pdfUrl;
    await assignment.save();

    res.json({ resultSheetUrl: pdfUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Save evaluated (annotated) file for a submission
 * @route PUT /api/assignments/:id/submissions/:submissionId/evaluate
 * @access Teacher (own course), Admin
 */
export const saveEvaluatedFile = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const canManage = await canManageCourse(req.user._id, assignment.course, req.user.role);
    if (!canManage) {
      return res.status(403).json({ message: "Access denied" });
    }

    const submission = await Submission.findOne({
      _id: req.params.submissionId,
      assignment: assignment._id,
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file provided" });
    }

    // Delete old evaluated file if exists
    if (submission.evaluatedFileUrl) {
      try { await deletefromCloudinary(submission.evaluatedFileUrl); } catch { /* best effort */ }
    }

    const fileUrl = await uploadToCloudinary(req.file.path);
    submission.evaluatedFileUrl = fileUrl;
    await submission.save();

    res.json({ evaluatedFileUrl: fileUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Toggle evaluated file visibility for student
 * @route PUT /api/assignments/:id/submissions/:submissionId/toggle-evaluated
 * @access Teacher (own course), Admin
 */
export const toggleEvaluatedVisibility = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const canManage = await canManageCourse(req.user._id, assignment.course, req.user.role);
    if (!canManage) {
      return res.status(403).json({ message: "Access denied" });
    }

    const submission = await Submission.findOne({
      _id: req.params.submissionId,
      assignment: assignment._id,
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const { show } = req.body;
    submission.showEvaluatedToStudent = !!show;
    await submission.save();

    res.json({ showEvaluatedToStudent: submission.showEvaluatedToStudent });

    // Non-blocking: notify student when evaluated script becomes visible
    if (show) {
      createNotification({
        recipient: submission.student,
        type: "evaluated_script",
        title: "Evaluated Script Available",
        message: `Your evaluated script for "${assignment.title}" is now available.`,
        link: `/student/courses/${assignment.course}/assignments/${assignment._id}/submit`,
      }).catch(() => {});

      // Also send email
      try {
        const student = await User.findById(submission.student, "name email").lean();
        if (student?.email) {
          const evalLink = `/student/courses/${assignment.course}/assignments/${assignment._id}/submit`;
          sendEmail(
            student.email,
            "Evaluated Script Available",
            `Your evaluated script for "${assignment.title}" is now available.`,
            { name: student.name, link: evalLink }
          ).catch(() => {});
        }
      } catch (_) { /* best effort */ }
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
