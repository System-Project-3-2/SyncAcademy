import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    dueDate: {
      type: Date,
    },
    totalMarks: {
      type: Number,
      default: 100,
    },
    attachments: [
      {
        fileName: String,
        fileUrl: String,
      },
    ],
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

assignmentSchema.index({ course: 1, createdAt: -1 });

const Assignment = mongoose.model("Assignment", assignmentSchema);

export default Assignment;
