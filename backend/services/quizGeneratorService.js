import MaterialChunk from "../models/materialChunkModel.js";
import Material from "../models/materialModel.js";
import Course from "../models/courseModel.js";
import { generateChatJSON } from "./ollamaService.js";

/**
 * Generate quiz questions from course material chunks using Ollama.
 *
 * @param {string} courseNo - Course number to fetch materials for
 * @param {number} numQuestions - Number of questions to generate
 * @param {string} difficulty - "easy" | "medium" | "hard"
 * @param {string|null} materialId - Optional: restrict to a specific material
 * @returns {Array} Array of question objects
 */
export const generateQuiz = async (courseNo, numQuestions = 5, difficulty = "medium", materialId = null, courseId = null) => {
  // 1. Fetch materials for the course — try courseNo first, fall back to courseId lookup
  const materialFilter = {};
  if (materialId) {
    materialFilter._id = materialId;
  } else if (courseNo) {
    materialFilter.courseNo = courseNo;
  }

  let materials = await Material.find(materialFilter).select("_id title courseNo").lean();

  // Fallback: if courseNo lookup returned nothing, try resolving via courseId
  if (!materials.length && courseId) {
    const course = await Course.findById(courseId).select("courseNo").lean();
    if (course?.courseNo) {
      materials = await Material.find({ courseNo: course.courseNo }).select("_id title courseNo").lean();
    }
  }

  // Fallback: case-insensitive courseNo match
  if (!materials.length && courseNo) {
    materials = await Material.find({ courseNo: { $regex: `^${courseNo.trim()}$`, $options: "i" } })
      .select("_id title courseNo")
      .lean();
  }

  if (!materials.length) {
    throw new Error("No materials found for this course. Upload materials first.");
  }

  const materialIds = materials.map((m) => m._id);

  // 2. Fetch chunks for those materials
  const chunks = await MaterialChunk.find({ materialId: { $in: materialIds } })
    .select("chunkText materialId")
    .lean();

  if (!chunks.length) {
    throw new Error("No processed text chunks found. Material content may not have been extracted.");
  }

  // 3. Select a subset of chunks (spread across materials)
  const selectedChunks = selectChunks(chunks, numQuestions);

  // 4. Generate questions one per chunk to keep each Ollama call fast
  const questions = [];

  for (let i = 0; i < selectedChunks.length && questions.length < numQuestions; i++) {
    const chunk = selectedChunks[i];

    try {
      const generated = await generateQuestionsFromChunk(chunk.chunkText, 1, difficulty);
      for (const q of generated) {
        if (questions.length >= numQuestions) break;
        questions.push({
          ...q,
          sourceChunk: chunk.chunkText.substring(0, 200),
        });
      }
    } catch (err) {
      console.warn(`[QuizGen] Failed to generate from chunk: ${err.message}`);
      // Continue with other chunks
    }
  }

  if (!questions.length) {
    throw new Error("Failed to generate any quiz questions. Please try again.");
  }

  return questions;
};

/**
 * Select a diverse subset of chunks for question generation.
 */
function selectChunks(chunks, numQuestions) {
  // Filter out very short chunks (less than 80 characters)
  const usable = chunks.filter((c) => c.chunkText.length >= 80);
  if (!usable.length) return chunks.slice(0, numQuestions);

  // Shuffle and pick exactly numQuestions chunks (1 question per chunk)
  const shuffled = usable.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, numQuestions);
}

/**
 * Generate MCQ questions from a single text chunk using Ollama.
 */
async function generateQuestionsFromChunk(chunkText, count, difficulty) {
  // Truncate chunk to avoid long context windows
  const truncated = chunkText.substring(0, 600);

  const systemPrompt = `You are a quiz creator. Output ONLY valid JSON — no markdown, no extra text.
Generate ${count} multiple-choice question from the text below.
Use this exact JSON structure:
{"questions":[{"questionText":"question","options":["choice1","choice2","choice3","choice4"],"correctAnswer":0,"explanation":"why"}]}
Rules:
- difficulty: ${difficulty}
- correctAnswer is a 0-based index (0, 1, 2, or 3)
- Do NOT use quotation marks inside option strings or explanation
- Keep each option under 15 words`;

  const userPrompt = `Text:\n${truncated}`;

  const rawResponse = await generateChatJSON(systemPrompt, userPrompt, {
    temperature: 0.3,
    max_tokens: 800,
    num_ctx: 2048,
    timeoutMs: 300_000, // 5 minutes per chunk
  });

  return parseQuestionResponse(rawResponse, difficulty);
}

/**
 * Multi-stage JSON parsing with repair and regex fallback.
 */
function parseQuestionResponse(raw, difficulty) {
  let parsed = null;

  // Stage 1: direct parse
  try { parsed = JSON.parse(raw.trim()); } catch { /* continue */ }

  // Stage 2: extract first JSON object and parse
  if (!parsed) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch { /* continue */ } }
  }

  // Stage 3: attempt to repair truncated JSON (find last complete question object)
  if (!parsed) { parsed = tryRepairTruncatedJSON(raw); }

  // Stage 4: regex field extraction as last resort
  const rawQuestions = parsed
    ? (parsed.questions || parsed.Questions || [parsed])
    : extractQuestionsViaRegex(raw);

  return rawQuestions
    .filter((q) => q.questionText && Array.isArray(q.options) && q.options.length === 4)
    .map((q) => ({
      questionText: String(q.questionText).trim(),
      options: q.options.map((o) => String(o).trim()),
      correctAnswer: Math.min(Math.max(Number(q.correctAnswer) || 0, 0), 3),
      explanation: String(q.explanation || "").trim(),
      difficulty,
    }));
}

/**
 * Repair JSON that was truncated mid-stream by finding the last complete object.
 */
function tryRepairTruncatedJSON(raw) {
  try {
    const arrayStart = raw.indexOf("[");
    if (arrayStart === -1) return null;

    let depth = 0;
    let lastClose = -1;
    let inString = false;
    let escaped = false;

    for (let i = arrayStart + 1; i < raw.length; i++) {
      const ch = raw[i];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\" && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      if (ch === "}") { depth--; if (depth === 0) lastClose = i; }
    }

    if (lastClose === -1) return null;
    const repaired = '{"questions":[' + raw.substring(arrayStart + 1, lastClose + 1) + "]}";
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

/**
 * Last-resort: extract question fields individually via regex.
 */
function extractQuestionsViaRegex(raw) {
  const qtMatch = raw.match(/"questionText"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!qtMatch) return [];

  const options = [];
  const optSection = raw.match(/"options"\s*:\s*\[([^[\]]*)\]/);
  if (optSection) {
    const optRe = /"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = optRe.exec(optSection[1])) !== null && options.length < 4) {
      options.push(m[1]);
    }
  }
  if (options.length < 4) return [];

  const correctMatch = raw.match(/"correctAnswer"\s*:\s*(\d)/);
  const explMatch = raw.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"/);

  return [{
    questionText: qtMatch[1],
    options,
    correctAnswer: correctMatch ? parseInt(correctMatch[1], 10) : 0,
    explanation: explMatch ? explMatch[1] : "",
  }];
}
