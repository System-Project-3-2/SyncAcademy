/**
 * Enrollment Model
 * Tracks which students are enrolled in which courses
 */
import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["active", "dropped"],
      default: "active",
    },
  },
  { timestamps: true }
);

// A student can only enroll in a course once
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

const Enrollment = mongoose.model("Enrollment", enrollmentSchema);

export default Enrollment;
