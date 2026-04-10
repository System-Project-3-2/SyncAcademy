import mongoose from "mongoose";

const topicMasterySchema = new mongoose.Schema(
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
    masteryScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      default: 0.5,
    },
    weaknessScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      default: 0.5,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    modelVersion: {
      type: String,
      default: "rule-baseline-v1",
      trim: true,
    },
    sourceModelType: {
      type: String,
      enum: ["rule", "logreg", "xgboost", "lstm-dkt", "transformer-kt"],
      default: "rule",
    },
    lastPredictionAt: {
      type: Date,
      default: Date.now,
    },
    stats: {
      attempts: { type: Number, default: 0, min: 0 },
      correctAttempts: { type: Number, default: 0, min: 0 },
      avgTimeSec: { type: Number, default: 0, min: 0 },
      hintRate: { type: Number, default: 0, min: 0, max: 1 },
    },
    explanation: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

topicMasterySchema.index({ student: 1, course: 1, topicId: 1 }, { unique: true });
topicMasterySchema.index({ student: 1, course: 1, weaknessScore: -1 });

const TopicMastery = mongoose.model("TopicMastery", topicMasterySchema);

export default TopicMastery;
