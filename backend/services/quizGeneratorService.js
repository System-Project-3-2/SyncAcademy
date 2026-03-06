import MaterialChunk from "../models/materialChunkModel.js";
import Material from "../models/materialModel.js";
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
export const generateQuiz = async (courseNo, numQuestions = 5, difficulty = "medium", materialId = null) => {
  // 1. Fetch materials for the course
  const materialFilter = { courseNo };
  if (materialId) materialFilter._id = materialId;

  const materials = await Material.find(materialFilter).select("_id title").lean();
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

  // 4. Generate questions from selected chunks in batches
  const questions = [];
  const batchSize = Math.min(3, numQuestions); // Generate up to 3 questions per prompt

  for (let i = 0; i < selectedChunks.length && questions.length < numQuestions; i++) {
    const chunk = selectedChunks[i];
    const remaining = numQuestions - questions.length;
    const count = Math.min(batchSize, remaining);

    try {
      const generated = await generateQuestionsFromChunk(chunk.chunkText, count, difficulty);
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

  // Shuffle and pick enough chunks (1-3 questions per chunk)
  const shuffled = usable.sort(() => Math.random() - 0.5);
  const needed = Math.ceil(numQuestions / 2); // ~2 questions per chunk
  return shuffled.slice(0, Math.max(needed, numQuestions));
}

/**
 * Generate MCQ questions from a single text chunk using Ollama.
 */
async function generateQuestionsFromChunk(chunkText, count, difficulty) {
  const systemPrompt = `You are an expert educational quiz creator. Generate multiple-choice questions based ONLY on the provided text. Each question must be directly answerable from the text.

Rules:
- Generate exactly ${count} question(s)
- Difficulty level: ${difficulty}
- Each question must have exactly 4 options
- Only ONE option should be correct
- Include a brief explanation for the correct answer
- Questions should test understanding, not just recall
- For "easy": straightforward factual questions
- For "medium": questions requiring understanding of concepts
- For "hard": questions requiring analysis or application

You MUST respond with valid JSON and nothing else. Use this exact format:
{
  "questions": [
    {
      "questionText": "the question",
      "options": ["option A", "option B", "option C", "option D"],
      "correctAnswer": 0,
      "explanation": "why this is correct"
    }
  ]
}`;

  const userPrompt = `Generate ${count} ${difficulty} multiple-choice question(s) from this text:\n\n${chunkText}`;

  const rawResponse = await generateChatJSON(systemPrompt, userPrompt, {
    temperature: 0.7,
    max_tokens: 1500,
    num_ctx: 4096,
  });

  // Parse the JSON response
  let parsed;
  try {
    parsed = JSON.parse(rawResponse);
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Failed to parse Ollama response as JSON");
    }
  }

  const rawQuestions = parsed.questions || parsed.Questions || [parsed];

  // Validate and normalize each question
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
