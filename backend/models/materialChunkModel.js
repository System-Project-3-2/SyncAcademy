import mongoose from "mongoose";

const materialChunkSchema = new mongoose.Schema(
  {
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      
      required: true,
    },
    chunkText: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      required: true,
    },
  },
  { timestamps: true }
);

materialChunkSchema.index({ materialId: 1, createdAt: -1 });

const MaterialChunk = mongoose.model("MaterialChunk", materialChunkSchema);

export default MaterialChunk;