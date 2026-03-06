import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import materialRoutes from './routes/materialRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import feedbackRoutes from "./routes/feedbackRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import enrollmentRoutes from "./routes/enrollmentRoutes.js";
import announcementRoutes from "./routes/announcementRoutes.js";
import discussionRoutes from "./routes/discussionRoutes.js";import assignmentRoutes from './routes/assignmentRoutes.js';import notificationRoutes from './routes/notificationRoutes.js';import deleteResolvedFeedbacks from './utils/cleanupResolvedFeedbacks.js';
import Course, { generateCourseCode } from './models/courseModel.js';

deleteResolvedFeedbacks();

// Backfill courseCode for any existing courses that don't have one
const backfillCourseCodes = async () => {
  try {
    const coursesWithoutCode = await Course.find({
      $or: [{ courseCode: { $exists: false } }, { courseCode: null }, { courseCode: "" }],
    });
    if (coursesWithoutCode.length > 0) {
      for (const course of coursesWithoutCode) {
        course.courseCode = generateCourseCode();
        await course.save();
      }
      console.log(`[Migration] Generated courseCode for ${coursesWithoutCode.length} existing course(s)`);
    }
  } catch (err) {
    console.warn("[Migration] courseCode backfill skipped:", err.message);
  }
};

const app = express();
connectDB().then(() => {
  backfillCourseCodes();
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('Welcome to the Educational Materials API');
});

app.use('/api/auth', authRoutes);

app.use('/api/materials', materialRoutes);

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

// Global error handler for multer and other errors
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  // Handle Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large. Maximum size is 50MB.' });
  }
  
  if (err.message === 'Only PDF, DOCX, PPTX allowed') {
    return res.status(400).json({ message: err.message });
  }
  
  // Handle other errors
  res.status(500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});




