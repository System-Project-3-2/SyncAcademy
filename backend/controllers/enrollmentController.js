/**
 * Enrollment Controller
 * Handles student course enrollment operations
 */
import Enrollment from "../models/enrollmentModel.js";
import Course from "../models/courseModel.js";
import Material from "../models/materialModel.js";
import User from "../models/userModel.js";

/**
 * Enroll in a course using secret course code
 * @route POST /api/enrollments/enroll
 * @access Student
 */
export const enrollInCourse = async (req, res) => {
  try {
    const { courseCode } = req.body;
    const studentId = req.user._id;

    // Support both courseCode (new) and courseNo (legacy) field names
    const code = courseCode || req.body.courseNo;

    if (!code) {
      return res.status(400).json({ message: "Course code is required" });
    }

    // Try finding by courseCode first, then fall back to courseNo for backward compatibility
    let course = await Course.findOne({ courseCode: code.trim() });
    if (!course) {
      course = await Course.findOne({ courseNo: code.trim() });
    }
    if (!course) {
      return res
        .status(404)
        .json({ message: "No course found with that code. Please check the code and try again." });
    }

    // Check if already enrolled
    const existing = await Enrollment.findOne({
      student: studentId,
      course: course._id,
    });

    if (existing) {
      if (existing.status === "active") {
        return res
          .status(400)
          .json({ message: "You are already enrolled in this course" });
      }
      // Re-activate a previously dropped enrollment
      existing.status = "active";
      existing.enrolledAt = new Date();
      await existing.save();

      const populated = await Enrollment.findById(existing._id)
        .populate("course")
        .populate("student", "name email");

      return res
        .status(200)
        .json({ message: "Re-enrolled successfully", enrollment: populated });
    }

    // Create new enrollment
    const enrollment = await Enrollment.create({
      student: studentId,
      course: course._id,
    });

    const populated = await Enrollment.findById(enrollment._id)
      .populate("course")
      .populate("student", "name email");

    res
      .status(201)
      .json({ message: "Enrolled successfully", enrollment: populated });
  } catch (error) {
    // Handle duplicate key error (race condition)
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: "You are already enrolled in this course" });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * Unenroll from a course
 * @route POST /api/enrollments/unenroll/:courseId
 * @access Student
 */
export const unenrollFromCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user._id;

    const enrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId,
      status: "active",
    });

    if (!enrollment) {
      return res
        .status(404)
        .json({ message: "You are not enrolled in this course" });
    }

    enrollment.status = "dropped";
    await enrollment.save();

    res.status(200).json({ message: "Unenrolled successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get the current student's enrolled courses
 * @route GET /api/enrollments/my-courses
 * @access Student
 */
export const getMyEnrolledCourses = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { search } = req.query;

    const enrollments = await Enrollment.find({
      student: studentId,
      status: "active",
    }).populate({
      path: "course",
      populate: { path: "createdBy", select: "name email" },
    });

    let courses = enrollments
      .filter((e) => e.course) // filter out any deleted courses
      .map((e) => ({
        ...e.course.toObject(),
        enrollmentId: e._id,
        enrolledAt: e.enrolledAt,
      }));

    // Optional search filter
    if (search) {
      const regex = new RegExp(search, "i");
      courses = courses.filter(
        (c) => regex.test(c.courseNo) || regex.test(c.courseTitle)
      );
    }

    // Add material count for each course
    const coursesWithCounts = await Promise.all(
      courses.map(async (course) => {
        const materialCount = await Material.countDocuments({
          courseNo: course.courseNo,
        });
        return { ...course, materialCount };
      })
    );

    res.status(200).json(coursesWithCounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get students enrolled in a specific course
 * @route GET /api/enrollments/course/:courseId/students
 * @access Teacher, Admin
 */
export const getCourseStudents = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { search } = req.query;

    // Verify the course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // For teachers, only show students in their own courses
    if (
      req.user.role === "teacher" &&
      course.createdBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You can only view students in your own courses" });
    }

    const enrollments = await Enrollment.find({
      course: courseId,
      status: "active",
    }).populate("student", "name email avatar createdAt");

    let students = enrollments
      .filter((e) => e.student)
      .map((e) => ({
        _id: e.student._id,
        name: e.student.name,
        email: e.student.email,
        avatar: e.student.avatar,
        joinedPlatform: e.student.createdAt,
        enrollmentId: e._id,
        enrolledAt: e.enrolledAt,
      }));

    // Optional search filter
    if (search) {
      const regex = new RegExp(search, "i");
      students = students.filter(
        (s) => regex.test(s.name) || regex.test(s.email)
      );
    }

    res.status(200).json({
      course: {
        _id: course._id,
        courseNo: course.courseNo,
        courseTitle: course.courseTitle,
        courseCode: course.courseCode,
      },
      students,
      totalStudents: students.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Remove a student from a course
 * @route DELETE /api/enrollments/course/:courseId/student/:studentId
 * @access Teacher, Admin
 */
export const removeStudent = async (req, res) => {
  try {
    const { courseId, studentId } = req.params;

    // Verify the course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // For teachers, only allow removing from their own courses
    if (
      req.user.role === "teacher" &&
      course.createdBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({
          message: "You can only remove students from your own courses",
        });
    }

    const enrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId,
      status: "active",
    });

    if (!enrollment) {
      return res
        .status(404)
        .json({ message: "Student is not enrolled in this course" });
    }

    enrollment.status = "dropped";
    await enrollment.save();

    res.status(200).json({ message: "Student removed from course" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get enrollment count for a course (used internally/by course endpoints)
 * @route GET /api/enrollments/course/:courseId/count
 * @access Teacher, Admin
 */
export const getCourseEnrollmentCount = async (req, res) => {
  try {
    const { courseId } = req.params;
    const count = await Enrollment.countDocuments({
      course: courseId,
      status: "active",
    });
    res.status(200).json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
