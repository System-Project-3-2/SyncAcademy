import express from "express";
import { getMyJobs, getJobById } from "../controllers/jobController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/", getMyJobs);
router.get("/:id", getJobById);

export default router;
