import mongoose from "mongoose";

const topicAliasSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      default: null,
      index: true,
    },
    alias: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedAlias: {
      type: String,
      required: true,
      trim: true,
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
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.8,
    },
    source: {
      type: String,
      enum: ["manual", "seed", "import", "generated"],
      default: "manual",
    },
  },
  { timestamps: true }
);

topicAliasSchema.index(
  { course: 1, normalizedAlias: 1, topicId: 1, subtopicId: 1 },
  { unique: true }
);

topicAliasSchema.pre("validate", function preValidate(next) {
  this.normalizedAlias = String(this.alias || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  next();
});

const TopicAlias = mongoose.model("TopicAlias", topicAliasSchema);

export default TopicAlias;
