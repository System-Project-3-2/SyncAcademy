import mongoose from "mongoose";
import crypto from "crypto";

/**
 * Generate a unique 8-character alphanumeric event registration code
 */
const generateRegistrationCode = () => {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
};

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["central_viva", "presentation", "thesis_defense", "project_show"],
      required: true,
    },
    // Each entry links a course to an assigned teacher who marks it
    courses: [
      {
        course: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Course",
          required: true,
        },
        teacher: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      },
    ],
    eventDate: {
      type: Date,
      required: true,
    },
    venue: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    registrationCode: {
      type: String,
      unique: true,
      default: generateRegistrationCode,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed"],
      default: "upcoming",
    },
  },
  { timestamps: true }
);

const Event = mongoose.model("Event", eventSchema);
export default Event;
