import mongoose from "mongoose";

const jobStatusSchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    queue: { type: String, required: true, index: true },
    state: { type: String, enum: ["queued", "active", "completed", "failed"], default: "queued", index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true }
);

jobStatusSchema.index({ queue: 1, state: 1, createdAt: -1 });

const JobStatus = mongoose.model("JobStatus", jobStatusSchema);

export default JobStatus;
