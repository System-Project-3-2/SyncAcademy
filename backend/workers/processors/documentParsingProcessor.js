import path from "path";
import Material from "../../models/materialModel.js";
import MaterialChunk from "../../models/materialChunkModel.js";
import extractPdfText from "../../utils/pdfParser.js";
import extractDocText from "../../utils/docParser.js";
import extractPptx from "../../utils/pptxParser.js";
import { chunkText } from "../../utils/chunkText.js";
import { embedText } from "../../services/embeddingServices.js";

export const documentParsingProcessor = async (job) => {
  const { materialId, filePath, originalFileName, generateEmbeddings = false, chunkSize = 600 } = job.data;

  const ext = path.extname(originalFileName || filePath || "").toLowerCase();
  let textContent = "";

  if (ext === ".pdf") {
    textContent = await extractPdfText(filePath);
  } else if (ext === ".docx") {
    textContent = await extractDocText(filePath);
  } else if (ext === ".pptx") {
    textContent = await extractPptx(filePath);
  } else {
    throw new Error("Unsupported file type");
  }

  if (materialId) {
    await Material.findByIdAndUpdate(materialId, { textContent });
  }

  let createdChunks = 0;
  if (generateEmbeddings && materialId && textContent) {
    const chunks = chunkText(textContent, Number(chunkSize));
    const docs = [];
    for (const chunk of chunks) {
      const embedding = await embedText(chunk);
      docs.push({ materialId, chunkText: chunk, embedding });
    }
    if (docs.length) {
      await MaterialChunk.deleteMany({ materialId });
      await MaterialChunk.insertMany(docs);
      createdChunks = docs.length;
    }
  }

  return { materialId, textLength: textContent.length, createdChunks };
};
