import mongoose from "mongoose";

const learningEventSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    topicId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    subtopicId: {
      type: String,
      default: "",
      trim: true,
    },
    sourceType: {
      type: String,
      enum: ["quiz", "assignment", "material", "hint"],
      required: true,
      index: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    eventType: {
      type: String,
      enum: [
        "question_attempt",
        "assignment_attempt",
        "material_view",
        "material_download",
        "hint_used",
      ],
      required: true,
      index: true,
    },
    isCorrect: {
      type: Boolean,
      default: null,
      index: true,
    },
    rawScore: {
      type: Number,
      default: null,
      min: 0,
    },
    normalizedScore: {
      type: Number,
      default: null,
      min: 0,
      max: 1,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard", "unknown"],
      default: "unknown",
    },
    timeSpentSec: {
      type: Number,
      default: 0,
      min: 0,
    },
    responseLatencySec: {
      type: Number,
      default: 0,
      min: 0,
    },
    attemptNo: {
      type: Number,
      default: 1,
      min: 1,
    },
    hintUsed: {
      type: Boolean,
      default: false,
    },
    explanationViewed: {
      type: Boolean,
      default: false,
    },
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      default: null,
      index: true,
    },
    materialType: {
      type: String,
      default: "",
      trim: true,
    },
    materialTopicMatchScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    eventTimestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

learningEventSchema.index({ student: 1, topicId: 1, eventTimestamp: -1 });
learningEventSchema.index({ student: 1, course: 1, eventTimestamp: -1 });

const LearningEvent = mongoose.model("LearningEvent", learningEventSchema);

export default LearningEvent;
