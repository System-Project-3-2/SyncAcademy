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
const TOP_K = 3;                // reduced for small models: fewer chunks = faster + fits in context
const SIMILARITY_THRESHOLD = 0.25; // minimum score to consider a chunk relevant

// ── System Prompt (kept short for small models like tinyllama) ────────────────
const SYSTEM_PROMPT = `You are Student Aid Tutor, an AI assistant for students.
Answer questions using the CONTEXT below. If context is not enough, use general knowledge and say so.
Be concise and helpful. Use bullet points when listing items.`;

/**
 * Build a full prompt with context for the LLM.
 */
const buildPrompt = (question, contextChunks, chatHistory = []) => {
  let prompt = `${SYSTEM_PROMPT}\n\n`;

  // Include recent chat history — keep only last 2 exchanges for small models
  if (chatHistory.length > 0) {
    prompt += "=== RECENT HISTORY ===\n";
    for (const msg of chatHistory.slice(-4)) {
      const role = msg.role === "user" ? "Student" : "Tutor";
      // Truncate long messages to keep prompt short
      const content = msg.content.length > 200 ? msg.content.substring(0, 200) + "..." : msg.content;
      prompt += `${role}: ${content}\n`;
    }
    prompt += "\n";
  }

  // Include retrieved context
  if (contextChunks.length > 0) {
    prompt += "=== CONTEXT ===\n";
    contextChunks.forEach((chunk, i) => {
      // Truncate each chunk to 400 chars to keep prompt manageable
      const text = chunk.text.length > 400 ? chunk.text.substring(0, 400) + "..." : chunk.text;
      prompt += `[${chunk.courseNo}]: ${text}\n`;
    });
    prompt += "\n";
  }

  prompt += `Student's Question: ${question}\n\nTutor's Answer:`;
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

  // 3. Build prompt
  const prompt = buildPrompt(question, topChunks, chatHistory);

  // 4. Generate answer
  const answer = await generateResponse(prompt);

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
