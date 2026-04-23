import mongoose from "mongoose";

const topicTagSchema = new mongoose.Schema(
  {
    topicId: { type: String, required: true, trim: true },
    subtopicId: { type: String, default: "", trim: true },
    confidence: { type: Number, min: 0, max: 1, default: 0.7 },
    source: {
      type: String,
      enum: ["auto", "manual", "seed", "import"],
      default: "manual",
    },
    taggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    taggedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const materialSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    courseTitle: { type: String, required: true },
    type: { type: String, required: true },
    courseNo: { type: String, required: true },
    fileUrl: { type: String, required: true },
    originalFileName: { type: String },
    textContent: { type: String },
    topicTags: {
      type: [topicTagSchema],
      default: [],
    },
    // embedding: { type: Array },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

materialSchema.index({ courseNo: 1 });
materialSchema.index({ courseNo: 1, "topicTags.topicId": 1 });

const Material = mongoose.model("Material", materialSchema);

export default Material;