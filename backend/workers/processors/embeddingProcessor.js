import MaterialChunk from "../../models/materialChunkModel.js";
import { chunkText } from "../../utils/chunkText.js";
import { embedText } from "../../services/embeddingServices.js";

export const embeddingProcessor = async (job) => {
  const { materialId, textContent, chunkSize = 600 } = job.data;

  if (!materialId || !textContent) {
    throw new Error("materialId and textContent are required");
  }

  const chunks = chunkText(textContent, Number(chunkSize));
  const docs = [];

  for (const chunk of chunks) {
    const embedding = await embedText(chunk);
    docs.push({ materialId, chunkText: chunk, embedding });
  }

  if (docs.length) {
    await MaterialChunk.insertMany(docs);
  }

  return { createdChunks: docs.length };
};
