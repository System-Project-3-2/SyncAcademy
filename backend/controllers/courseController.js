/**
 * Course Controller
 * CRUD operations for course management
 */
import Course, { generateCourseCode } from "../models/courseModel.js";
import Material from "../models/materialModel.js";

/**
 * Create a new course
 * @route POST /api/courses
 * @access Teacher, Admin
 */
export const createCourse = async (req, res) => {
  try {
    const { courseNo, courseTitle, description, department, semester } = req.body;

    if (!courseNo || !courseTitle) {
      return res.status(400).json({ message: "Course number and title are required" });
    }

    const existing = await Course.findOne({ courseNo });
    if (existing) {
      return res.status(400).json({ message: "A course with this number already exists" });
    }

    const course = await Course.create({
      courseNo,
      courseTitle,
      description,
      department,
      semester,
      createdBy: req.user._id,
    });

    const populated = await Course.findById(course._id).populate("createdBy", "name email");
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all courses with optional filters and pagination
 * @route GET /api/courses
 * @access All authenticated users
 */
export const getAllCourses = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, department, semester, sort = "-createdAt" } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { courseNo: { $regex: search, $options: "i" } },
        { courseTitle: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
      ];
    }
    if (department) filter.department = department;
    if (semester) filter.semester = semester;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Course.countDocuments(filter);

    const courses = await Course.find(filter)
      .populate("createdBy", "name email")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get material counts for each course
    const coursesWithCounts = await Promise.all(
      courses.map(async (course) => {
        const materialCount = await Material.countDocuments({ courseNo: course.courseNo });
        const courseObj = { ...course.toObject(), materialCount };
        // Hide courseCode from students — only teachers/admins can see it
        if (req.user.role === "student") {
          delete courseObj.courseCode;
        }
        return courseObj;
      })
    );

    res.status(200).json({
      data: coursesWithCounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get single course by ID
 * @route GET /api/courses/:id
 * @access All authenticated users
 */
export const getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate("createdBy", "name email");

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const materialCount = await Material.countDocuments({ courseNo: course.courseNo });
    res.status(200).json({ ...course.toObject(), materialCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update a course
 * @route PUT /api/courses/:id
 * @access Teacher (own), Admin (any)
 */
export const updateCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Teachers can only update their own courses
    if (req.user.role === "teacher" && course.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied. You can only update your own courses." });
    }

    const { courseTitle, description, department, semester } = req.body;

    if (courseTitle) course.courseTitle = courseTitle;
    if (description !== undefined) course.description = description;
    if (department !== undefined) course.department = department;
    if (semester !== undefined) course.semester = semester;

    const updated = await course.save();
    const populated = await Course.findById(updated._id).populate("createdBy", "name email");

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete a course
 * @route DELETE /api/courses/:id
 * @access Teacher (own), Admin (any)
 */
export const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Teachers can only delete their own courses
    if (req.user.role === "teacher" && course.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied. You can only delete your own courses." });
    }

    // Check if there are materials linked to this course
    const materialCount = await Material.countDocuments({ courseNo: course.courseNo });
    if (materialCount > 0) {
      return res.status(400).json({
        message: `Cannot delete course. ${materialCount} material(s) are linked to it. Remove them first.`,
      });
    }

    await Course.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Course deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get distinct departments
 * @route GET /api/courses/meta/departments
 * @access All authenticated users
 */
export const getDepartments = async (req, res) => {
  try {
    const departments = await Course.distinct("department", { department: { $ne: "" } });
    res.status(200).json(departments.sort());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Regenerate course code (secret enrollment key)
 * @route POST /api/courses/:id/regenerate-code
 * @access Teacher (own), Admin (any)
 */
export const regenerateCourseCode = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Teachers can only regenerate for their own courses
    if (req.user.role === "teacher" && course.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied. You can only manage your own courses." });
    }

    course.courseCode = generateCourseCode();
    await course.save();

    res.status(200).json({ courseCode: course.courseCode, message: "Course code regenerated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
