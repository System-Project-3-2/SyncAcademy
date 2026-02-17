import Feedback from "../models/feedbackModel.js";
import User from "../models/userModel.js";
import { sendEmail } from "../utils/sendEmail.js";

export const createFeedback = async (req, res) => {
  try {
    const { title, message, category } = req.body;

    const studentFeedback = {
      student: req.user._id,
      title,
      message,
      category,
    };

    const feedback = await Feedback.create(studentFeedback);
    res.status(201).json(feedback);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// STUDENT: View own feedbacks with optional pagination
export const getMyFeedbacks = async (req, res) => {
  try {
    const { page, limit, status, sort = "-createdAt" } = req.query;
    const filter = { student: req.user._id };
    if (status && status !== "all") filter.status = status;

    // If no pagination params, return all (backward compatible)
    if (!page && !limit) {
      const feedbacks = await Feedback.find(filter).sort(sort);
      return res.json(feedbacks);
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;
    const total = await Feedback.countDocuments(filter);

    const feedbacks = await Feedback.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    res.json({
      data: feedbacks,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


//view all feedbacks with optional pagination - ADMIN/Teacher
export const getAllFeedbacks = async (req, res) => {
  try {
    const { page, limit, status, category, sort = "-createdAt" } = req.query;
    const filter = {};
    if (status && status !== "all") filter.status = status;
    if (category && category !== "all") filter.category = category;

    // If no pagination params, return all (backward compatible)
    if (!page && !limit) {
      const feedbacks = await Feedback.find(filter)
        .populate("student", "name email")
        .populate("respondedBy", "name email")
        .sort(sort);
      return res.json(feedbacks);
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;
    const total = await Feedback.countDocuments(filter);

    const feedbacks = await Feedback.find(filter)
      .populate("student", "name email")
      .populate("respondedBy", "name email")
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    res.json({
      data: feedbacks,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const respondToFeedback = async (req, res) => {
  try {
    const { response } = req.body;

    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    feedback.response = response;
    feedback.status = "resolved";
    feedback.resolvedAt = new Date();
    feedback.respondedBy = req.user._id;

    await feedback.save();

    // Send email notification to the student (non-blocking)
    try {
      const student = await User.findById(feedback.student);
      if (student && student.email) {
        const emailSubject = `Feedback Response: ${feedback.title}`;
        const emailBody = `Dear ${student.name},\n\nYour feedback titled "${feedback.title}" has been responded to.\n\nResponse:\n${response}\n\nThank you for your feedback!\n\n- Student Aid System`;
        await sendEmail(student.email, emailSubject, emailBody);
      }
    } catch (emailError) {
      // Non-critical: email notification is best-effort
      console.warn("[INFO] Feedback email notification skipped:", emailError.message);
    }

    res.json(feedback);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
