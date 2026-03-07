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

  // 3. Select a diverse subset of chunks — prefer longer, more informative ones.
  //    Cap at numQuestions + 2 to keep total Ollama calls low and avoid HTTP timeouts.
  const selectedChunks = selectDiverseChunks(chunks, numQuestions + 2);

  // 4. Generate questions one per chunk; the +2 buffer absorbs any grounding rejects
  const questions = [];

  for (let i = 0; i < selectedChunks.length && questions.length < numQuestions; i++) {
    const chunk = selectedChunks[i];

    try {
      const generated = await generateQuestionsFromChunk(chunk.chunkText, 1, difficulty);
      for (const q of generated) {
        if (questions.length >= numQuestions) break;
        // Discard questions whose key terms don't appear in the source chunk
        if (!isQuestionGrounded(q.questionText, chunk.chunkText)) {
          console.warn(`[QuizGen] Discarded ungrounded question: "${q.questionText.substring(0, 80)}"`);
          continue;
        }
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
    throw new Error(
      "Could not generate grounded questions from the available material chunks. " +
      "Try uploading more detailed course materials or retry."
    );
  }

  // Return whatever was generated — may be fewer than numQuestions if some
  // chunks produced no valid output, but partial results are better than failure.
  return questions;
};

/**
 * Select a diverse subset of chunks for question generation.
 *
 * Strategy:
 *   1. Discard chunks shorter than MIN_CHUNK_LENGTH (too sparse to ground a question).
 *   2. Sort each materialId bucket by length descending (longest = most informative).
 *   3. Round-robin across materials so all uploaded files are represented.
 *   4. Return up to `target` chunks.
 */
const MIN_CHUNK_LENGTH = 150;

function selectDiverseChunks(chunks, target) {
  const usable = chunks.filter((c) => c.chunkText.length >= MIN_CHUNK_LENGTH);
  const pool = usable.length ? usable : chunks; // fallback: use everything

  // Group by materialId and sort each bucket longest-first
  const byMaterial = new Map();
  for (const chunk of pool) {
    const key = String(chunk.materialId);
    if (!byMaterial.has(key)) byMaterial.set(key, []);
    byMaterial.get(key).push(chunk);
  }
  for (const bucket of byMaterial.values()) {
    bucket.sort((a, b) => b.chunkText.length - a.chunkText.length);
  }

  // Round-robin pick across materials
  const queues = [...byMaterial.values()];
  const result = [];
  let round = 0;
  while (result.length < target) {
    let added = false;
    for (const q of queues) {
      if (result.length >= target) break;
      if (round < q.length) { result.push(q[round]); added = true; }
    }
    if (!added) break;
    round++;
  }
  return result;
}

/**
 * Post-generation grounding validation.
 *
 * Extracts meaningful tokens from the generated question and checks what
 * fraction of them appear verbatim in the source chunk.  A question whose
 * key terms are absent from the chunk was almost certainly hallucinated.
 *
 * Threshold: ≥ 35 % of non-trivial question tokens must exist in the chunk.
 */
const GROUNDING_STOP_WORDS = new Set([
  'a','an','the','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','shall','can',
  'this','that','these','those','and','but','or','nor','for','yet','so',
  'in','on','at','to','of','by','with','from','into','through','about',
  'what','which','who','how','when','where','why','all','each','every',
  'both','more','most','other','some','such','than','too','very','just',
  'its','it','he','she','they','we','you','i','me','him','her','us','them',
]);

function isQuestionGrounded(questionText, chunkText) {
  const tokens = questionText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !GROUNDING_STOP_WORDS.has(t));

  if (tokens.length === 0) return true; // nothing to validate against — accept

  const chunkLower = chunkText.toLowerCase();
  const matchCount = tokens.filter((t) => chunkLower.includes(t)).length;
  const ratio = matchCount / tokens.length;

  return ratio >= 0.20; // at least 20 % of key terms must appear in the chunk
  // Note: LLMs paraphrase rather than quote verbatim, so a strict threshold
  // like 35 % rejects too many valid questions.  20 % still catches clear
  // topic-drift hallucinations while accepting natural paraphrasing.
}

// Maximum characters of a chunk sent to the LLM (larger = more context = less hallucination)
const CHUNK_CONTEXT_LIMIT = 1000;

/**
 * Generate MCQ questions from a single text chunk using Ollama.
 *
 * Grounding strategy:
 *   - The chunk is presented inside [CONTEXT START]/[CONTEXT END] delimiters.
 *   - The system prompt explicitly forbids using outside knowledge and requires
 *     every answer option to be traceable to the CONTEXT.
 *   - Temperature is kept near 0 (0.1) to minimise creative/hallucinatory output.
 */
async function generateQuestionsFromChunk(chunkText, count, difficulty) {
  const truncated = chunkText.length > CHUNK_CONTEXT_LIMIT
    ? chunkText.substring(0, CHUNK_CONTEXT_LIMIT)
    : chunkText;

  // ── System prompt — explicit anti-hallucination constraints ────────────────
  const systemPrompt = `You are a quiz creator. Output ONLY valid JSON — no markdown, no extra text.
Use this exact JSON structure:
{"questions":[{"questionText":"...","options":["...","...","...","..."],"correctAnswer":0,"explanation":"..."}]}

CRITICAL RULES — violating any rule makes your answer WRONG:
1. Generate ONLY questions whose answers are found DIRECTLY in the CONTEXT below.
2. Do NOT use any knowledge from your training data. The CONTEXT is your ONLY source.
3. Every answer option MUST come from or relate to content in the CONTEXT.
4. The explanation MUST quote or paraphrase the CONTEXT — not general knowledge.
5. If the CONTEXT does not contain enough information, output: {"questions":[]}
6. difficulty: ${difficulty}
7. correctAnswer is a 0-based index (0, 1, 2, or 3)
8. Do NOT use quotation marks inside string values
9. Keep each option under 12 words`;

  // ── User prompt — chunk wrapped in clear delimiters ────────────────────────
  const userPrompt =
    `[CONTEXT START]\n${truncated}\n[CONTEXT END]\n\n` +
    `Generate ${count} ${difficulty} multiple-choice question based ONLY on the context above.`;

  const rawResponse = await generateChatJSON(systemPrompt, userPrompt, {
    temperature: 0.1,   // near-zero to suppress hallucination
    max_tokens: 800,
    num_ctx: 2048,
    timeoutMs: 300_000,
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
