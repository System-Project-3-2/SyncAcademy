import mongoose from "mongoose";

const courseInvitationSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    message: {
      type: String,
      default: "",
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Prevent duplicate pending invitations for the same teacher + course
courseInvitationSchema.index({ from: 1, to: 1, course: 1 }, { unique: true });

const CourseInvitation = mongoose.model("CourseInvitation", courseInvitationSchema);
export default CourseInvitation;
