import express from "express";
import {
  sendMessage,
  getSessions,
  getSession,
  deleteSession,
  clearSessions,
  healthCheck,
} from "../controllers/chatController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// All chat routes require authentication
router.use(protect);

// Health check — is Ollama running?
router.get("/health", healthCheck);

// Send a message (creates session if needed)
router.post("/", sendMessage);

// Chat session CRUD
router.get("/sessions", getSessions);
router.delete("/sessions", clearSessions);
router.get("/sessions/:id", getSession);
router.delete("/sessions/:id", deleteSession);

export default router;
