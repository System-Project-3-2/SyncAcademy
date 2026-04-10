/**
 * Admin Controller
 * Handles all admin-related operations for user management
 */
import User from "../models/userModel.js";
import bcrypt from "bcryptjs";
import Course from "../models/courseModel.js";
import Material from "../models/materialModel.js";
import Quiz from "../models/quizModel.js";
import Enrollment from "../models/enrollmentModel.js";
import LearningEvent from "../models/learningEventModel.js";
import TopicMastery from "../models/topicMasteryModel.js";

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value ?? 0)));
const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const baseTopics = [
  "arrays",
  "linked-lists",
  "stacks-queues",
  "trees",
  "graphs",
  "sorting",
  "searching",
  "database-basics",
  "normalization",
  "joins",
  "complexity",
  "dynamic-programming",
];

const buildCourseTopics = (seed) => {
  const shift = Math.abs(seed) % baseTopics.length;
  const rotated = [...baseTopics.slice(shift), ...baseTopics.slice(0, shift)];
  return rotated.slice(0, 6);
};

const buildTopicTags = (topicId, userId) => [
  {
    topicId,
    subtopicId: "",
    confidence: 0.9,
    source: "seed",
    taggedBy: userId,
    taggedAt: new Date(),
  },
];

/**
 * Get all users
 * @route GET /api/admin/users
 * @access Admin only
 */
