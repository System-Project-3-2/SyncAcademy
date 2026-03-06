import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAll,
} from "../controllers/notificationController.js";

const router = express.Router();

// All routes require authentication (any role)
router.use(protect);

router.get("/", getMyNotifications);
router.get("/unread-count", getUnreadCount);
router.put("/read-all", markAllAsRead);
router.put("/:id/read", markAsRead);
router.delete("/:id", deleteNotification);
router.delete("/", clearAll);

export default router;
