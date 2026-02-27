/**
 * RAG (Retrieval-Augmented Generation) Service
 *
 * Orchestrates:
 *   1. Embed the user's question  (existing embeddingServices)
 *   2. Retrieve relevant chunks   (MaterialChunk + cosine similarity)
 *   3. Build a grounded prompt     (system message + context + question)
 *   4. Generate an answer          (Ollama local LLM)
 */

import MaterialChunk from "../models/materialChunkModel.js";
import { embedText } from "./embeddingServices.js";
import { cosineSimilarity } from "../utils/cosineSimilarity.js";
import { generateResponse } from "./ollamaService.js";

// ── Configuration ────────────────────────────────────────
const TOP_K = 3;
const SIMILARITY_THRESHOLD = 0.42; // raised: only use chunks that are genuinely relevant
const NO_CONTEXT_THRESHOLD = 0.38; // if best score is below this, skip LLM entirely

// ── System Prompt ────────────────────────────────────────
// Firm, direct instructions work better than polite ones for small models
const SYSTEM_PROMPT = `You are a study assistant. STRICT RULES:
1. ONLY use the CONTEXT provided below to answer. Do NOT use outside knowledge.
2. If the answer is not in the CONTEXT, say exactly: "I don't have enough information in the uploaded materials to answer this."
3. Do NOT make up facts, names, formulas, or definitions.
4. Answer in 2-4 sentences maximum. Be direct.`;

/**
 * Build a full prompt with context for the LLM.
 */
const buildPrompt = (question, contextChunks) => {
  let prompt = `${SYSTEM_PROMPT}\n\n`;

  prompt += "=== CONTEXT (from uploaded course materials) ===\n";
  contextChunks.forEach((chunk) => {
    const text = chunk.text.length > 400 ? chunk.text.substring(0, 400) + "..." : chunk.text;
    prompt += `[${chunk.courseNo} - ${chunk.courseTitle}]: ${text}\n\n`;
  });
  prompt += "=== END CONTEXT ===\n\n";

  prompt += `Question: ${question}\nAnswer (use ONLY the context above):`;
  return prompt;
};

/**
 * Main RAG pipeline — called by the chat controller.
 *
 * @param {string} question       - The user's message
 * @param {Array}  chatHistory    - Previous messages [{role, content}, …]
 * @param {object} [filters]      - Optional {courseNo, type}
 * @returns {{ answer: string, sources: Array }}
 */
export const ragChat = async (question, chatHistory = [], filters = {}) => {
  // 1. Embed the question
  const queryEmbedding = await embedText(question);

  // 2. Retrieve chunks (same pattern as existing semanticSearch)
  const materialFilter = {};
  if (filters.courseNo) materialFilter.courseNo = filters.courseNo;
  if (filters.type) materialFilter.type = filters.type;

  const chunks = await MaterialChunk.find().populate({
    path: "materialId",
    match: Object.keys(materialFilter).length > 0 ? materialFilter : undefined,
  });

  const validChunks = chunks.filter((c) => c.materialId);

  const scored = validChunks.map((chunk) => ({
    materialId: chunk.materialId._id.toString(),
    courseTitle: chunk.materialId.courseTitle,
    courseNo: chunk.materialId.courseNo,
    type: chunk.materialId.type,
    fileUrl: chunk.materialId.fileUrl,
    text: chunk.chunkText,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  const topChunks = scored
    .filter((c) => c.score >= SIMILARITY_THRESHOLD)
    .slice(0, TOP_K);

  // If no chunks are relevant enough, skip the LLM entirely — prevents hallucination
  const bestScore = scored.length > 0 ? scored[0].score : 0;
  if (bestScore < NO_CONTEXT_THRESHOLD || topChunks.length === 0) {
    return {
      answer:
        "I don't have enough information in the uploaded course materials to answer this question. " +
        "Try uploading relevant materials first, or ask something related to the available courses.",
      sources: [],
    };
  }

  // 3. Build prompt (no chat history passed — keeps prompt small and focused)
  const prompt = buildPrompt(question, topChunks);

  // 4. Generate answer with low temperature to reduce hallucination
  let answer = await generateResponse(prompt, { temperature: 0.1, max_tokens: 300 });

  // Sanitize: trim whitespace and provide fallback if model returned empty
  answer = (answer || "").trim();
  if (!answer) {
    answer = "I was unable to generate a response. Please try rephrasing your question.";
  }

  // 5. Collect unique sources
  const sourcesMap = {};
  for (const chunk of topChunks) {
    if (!sourcesMap[chunk.materialId]) {
      sourcesMap[chunk.materialId] = {
        courseTitle: chunk.courseTitle,
        courseNo: chunk.courseNo,
        type: chunk.type,
        fileUrl: chunk.fileUrl,
        relevance: chunk.score,
      };
    }
  }
  const sources = Object.values(sourcesMap);

  return { answer, sources };
};
