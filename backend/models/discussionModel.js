/**
 * Discussion Model
 * Course Q&A / problem-solving threads. Students post questions (with attachments),
 * and any enrolled user or teacher can reply.
 */
import mongoose from "mongoose";

const subReplySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  editedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

const replySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  attachments: [
    {
      fileName: { type: String },
      fileUrl: { type: String },
      fileType: { type: String }, // 'image' | 'document'
    },
  ],
  links: [{ type: String, trim: true }],
  votes: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      value: { type: Number, enum: [1, -1] },
    },
  ],
  isAccepted: {
    type: Boolean,
    default: false,
  },
  editedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  subReplies: [subReplySchema],
});

const discussionSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    attachments: [
      {
        fileName: { type: String },
        fileUrl: { type: String },
        fileType: { type: String },
      },
    ],
    links: [{ type: String, trim: true }],
    votes: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        value: { type: Number, enum: [1, -1] },
      },
    ],
    replies: [replySchema],
    status: {
      type: String,
      enum: ["open", "solved"],
      default: "open",
    },
    tags: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

discussionSchema.index({ course: 1, status: 1, createdAt: -1 });

const Discussion = mongoose.model("Discussion", discussionSchema);
export default Discussion;
