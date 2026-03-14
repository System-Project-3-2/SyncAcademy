import path from "path";
import Material from "../../models/materialModel.js";
import extractPdfText from "../../utils/pdfParser.js";
import extractDocText from "../../utils/docParser.js";
import extractPptx from "../../utils/pptxParser.js";

export const documentParsingProcessor = async (job) => {
  const { materialId, filePath, originalFileName } = job.data;

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

  return { materialId, textLength: textContent.length, textContent };
};
