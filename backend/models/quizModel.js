import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      required: true,
    },
    options: {
      type: [String],
      validate: {
        validator: (v) => v.length === 4,
        message: "Each question must have exactly 4 options",
      },
      required: true,
    },
    correctAnswer: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    explanation: {
      type: String,
      default: "",
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    sourceChunk: {
      type: String,
      default: "",
    },
  },
  { _id: true }
);

const quizSchema = new mongoose.Schema(
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
    questions: [questionSchema],
    isPublished: {
      type: Boolean,
      default: false,
    },
    timeLimit: {
      type: Number,
      default: null,
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    availableUntil: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

quizSchema.index({ course: 1, createdAt: -1 });
quizSchema.index({ createdBy: 1, createdAt: -1 });
quizSchema.index({ course: 1, isPublished: 1, createdAt: -1 });
quizSchema.index({ scheduledAt: 1, availableUntil: 1 });

const Quiz = mongoose.model("Quiz", quizSchema);

export default Quiz;
