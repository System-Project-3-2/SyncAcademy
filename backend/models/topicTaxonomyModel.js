import mongoose from "mongoose";

const topicTaxonomySchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    unitId: {
      type: String,
      required: true,
      trim: true,
    },
    unitName: {
      type: String,
      required: true,
      trim: true,
    },
    topicId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    topicName: {
      type: String,
      required: true,
      trim: true,
    },
    subtopicId: {
      type: String,
      default: "",
      trim: true,
    },
    subtopicName: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

topicTaxonomySchema.index(
  { course: 1, unitId: 1, topicId: 1, subtopicId: 1 },
  { unique: true }
);

const TopicTaxonomy = mongoose.model("TopicTaxonomy", topicTaxonomySchema);

export default TopicTaxonomy;
