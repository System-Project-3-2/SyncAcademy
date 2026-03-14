import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";

import authRoutes from "./routes/authRoutes.js";
import materialRoutes from "./routes/materialRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import enrollmentRoutes from "./routes/enrollmentRoutes.js";
import announcementRoutes from "./routes/announcementRoutes.js";
import discussionRoutes from "./routes/discussionRoutes.js";
import assignmentRoutes from "./routes/assignmentRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import courseInvitationRoutes from "./routes/courseInvitationRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import opsRoutes from "./routes/opsRoutes.js";

import { requestLogger, requestMetrics } from "./middleware/observabilityMiddleware.js";
import { globalRateLimit, apiThrottle, authRateLimit } from "./middleware/rateLimitMiddleware.js";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(requestLogger);
app.use(requestMetrics);
app.use(globalRateLimit);
app.use(apiThrottle);

app.get("/", (_req, res) => {
  res.send("Welcome to the Educational Materials API");
});

app.use("/ops", opsRoutes);
app.use("/api/auth", authRateLimit, authRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/feedbacks", feedbackRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/discussions", discussionRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/course-invitations", courseInvitationRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/jobs", jobRoutes);

app.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "File too large. Maximum size is 50MB." });
  }

  if (err.message === "Only PDF, DOCX, PPTX allowed") {
    return res.status(400).json({ message: err.message });
  }

  res.status(500).json({ message: err.message || "Internal server error" });
});

export default app;