export const getAllUsers = async (req, res) => {
  try {
    const { role, search, isVerified } = req.query;

    // Build filter object
    const filter = {};

    // Filter by role if provided
    if (role && role !== "all") {
      filter.role = role;
    }

    // Filter by verification status if provided
    if (isVerified !== undefined && isVerified !== "all") {
      filter.isVerified = isVerified === "true";
    }

    // Search by name or email if provided
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const { page, limit, sort: sortParam = "-createdAt" } = req.query;

    // If no pagination params, return all (backward compatible)
    if (!page && !limit) {
      const users = await User.find(filter)
        .select("-password -otp -otpExpiry")
        .sort(sortParam);
      return res.status(200).json(users);
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;
    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .select("-password -otp -otpExpiry")
      .sort(sortParam)
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      data: users,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get single user by ID
 * @route GET /api/admin/users/:id
 * @access Admin only
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select("-password -otp -otpExpiry");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Create new user (Admin can bypass email verification)
 * @route POST /api/admin/users
 * @access Admin only
 */
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, idNumber } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "All fields are required (name, email, password, role)",
      });
    }

    // Validate role
    const validRoles = ["student", "teacher", "admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid role. Must be student, teacher, or admin",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Validate and check uniqueness of idNumber if provided
    if (idNumber) {
      if (!/^\d{7}$/.test(idNumber)) {
        return res.status(400).json({ message: "ID number must be exactly 7 digits" });
      }
      const existingId = await User.findOne({ idNumber });
      if (existingId) {
        return res.status(400).json({ message: "This ID number is already in use" });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user (admin-created users are auto-verified)
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      isVerified: true, // Admin-created users are automatically verified
      ...(idNumber && { idNumber }),
    });

    // Return user without sensitive fields
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      idNumber: user.idNumber || "",
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.status(201).json({
      message: "User created successfully",
      user: userResponse,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update user
 * @route PUT /api/admin/users/:id
 * @access Admin only
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, isVerified, password, idNumber } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if email is being changed and if new email already exists
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "Email already in use by another user" });
      }
      user.email = email;
    }

    // Validate and check uniqueness of idNumber if provided
    if (idNumber !== undefined) {
      if (idNumber === "") {
        user.idNumber = undefined;
      } else {
        if (!/^\d{7}$/.test(idNumber)) {
          return res.status(400).json({ message: "ID number must be exactly 7 digits" });
        }
        const existingId = await User.findOne({ idNumber, _id: { $ne: id } });
        if (existingId) {
          return res.status(400).json({ message: "This ID number is already in use" });
        }
        user.idNumber = idNumber;
      }
    }

    // Validate role if provided
    if (role) {
      const validRoles = ["student", "teacher", "admin"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          message: "Invalid role. Must be student, teacher, or admin",
        });
      }
      user.role = role;
    }

    // Update other fields if provided
    if (name) user.name = name;
    if (typeof isVerified === "boolean") user.isVerified = isVerified;

    // Update password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await user.save();

    // Return user without sensitive fields
    const userResponse = {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      idNumber: updatedUser.idNumber || "",
      isVerified: updatedUser.isVerified,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };

    res.status(200).json({
      message: "User updated successfully",
      user: userResponse,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete user
 * @route DELETE /api/admin/users/:id
 * @access Admin only
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent admin from deleting themselves
    if (req.user._id.toString() === id) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get user statistics
 * @route GET /api/admin/users/stats
 * @access Admin only
 */
export const getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const students = await User.countDocuments({ role: "student" });
    const teachers = await User.countDocuments({ role: "teacher" });
    const admins = await User.countDocuments({ role: "admin" });
    const verified = await User.countDocuments({ isVerified: true });
    const unverified = await User.countDocuments({ isVerified: false });

    res.status(200).json({
      totalUsers,
      students,
      teachers,
      admins,
      verified,
      unverified,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Generate synthetic demo dataset for recommendation visualization.
 * @route POST /api/admin/synthetic-data/generate
 * @access Admin only
 */
export const generateSyntheticData = async (req, res) => {
  try {
    const {
      namespace,
      teachers = 3,
      students = 60,
      coursesPerTeacher = 2,
      materialsPerCourse = 8,
      quizzesPerCourse = 3,
      eventsPerEnrollment = 35,
      enrollmentsPerStudent = 2,
      password = "Demo@123",
    } = req.body || {};

    const safe = {
      teachers: Math.max(1, Math.min(Number(teachers), 20)),
      students: Math.max(5, Math.min(Number(students), 2000)),
      coursesPerTeacher: Math.max(1, Math.min(Number(coursesPerTeacher), 8)),
      materialsPerCourse: Math.max(1, Math.min(Number(materialsPerCourse), 40)),
      quizzesPerCourse: Math.max(1, Math.min(Number(quizzesPerCourse), 20)),
      eventsPerEnrollment: Math.max(5, Math.min(Number(eventsPerEnrollment), 150)),
      enrollmentsPerStudent: Math.max(1, Math.min(Number(enrollmentsPerStudent), 8)),
    };

    const ns = String(namespace || `synth-${Date.now()}`).toLowerCase().replace(/[^a-z0-9-]/g, "-");

    const existingNamespaceUser = await User.findOne({
      email: { $regex: `^${ns}-`, $options: "i" },
    }).lean();

    if (existingNamespaceUser) {
      return res.status(400).json({
        message: `Namespace '${ns}' already exists. Please use a different namespace.`,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 1) Create teachers
    const teacherDocs = [];
    for (let i = 1; i <= safe.teachers; i++) {
      teacherDocs.push({
        name: `Synthetic Teacher ${i}`,
        email: `${ns}-teacher-${String(i).padStart(3, "0")}@demo.edu`,
        password: hashedPassword,
        role: "teacher",
        isVerified: true,
      });
    }

    const teachersCreated = await User.insertMany(teacherDocs, { ordered: false });

    // 2) Create courses per teacher
    const courseDocs = [];
    let cSeq = 1;
    for (const teacher of teachersCreated) {
      for (let i = 0; i < safe.coursesPerTeacher; i++) {
        const courseNo = `${ns.toUpperCase().slice(0, 6)}-${String(cSeq).padStart(3, "0")}`;
        courseDocs.push({
          courseNo,
          courseTitle: `Synthetic Course ${cSeq}`,
          description: `Auto-generated synthetic course ${cSeq} for recommendation demo`,
          department: "Synthetic Studies",
          semester: "Demo Semester",
          createdBy: teacher._id,
        });
        cSeq += 1;
      }
    }
    const coursesCreated = await Course.insertMany(courseDocs, { ordered: false });

    // 3) Create students
    const studentDocs = [];
    for (let i = 1; i <= safe.students; i++) {
      studentDocs.push({
        name: `Synthetic Student ${i}`,
        email: `${ns}-student-${String(i).padStart(4, "0")}@demo.edu`,
        password: hashedPassword,
        role: "student",
        isVerified: true,
      });
    }
    const studentsCreated = await User.insertMany(studentDocs, { ordered: false });

    // 4) Create materials and quizzes
    const materialDocs = [];
    const quizDocs = [];

    coursesCreated.forEach((course, idx) => {
      const topics = buildCourseTopics(idx + 1);
      const teacherId = course.createdBy;

      for (let m = 1; m <= safe.materialsPerCourse; m++) {
        const topic = topics[(m - 1) % topics.length];
        materialDocs.push({
          title: `Material ${m} - ${topic}`,
          courseTitle: course.courseTitle,
          type: m % 2 === 0 ? "Slides" : "Lecture Notes",
          courseNo: course.courseNo,
          fileUrl: `https://example.com/${ns}/${course.courseNo}/material-${m}.pdf`,
          originalFileName: `${course.courseNo}-material-${m}.pdf`,
          textContent: `This synthetic material covers ${topic}. Includes examples, practice and quick summaries for ${topic}.`,
          topicTags: buildTopicTags(topic, teacherId),
          uploadedBy: teacherId,
        });
      }

      for (let q = 1; q <= safe.quizzesPerCourse; q++) {
        const questions = [];
        for (let qi = 1; qi <= 10; qi++) {
          const topic = topics[(q + qi) % topics.length];
          questions.push({
            questionText: `(${topic}) Synthetic question ${qi} for ${course.courseNo}?`,
            options: ["Option A", "Option B", "Option C", "Option D"],
            correctAnswer: qi % 4,
            explanation: `Synthetic explanation for ${topic}`,
            difficulty: qi % 3 === 0 ? "hard" : qi % 2 === 0 ? "medium" : "easy",
            sourceChunk: `Auto-generated from synthetic topic ${topic}`,
            topicTags: buildTopicTags(topic, teacherId),
          });
        }

        quizDocs.push({
          course: course._id,
          createdBy: teacherId,
          title: `Synthetic Quiz ${q} - ${course.courseNo}`,
          description: "Auto-generated quiz for recommendation and KT demo",
          questions,
          isPublished: true,
          totalQuestions: questions.length,
        });
      }
    });

    const materialsCreated = await Material.insertMany(materialDocs, { ordered: false });
    await Quiz.insertMany(quizDocs, { ordered: false });

    // 5) Enroll students
    const enrollmentDocs = [];
    for (const student of studentsCreated) {
      const shuffledCourses = [...coursesCreated].sort(() => Math.random() - 0.5);
      const take = Math.min(safe.enrollmentsPerStudent, shuffledCourses.length);
      for (let i = 0; i < take; i++) {
        enrollmentDocs.push({
          student: student._id,
          course: shuffledCourses[i]._id,
          status: "active",
        });
      }
    }

    const enrollmentsCreated = await Enrollment.insertMany(enrollmentDocs, { ordered: false });

    // 6) Generate learning events for recommendation engine
    const courseTopicMap = new Map();
    coursesCreated.forEach((course, idx) => {
      courseTopicMap.set(String(course._id), buildCourseTopics(idx + 1));
    });

    const materialByCourseNo = new Map();
    for (const m of materialsCreated) {
      if (!materialByCourseNo.has(m.courseNo)) materialByCourseNo.set(m.courseNo, []);
      materialByCourseNo.get(m.courseNo).push(m);
    }

    const events = [];
    const now = Date.now();
    for (const enr of enrollmentsCreated) {
      const course = coursesCreated.find((c) => String(c._id) === String(enr.course));
      if (!course) continue;

      const topics = courseTopicMap.get(String(enr.course)) || [];
      const mats = materialByCourseNo.get(course.courseNo) || [];
      const studentSkill = Math.random() * 0.5 + 0.25;

      for (let i = 0; i < safe.eventsPerEnrollment; i++) {
        const topicId = randomPick(topics);
        const difficulty = randomPick(["easy", "medium", "hard"]);
        const sourceType = i % 4 === 0 ? "assignment" : "quiz";
        const hintUsed = Math.random() < 0.25;
        const diffPenalty = difficulty === "hard" ? 0.18 : difficulty === "medium" ? 0.1 : 0.04;
        const pCorrect = clamp01(studentSkill - diffPenalty - (hintUsed ? 0.05 : 0));
        const isCorrect = Math.random() < pCorrect;
        const normalizedScore = clamp01((isCorrect ? 0.7 : 0.35) + (Math.random() - 0.5) * 0.2);
        const eventTimestamp = new Date(now - (safe.eventsPerEnrollment - i) * 36 * 60 * 60 * 1000 + Math.floor(Math.random() * 1000000));
        const pickedMaterial = mats.length ? randomPick(mats) : null;

        events.push({
          student: enr.student,
          course: enr.course,
          topicId,
          sourceType,
          eventType: sourceType === "quiz" ? "question_attempt" : "assignment_attempt",
          isCorrect,
          normalizedScore,
          difficulty,
          timeSpentSec: Math.max(5, Math.round(35 + Math.random() * 120)),
          attemptNo: Math.floor(Math.random() * 3) + 1,
          hintUsed,
          materialId: pickedMaterial?._id || null,
          materialType: pickedMaterial?.type || "",
          materialTopicMatchScore: pickedMaterial ? 0.7 : 0,
          eventTimestamp,
          metadata: { synthetic: true, namespace: ns },
        });
      }
    }

    await LearningEvent.insertMany(events, { ordered: false });

    // 7) Build initial topic mastery records from synthetic events
    const grouped = new Map();
    for (const e of events) {
      const key = `${String(e.student)}::${String(e.course)}::${e.topicId}`;
      const prev = grouped.get(key) || { attempts: 0, correct: 0, hints: 0, totalTime: 0 };
      prev.attempts += 1;
      prev.correct += e.isCorrect ? 1 : 0;
      prev.hints += e.hintUsed ? 1 : 0;
      prev.totalTime += Number(e.timeSpentSec || 0);
      grouped.set(key, prev);
    }

    const masteryOps = [];
    for (const [key, val] of grouped.entries()) {
      const [student, course, topicId] = key.split("::");
      const accuracy = val.correct / Math.max(1, val.attempts);
      const hintRate = val.hints / Math.max(1, val.attempts);
      const avgTimeSec = val.totalTime / Math.max(1, val.attempts);
      const timePenalty = Math.min(0.12, avgTimeSec / 1500);
      const masteryScore = clamp01(0.75 * accuracy + 0.25 * (1 - hintRate) - timePenalty);
      const weaknessScore = clamp01(1 - masteryScore);
      const confidence = clamp01(Math.min(1, val.attempts / 20));

      masteryOps.push({
        updateOne: {
          filter: { student, course, topicId },
          update: {
            $set: {
              student,
              course,
              topicId,
              masteryScore,
              weaknessScore,
              confidence,
              modelVersion: "synthetic-seed-v1",
              sourceModelType: "rule",
              lastPredictionAt: new Date(),
              stats: {
                attempts: val.attempts,
                correctAttempts: val.correct,
                avgTimeSec: Number(avgTimeSec.toFixed(2)),
                hintRate: Number(hintRate.toFixed(4)),
              },
              explanation: {
                synthetic: true,
                namespace: ns,
                reason: "Generated from synthetic event profile",
              },
            },
          },
          upsert: true,
        },
      });
    }

    if (masteryOps.length) {
      await TopicMastery.bulkWrite(masteryOps, { ordered: false });
    }

    const sampleAccounts = {
      teacher: `${ns}-teacher-001@demo.edu`,
      student: `${ns}-student-0001@demo.edu`,
      password,
    };

    res.status(201).json({
      message: "Synthetic dataset generated successfully",
      namespace: ns,
      summary: {
        teachers: teachersCreated.length,
        students: studentsCreated.length,
        courses: coursesCreated.length,
        materials: materialsCreated.length,
        quizzes: quizDocs.length,
        enrollments: enrollmentsCreated.length,
        learningEvents: events.length,
        topicMasteryRecords: masteryOps.length,
      },
      sampleAccounts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
