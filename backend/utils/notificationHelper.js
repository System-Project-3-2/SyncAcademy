import Notification from "../models/notificationModel.js";
import Enrollment from "../models/enrollmentModel.js";
import User from "../models/userModel.js";
import { sendEmail } from "./sendEmail.js";

/**
 * Create a single notification
 */
export const createNotification = async ({ recipient, type, title, message, link, metadata }) => {
  try {
    return await Notification.create({ recipient, type, title, message, link, metadata });
  } catch (err) {
    console.warn("[Notification] Failed to create:", err.message);
  }
};

/**
 * Notify all enrolled students in a course (bulk insert)
 * Optionally sends email for important notifications.
 */
export const notifyEnrolledStudents = async ({ courseId, type, title, message, link, metadata, sendEmailFlag = false }) => {
  try {
    const enrollments = await Enrollment.find({ course: courseId, status: "active" }).lean();
    if (!enrollments.length) return;

    const docs = enrollments.map((e) => ({
      recipient: e.student,
      type,
      title,
      message,
      link,
      metadata,
    }));

    await Notification.insertMany(docs);

    if (sendEmailFlag) {
      // Best-effort emails – don't block the caller
      const studentIds = enrollments.map((e) => e.student);
      const students = await User.find({ _id: { $in: studentIds } }, "name email").lean();
      for (const s of students) {
        const emailBody = `Dear ${s.name},\n\n${message}`;
        sendEmail(s.email, title, emailBody, { name: s.name, link }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("[Notification] Bulk notify failed:", err.message);
  }
};

/**
 * Notify the teacher/creator of a course
 */
export const notifyCourseTeacher = async ({ courseId, type, title, message, link, metadata }) => {
  try {
    const Course = (await import("../models/courseModel.js")).default;
    const course = await Course.findById(courseId).lean();
    if (!course) return;
    await createNotification({ recipient: course.createdBy, type, title, message, link, metadata });
  } catch (err) {
    console.warn("[Notification] Teacher notify failed:", err.message);
  }
};
