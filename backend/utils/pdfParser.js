import fs from "fs/promises";

let pdfjsGetDocument = null;

const ensurePdfJsPolyfills = () => {
  if (typeof globalThis.DOMMatrix === "undefined") {
    globalThis.DOMMatrix = class DOMMatrix {
      multiplySelf() { return this; }
      preMultiplySelf() { return this; }
      translateSelf() { return this; }
      scaleSelf() { return this; }
      rotateSelf() { return this; }
      invertSelf() { return this; }
      transformPoint(point) { return point; }
    };
  }

  if (typeof globalThis.ImageData === "undefined") {
    globalThis.ImageData = class ImageData {
      constructor(data = [], width = 0, height = 0) {
        this.data = data;
        this.width = width;
        this.height = height;
      }
    };
  }

  if (typeof globalThis.Path2D === "undefined") {
    globalThis.Path2D = class Path2D {};
  }
};

const getPdfDocumentLoader = async () => {
  if (pdfjsGetDocument) return pdfjsGetDocument;

  ensurePdfJsPolyfills();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsGetDocument = pdfjs.getDocument;
  return pdfjsGetDocument;
};

const extractPdfText = async (filePath) => {
  const dataBuffer = await fs.readFile(filePath);
  const getDocument = await getPdfDocumentLoader();
  const pdf = await getDocument({ data: new Uint8Array(dataBuffer) }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    fullText += `${pageText}\n`;
  }

  return fullText.trim();
};

export default extractPdfText;