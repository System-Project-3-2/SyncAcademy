import mongoose from "mongoose";

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
  },
  { timestamps: true }
);

const Course = mongoose.model("Course", courseSchema);

export default Course;
