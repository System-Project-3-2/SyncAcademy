import mongoose from "mongoose";
import crypto from "crypto";

/**
 * Generate a unique 8-character alphanumeric course code
 */
const generateCourseCode = () => {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
};

const courseSchema = new mongoose.Schema(
  {
    courseNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    courseTitle: {
      type: String,
      required: true,
      trim: true,
    },
    courseCode: {
      type: String,
      unique: true,
      default: generateCourseCode,
    },
    description: {
      type: String,
      default: "",
    },
    department: {
      type: String,
      default: "",
    },
    semester: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    coTeachers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

const Course = mongoose.model("Course", courseSchema);

export { generateCourseCode };
export default Course;
