/**
 * User Routes
 * Routes for user profile operations
 */
import express from "express";
import {
  getProfile,
  updateProfile,
  changePassword,
} from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get current user profile
router.get("/profile", getProfile);

// Update current user profile
router.put("/profile", updateProfile);

// Change password
router.put("/change-password", changePassword);

export default router;
