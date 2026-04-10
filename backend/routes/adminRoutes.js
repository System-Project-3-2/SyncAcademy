/**
 * Admin Routes
 * All routes require authentication and admin role
 */
import express from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserStats,
  generateSyntheticData,
  cleanupSyntheticData,
} from "../controllers/adminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

// All routes are protected and require admin role
router.use(protect);
router.use(authorize("admin"));

// User statistics (must be before /:id to avoid conflict)
router.get("/users/stats", getUserStats);

// Synthetic data generation for demos/testing
router.post("/synthetic-data/generate", generateSyntheticData);
router.post("/synthetic-data/cleanup", cleanupSyntheticData);

// User CRUD operations
router.get("/users", getAllUsers);
router.get("/users/:id", getUserById);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

export default router;
