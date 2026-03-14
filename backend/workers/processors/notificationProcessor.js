import Notification from "../../models/notificationModel.js";
import Enrollment from "../../models/enrollmentModel.js";

export const notificationProcessor = async (job) => {
  const { courseId, type, title, message, link, metadata } = job.data;

  const enrollments = await Enrollment.find({ course: courseId, status: "active" }).lean();
  if (!enrollments.length) return { inserted: 0 };

  const docs = enrollments.map((e) => ({
    recipient: e.student,
    type,
    title,
    message,
    link,
    metadata,
  }));

  await Notification.insertMany(docs);
  return { inserted: docs.length };
};
