import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import {
  uploadMaterial,
  deleteMaterial,
  getAllMaterials,
  getMaterialById,
  updateMaterial,
  getMaterialSignedUrl,
} from "../controllers/materialController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Get all materials - All authenticated users (role-based filtering in controller)
router.get("/", protect, getAllMaterials);

// Get single material by ID - All authenticated users (role-based access in controller)
router.get("/:id", protect, getMaterialById);

// Get signed URL for a material file - All authenticated users (role-based access in controller)
router.get("/:id/signed-url", protect, getMaterialSignedUrl);

// Upload material - Teacher and Admin only
router.post("/upload", protect, authorize("teacher", "admin"), upload.single("file"), uploadMaterial);

// Update material - Teacher (own only) and Admin (any)
router.put("/:id", protect, authorize("teacher", "admin"), updateMaterial);

// Delete material - Teacher (own only) and Admin (any)
router.delete("/:id", protect, authorize("teacher", "admin"), deleteMaterial);

export default router;
