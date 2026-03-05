import express from "express";
import {
  createAssignment,
  getAssignmentsByCourse,
  getAssignment,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  getMySubmission,
  getSubmissions,
  gradeSubmission,
  getMyGrades,
  publishResult,
  generateResultSheet,
  saveEvaluatedFile,
  toggleEvaluatedVisibility,
} from "../controllers/assignmentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";
import attachmentUpload from "../middleware/attachmentUploadMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Student grades (must be before /:id to avoid conflict)
router.get("/my-grades", authorize("student"), getMyGrades);

// Create assignment (teacher/admin, with optional attachments)
router.post(
  "/",
  authorize("teacher", "admin"),
  attachmentUpload.array("attachments", 5),
  createAssignment
);

// Get assignments for a course
router.get("/course/:courseId", getAssignmentsByCourse);

// Get single assignment
router.get("/:id", getAssignment);

// Update assignment
router.put(
  "/:id",
  authorize("teacher", "admin"),
  attachmentUpload.array("attachments", 5),
  updateAssignment
);

// Delete assignment (cascade deletes submissions)
router.delete("/:id", authorize("teacher", "admin"), deleteAssignment);

// Student submits assignment (single file upload)
router.post(
  "/:id/submit",
  authorize("student"),
  attachmentUpload.single("file"),
  submitAssignment
);

// Student gets own submission
router.get("/:id/my-submission", authorize("student"), getMySubmission);

// Teacher gets all submissions for an assignment
router.get("/:id/submissions", authorize("teacher", "admin"), getSubmissions);

// Teacher grades a submission
router.put(
  "/:id/submissions/:submissionId/grade",
  authorize("teacher", "admin"),
  gradeSubmission
);

// Publish / unpublish result
router.put(
  "/:id/publish-result",
  authorize("teacher", "admin"),
  publishResult
);

// Generate result sheet PDF
router.post(
  "/:id/result-sheet",
  authorize("teacher", "admin"),
  generateResultSheet
);

// Save evaluated (annotated) file for a submission
router.put(
  "/:id/submissions/:submissionId/evaluate",
  authorize("teacher", "admin"),
  attachmentUpload.single("evaluatedFile"),
  saveEvaluatedFile
);

// Toggle evaluated file visibility for student
router.put(
  "/:id/submissions/:submissionId/toggle-evaluated",
  authorize("teacher", "admin"),
  toggleEvaluatedVisibility
);

export default router;
