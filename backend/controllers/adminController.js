/**
 * Admin Controller
 * Handles all admin-related operations for user management
 */
import User from "../models/userModel.js";
import bcrypt from "bcryptjs";

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
    const { name, email, password, role } = req.body;

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
    });

    // Return user without sensitive fields
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
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
    const { name, email, role, isVerified, password } = req.body;

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
