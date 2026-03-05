import mongoose from "mongoose";

const materialSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    courseTitle: { type: String, required: true },
    type: { type: String, required: true },
    courseNo: { type: String, required: true },
    fileUrl: { type: String, required: true },
    originalFileName: { type: String },
    textContent: { type: String },
    // embedding: { type: Array },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);
const Material = mongoose.model("Material", materialSchema);

export default Material;