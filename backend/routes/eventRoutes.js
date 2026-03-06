/**
 * Event Routes
 */
import express from "express";
import {
  createEvent,
  getMyEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  registerForEvent,
  getMyRegistrations,
  saveMarks,
  getMarks,
  downloadDetailedResult,
  downloadResultSheetPdf,
} from "../controllers/eventController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect);

// Student routes
router.post("/register", authorize("student"), registerForEvent);
router.get("/my-registrations", authorize("student"), getMyRegistrations);

// Teacher routes
router.post("/", authorize("teacher"), createEvent);
router.get("/", authorize("teacher"), getMyEvents);
router.get("/:id", authorize("teacher"), getEventById);
router.put("/:id", authorize("teacher"), updateEvent);
router.delete("/:id", authorize("teacher"), deleteEvent);
router.post("/:id/marks", authorize("teacher"), saveMarks);
router.get("/:id/marks", authorize("teacher"), getMarks);
router.get("/:id/detailed-result", authorize("teacher"), downloadDetailedResult);
router.get("/:id/result-sheet-pdf", authorize("teacher"), downloadResultSheetPdf);

export default router;
