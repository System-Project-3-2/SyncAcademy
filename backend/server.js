import "dotenv/config";
import connectDB from "./config/db.js";
import { connectRedis } from "./config/redis.js";
import { startTracing, stopTracing } from "./observability/tracing.js";
import logger from "./observability/logger.js";
import deleteResolvedFeedbacks from "./utils/cleanupResolvedFeedbacks.js";
import Course, { generateCourseCode } from "./models/courseModel.js";
import app from "./app.js";

const PORT = Number(process.env.PORT || 5000);

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
      logger.info({ count: coursesWithoutCode.length }, "Backfilled course codes");
    }
  } catch (err) {
    logger.warn({ err }, "Course code backfill skipped");
  }
};

const start = async () => {
  await startTracing();
  await connectDB();
  await connectRedis();

  deleteResolvedFeedbacks();
  await backfillCourseCodes();

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, "Server started");
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, "Graceful shutdown started");
    server.close(async () => {
      await stopTracing();
      logger.info("Server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

start().catch((err) => {
  logger.error({ err }, "Server failed to start");
  process.exit(1);
});




