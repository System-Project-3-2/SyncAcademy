/**
 * Statistics Controller
 * Provides dashboard statistics for different user roles
 */
import User from "../models/userModel.js";
import Material from "../models/materialModel.js";
import Feedback from "../models/feedbackModel.js";
import Enrollment from "../models/enrollmentModel.js";
import Course from "../models/courseModel.js";
import Assignment from "../models/assignmentModel.js";
import Submission from "../models/submissionModel.js";
import Quiz from "../models/quizModel.js";
import QuizAttempt from "../models/quizAttemptModel.js";

const clampPercentage = (value) => Math.max(0, Math.min(100, Number(value) || 0));

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

    // Enrollment stats
    const totalEnrollments = await Enrollment.countDocuments({ status: "active" });

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
      enrollments: {
        total: totalEnrollments,
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

    // Enrollment stats: students enrolled in teacher's courses
    const teacherCourses = await Course.find({ createdBy: teacherId }).select("_id courseNo courseTitle");
    const teacherCourseIds = teacherCourses.map((c) => c._id);
    const enrolledStudentsTotal = await Enrollment.countDocuments({
      course: { $in: teacherCourseIds },
      status: "active",
    });

    // Enrollment count per course
    const enrollmentsByCourse = await Promise.all(
      teacherCourses.map(async (c) => {
        const count = await Enrollment.countDocuments({ course: c._id, status: "active" });
        return { courseId: c._id, courseNo: c.courseNo, courseTitle: c.courseTitle, enrolledStudents: count };
      })
    );

    // Assignment stats for teacher
    const totalAssignments = await Assignment.countDocuments({ createdBy: teacherId });
    const allTeacherAssignmentIds = await Assignment.find({ createdBy: teacherId }).distinct("_id");
    const pendingGrading = await Submission.countDocuments({
      assignment: { $in: allTeacherAssignmentIds },
      grade: null,
    });

    // Quiz stats for teacher
    const totalQuizzes = await Quiz.countDocuments({ createdBy: teacherId });
    const publishedQuizzes = await Quiz.countDocuments({ createdBy: teacherId, isPublished: true });

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
      enrollments: {
        totalStudents: enrolledStudentsTotal,
        byCourse: enrollmentsByCourse,
      },
      assignments: {
        total: totalAssignments,
        pendingGrading,
      },
      quizzes: {
        total: totalQuizzes,
        published: publishedQuizzes,
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

    // Enrollment stats for student
    const enrolledCourses = await Enrollment.countDocuments({
      student: studentId,
      status: "active",
    });

    const enrolledCourseIds = await Enrollment.find({
      student: studentId,
      status: "active",
    }).distinct("course");

    const enrolledCourseDocs = await Course.find({
      _id: { $in: enrolledCourseIds },
    })
      .select("_id courseNo courseTitle")
      .lean();

    // Assignment stats for student
    const studentAssignments = await Assignment.find({ course: { $in: enrolledCourseIds }, isPublished: true }).select("_id dueDate").lean();
    const studentAssignmentIds = studentAssignments.map((a) => a._id);
    const submittedCount = await Submission.countDocuments({ student: studentId, assignment: { $in: studentAssignmentIds } });
    const gradedCount = await Submission.countDocuments({ student: studentId, assignment: { $in: studentAssignmentIds }, grade: { $ne: null } });
    const now = new Date();
    const dueAssignments = studentAssignments.filter((a) => a.dueDate && new Date(a.dueDate) > now).length;

    // Quiz stats for student
    const availableQuizzes = await Quiz.countDocuments({ course: { $in: enrolledCourseIds }, isPublished: true });
    const attemptedQuizzes = await QuizAttempt.countDocuments({ student: studentId });

    // Performance analytics: average quiz % and assignment % per course, then average both.
    const [quizByCourseRaw, assignmentByCourseRaw] = await Promise.all([
      QuizAttempt.aggregate([
        { $match: { student: studentId } },
        {
          $lookup: {
            from: "quizzes",
            localField: "quiz",
            foreignField: "_id",
            as: "quizDoc",
          },
        },
        { $unwind: "$quizDoc" },
        { $match: { "quizDoc.course": { $in: enrolledCourseIds } } },
        {
          $group: {
            _id: "$quizDoc.course",
            avgQuizPercentage: { $avg: "$percentage" },
            quizAttempts: { $sum: 1 },
          },
        },
      ]),
      Submission.aggregate([
        {
          $match: {
            student: studentId,
            grade: { $ne: null },
          },
        },
        {
          $lookup: {
            from: "assignments",
            localField: "assignment",
            foreignField: "_id",
            as: "assignmentDoc",
          },
        },
        { $unwind: "$assignmentDoc" },
        {
          $match: {
            "assignmentDoc.course": { $in: enrolledCourseIds },
            "assignmentDoc.isResultPublished": true,
            "assignmentDoc.totalMarks": { $gt: 0 },
          },
        },
        {
          $addFields: {
            assignmentPercentage: {
              $multiply: [
                {
                  $divide: ["$grade", "$assignmentDoc.totalMarks"],
                },
                100,
              ],
            },
          },
        },
        {
          $group: {
            _id: "$assignmentDoc.course",
            avgAssignmentPercentage: { $avg: "$assignmentPercentage" },
            gradedAssignments: { $sum: 1 },
          },
        },
      ]),
    ]);

    const quizByCourseMap = new Map(
      quizByCourseRaw.map((item) => [
        item._id.toString(),
        {
          avgQuizPercentage: clampPercentage(item.avgQuizPercentage),
          quizAttempts: Number(item.quizAttempts) || 0,
        },
      ])
    );

    const assignmentByCourseMap = new Map(
      assignmentByCourseRaw.map((item) => [
        item._id.toString(),
        {
          avgAssignmentPercentage: clampPercentage(item.avgAssignmentPercentage),
          gradedAssignments: Number(item.gradedAssignments) || 0,
        },
      ])
    );

    const byCourse = enrolledCourseDocs
      .map((course) => {
        const courseId = course._id.toString();
        const quizStats = quizByCourseMap.get(courseId) || {
          avgQuizPercentage: 0,
          quizAttempts: 0,
        };
        const assignmentStats = assignmentByCourseMap.get(courseId) || {
          avgAssignmentPercentage: 0,
          gradedAssignments: 0,
        };

        const overallAverage = clampPercentage(
          (quizStats.avgQuizPercentage + assignmentStats.avgAssignmentPercentage) / 2
        );

        return {
          courseId,
          courseNo: course.courseNo,
          courseTitle: course.courseTitle,
          quizAverage: Number(quizStats.avgQuizPercentage.toFixed(1)),
          assignmentAverage: Number(assignmentStats.avgAssignmentPercentage.toFixed(1)),
          overallAverage: Number(overallAverage.toFixed(1)),
          quizAttempts: quizStats.quizAttempts,
          gradedAssignments: assignmentStats.gradedAssignments,
          hasPerformanceData:
            quizStats.quizAttempts > 0 || assignmentStats.gradedAssignments > 0,
        };
      })
      .sort((a, b) => b.overallAverage - a.overallAverage);

    const coursesWithData = byCourse.filter((course) => course.hasPerformanceData);
    const overallPerformanceAverage = coursesWithData.length
      ? Number(
          (
            coursesWithData.reduce((sum, course) => sum + course.overallAverage, 0) /
            coursesWithData.length
          ).toFixed(1)
        )
      : 0;

    const bestCourse = coursesWithData.length ? coursesWithData[0] : null;
    const weakestCourse = coursesWithData.length
      ? [...coursesWithData].sort((a, b) => a.overallAverage - b.overallAverage)[0]
      : null;

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
      enrollments: {
        enrolledCourses,
      },
      assignments: {
        total: studentAssignments.length,
        due: dueAssignments,
        submitted: submittedCount,
        graded: gradedCount,
      },
      quizzes: {
        available: availableQuizzes,
        attempted: attemptedQuizzes,
      },
      performanceAnalytics: {
        byCourse,
        summary: {
          overallAverage: overallPerformanceAverage,
          coursesWithData: coursesWithData.length,
          bestCourse: bestCourse
            ? {
                courseId: bestCourse.courseId,
                courseNo: bestCourse.courseNo,
                overallAverage: bestCourse.overallAverage,
              }
            : null,
          weakestCourse: weakestCourse
            ? {
                courseId: weakestCourse.courseId,
                courseNo: weakestCourse.courseNo,
                overallAverage: weakestCourse.overallAverage,
              }
            : null,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
