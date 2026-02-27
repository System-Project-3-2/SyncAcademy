/**
 * Statistics Controller
 * Provides dashboard statistics for different user roles
 */
import User from "../models/userModel.js";
import Material from "../models/materialModel.js";
import Feedback from "../models/feedbackModel.js";

/**
 * Get admin dashboard statistics
 * @route GET /api/stats/admin
 * @access Admin only
 */
export const getAdminStats = async (req, res) => {
  try {
    // Get user counts by role
    const totalUsers = await User.countDocuments();
    const students = await User.countDocuments({ role: "student" });
    const teachers = await User.countDocuments({ role: "teacher" });
    const admins = await User.countDocuments({ role: "admin" });
    const verifiedUsers = await User.countDocuments({ isVerified: true });

    // Get material counts
    const totalMaterials = await Material.countDocuments();
    const materialsByType = await Material.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get feedback counts
    const totalFeedbacks = await Feedback.countDocuments();
    const pendingFeedbacks = await Feedback.countDocuments({ status: "pending" });
    const resolvedFeedbacks = await Feedback.countDocuments({ status: "resolved" });

    // Get feedbacks by category
    const feedbacksByCategory = await Feedback.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
    ]);

    // Recent activities (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentUsers = await User.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });
    const recentMaterials = await Material.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });
    const recentFeedbacks = await Feedback.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    res.status(200).json({
      users: {
        total: totalUsers,
        students,
        teachers,
        admins,
        verified: verifiedUsers,
        recentlyAdded: recentUsers,
      },
      materials: {
        total: totalMaterials,
        byType: materialsByType,
        recentlyAdded: recentMaterials,
      },
      feedbacks: {
        total: totalFeedbacks,
        pending: pendingFeedbacks,
        resolved: resolvedFeedbacks,
        byCategory: feedbacksByCategory,
        recentlyAdded: recentFeedbacks,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get teacher dashboard statistics
 * @route GET /api/stats/teacher
 * @access Teacher only
 */
export const getTeacherStats = async (req, res) => {
  try {
    const teacherId = req.user._id;

    // Get material counts uploaded by this teacher
    const totalMaterials = await Material.countDocuments({
      uploadedBy: teacherId,
    });

    const materialsByType = await Material.aggregate([
      { $match: { uploadedBy: teacherId } },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get recent materials (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentMaterials = await Material.countDocuments({
      uploadedBy: teacherId,
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Get feedback counts (all feedbacks visible to teacher)
    const totalFeedbacks = await Feedback.countDocuments();
    const pendingFeedbacks = await Feedback.countDocuments({ status: "pending" });
    const resolvedFeedbacks = await Feedback.countDocuments({ status: "resolved" });

    // Get feedbacks responded by this teacher
    const respondedByTeacher = await Feedback.countDocuments({
      respondedBy: teacherId,
    });

    // Recent feedbacks (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentFeedbacks = await Feedback.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
      status: "pending",
    });

    res.status(200).json({
      materials: {
        total: totalMaterials,
        byType: materialsByType,
        recentlyAdded: recentMaterials,
      },
      feedbacks: {
        total: totalFeedbacks,
        pending: pendingFeedbacks,
        resolved: resolvedFeedbacks,
        respondedByYou: respondedByTeacher,
        recentPending: recentFeedbacks,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get student dashboard statistics
 * @route GET /api/stats/student
 * @access Student only
 */
export const getStudentStats = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Get available materials
    const totalMaterials = await Material.countDocuments();
    const materialsByType = await Material.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get feedback counts for this student
    const myFeedbacks = await Feedback.countDocuments({ student: studentId });
    const pendingFeedbacks = await Feedback.countDocuments({
      student: studentId,
      status: "pending",
    });
    const resolvedFeedbacks = await Feedback.countDocuments({
      student: studentId,
      status: "resolved",
    });

    // Get feedbacks by category for this student
    const feedbacksByCategory = await Feedback.aggregate([
      { $match: { student: studentId } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
    ]);

    // Recent materials added (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentMaterials = await Material.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    res.status(200).json({
      materials: {
        total: totalMaterials,
        byType: materialsByType,
        recentlyAdded: recentMaterials,
      },
      feedbacks: {
        total: myFeedbacks,
        pending: pendingFeedbacks,
        resolved: resolvedFeedbacks,
        byCategory: feedbacksByCategory,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
