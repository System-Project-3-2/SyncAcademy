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
const TOP_K = 6;                // number of chunks to feed the LLM
const SIMILARITY_THRESHOLD = 0.25; // minimum score to consider a chunk relevant

// ── System Prompt ────────────────────────────────────────
const SYSTEM_PROMPT = `You are **Student Aid Tutor**, an intelligent AI assistant embedded in the Student-Aid Semantic Search platform.

Your capabilities:
• Answer questions about uploaded course materials (lecture notes, slides, documents).
• Explain concepts clearly and concisely for students.
• Help students understand topics from their uploaded materials.
• Guide users on how the Student-Aid platform works (uploading, searching, viewing materials).

Rules you MUST follow:
1. Base your answers on the CONTEXT provided below. If the context is relevant, use it.
2. If the context does not contain enough information, you may use your general knowledge but clearly state: "Based on my general knowledge..."  
3. Always be helpful, accurate, and student-friendly.
4. Use markdown formatting (bold, bullet points, code blocks) for readability.
5. If asked about the platform itself, explain features like semantic search, material upload, feedback system, etc.
6. Keep answers focused and appropriately detailed — not too short, not excessively long.
7. When referencing specific materials, mention the course title and course number if available.`;

/**
 * Build a full prompt with context for the LLM.
 */
const buildPrompt = (question, contextChunks, chatHistory = []) => {
  let prompt = `${SYSTEM_PROMPT}\n\n`;

  // Include recent chat history for conversational context
  if (chatHistory.length > 0) {
    prompt += "=== CONVERSATION HISTORY ===\n";
    for (const msg of chatHistory.slice(-6)) { // last 3 exchanges
      const role = msg.role === "user" ? "Student" : "Tutor";
      prompt += `${role}: ${msg.content}\n`;
    }
    prompt += "\n";
  }

  // Include retrieved context
  if (contextChunks.length > 0) {
    prompt += "=== RELEVANT CONTEXT FROM COURSE MATERIALS ===\n";
    contextChunks.forEach((chunk, i) => {
      prompt += `\n[Source ${i + 1}: ${chunk.courseTitle} (${chunk.courseNo})]:\n${chunk.text}\n`;
    });
    prompt += "\n=== END OF CONTEXT ===\n\n";
  } else {
    prompt += "(No directly relevant materials found in the database for this question.)\n\n";
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
