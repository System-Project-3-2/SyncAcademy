/**
 * Announcement Model
 * Represents course announcements (Google Classroom-style stream posts)
 */
import mongoose from "mongoose";

const commentReplySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  text: {
    type: String,
    required: true,
    trim: true,
  },
  editedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  text: {
    type: String,
    required: true,
    trim: true,
  },
  replies: [commentReplySchema],
  editedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const announcementSchema = new mongoose.Schema(
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
    isPinned: {
      type: Boolean,
      default: false,
    },
    attachments: [
      {
        fileName: { type: String },
        fileUrl: { type: String },
        fileType: { type: String }, // 'image' | 'document'
      },
    ],
    links: [{ type: String, trim: true }],
    comments: [commentSchema],
  },
  { timestamps: true }
);

// Index for faster course-based queries sorted by pin + date
announcementSchema.index({ course: 1, isPinned: -1, createdAt: -1 });

const Announcement = mongoose.model("Announcement", announcementSchema);
export default Announcement;
