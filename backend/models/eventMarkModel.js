import mongoose from "mongoose";

const eventMarkSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
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
    mark: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true }
);

// Each student can have only one mark per course per event
eventMarkSchema.index({ event: 1, student: 1, course: 1 }, { unique: true });

const EventMark = mongoose.model("EventMark", eventMarkSchema);
export default EventMark;
