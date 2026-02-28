/**
 * RAG Service — Hybrid Adaptive Retrieval + Self-Evaluation Pipeline
 *
 * Pipeline stages:
 *   1. Query Analysis     → classify type, estimate complexity, expand sub-queries
 *   2. Adaptive Retrieval → choose top-K / threshold dynamically, multi-query merge
 *   3. Answer Generation  → Ollama LLM with grounded prompt
 *   4. Self-Evaluation    → LLM-as-a-judge rates faithfulness + coverage
 *   5. Decision Engine    → accept ✅ or re-retrieve + regenerate 🔁 (max retries)
 */

import { generateResponse }  from './ollamaService.js';
import { analyzeQuery }      from './queryAnalyzer.js';
import { adaptiveRetrieve }  from './adaptiveRetriever.js';
import { runSelfEvaluation } from './selfEvaluator.js';

// ── Config ────────────────────────────────────────────────────────────────────
const MAX_RETRIES = 2; // max re-retrieve + regenerate cycles before accepting best effort

// ── System Prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a study assistant. STRICT RULES:
1. ONLY use the CONTEXT provided below to answer. Do NOT use outside knowledge.
2. If the answer is not in the CONTEXT, say exactly: "I don't have enough information in the uploaded materials to answer this."
3. Do NOT make up facts, names, formulas, or definitions.
4. Answer in 2-4 sentences maximum. Be direct.`;

// ── Prompt Builder ─────────────────────────────────────────────────────────────
const buildPrompt = (question, contextChunks) => {
  let prompt = `${SYSTEM_PROMPT}\n\n`;
  prompt += '=== CONTEXT (from uploaded course materials) ===\n';
  contextChunks.forEach((chunk) => {
    const text = chunk.text.length > 400 ? chunk.text.substring(0, 400) + '...' : chunk.text;
    prompt += `[${chunk.courseNo} - ${chunk.courseTitle}]: ${text}\n\n`;
  });
  prompt += '=== END CONTEXT ===\n\n';
  prompt += `Question: ${question}\nAnswer (use ONLY the context above):`;
  return prompt;
};

// ── Source Deduplicator ────────────────────────────────────────────────────────
const extractSources = (chunks) => {
  const map = {};
  for (const c of chunks) {
    if (!map[c.materialId]) {
      map[c.materialId] = {
        courseTitle: c.courseTitle,
        courseNo:    c.courseNo,
        type:        c.type,
        fileUrl:     c.fileUrl,
        relevance:   c.score,
      };
    }
  }
  return Object.values(map);
};

// ── Main Export ────────────────────────────────────────────────────────────────

/**
 * Hybrid RAG pipeline — called by the chat controller.
 *
 * @param {string} question    - The user's message
 * @param {Array}  chatHistory - Previous messages [{role, content}, …] (context window)
 * @param {object} [filters]   - Optional {courseNo, type}
 * @returns {{
 *   answer   : string,
 *   sources  : Array,
 *   metadata : object   // query analysis + eval scores — useful for research logging
 * }}
 */
export const ragChat = async (question, chatHistory = [], filters = {}) => {

  // ── STAGE 1: Query Analysis ──────────────────────────────────────────────────
  const { queryType, complexity, initialConfidence, expandedQueries } =
    analyzeQuery(question);

  console.log(
    `[RAG] Query Analysis → type=${queryType}, complexity=${complexity}, ` +
    `subQueries=${expandedQueries.length}, initialConfidence=${initialConfidence.toFixed(2)}`
  );

  let attempt       = 0;
  let finalAnswer   = null;
  let finalChunks   = [];
  let evaluation    = null;
  let currentQueries = expandedQueries;

  // ── STAGES 2-5: Retrieval → Generation → Evaluation → Decision loop ──────────
  while (attempt < MAX_RETRIES) {
    attempt++;

    // ── STAGE 2: Adaptive Retrieval ─────────────────────────────────────────────
    const { topChunks, bestScore, config } = await adaptiveRetrieve(
      currentQueries,
      complexity,
      filters
    );

    console.log(
      `[RAG] Attempt ${attempt}/${MAX_RETRIES} → ` +
      `bestScore=${bestScore.toFixed(3)}, chunks=${topChunks.length}, ` +
      `topK=${config.topK}, threshold=${config.threshold}`
    );

    // Hard stop: no material is relevant enough even with relaxed retrieval
    if (bestScore < config.noContextThreshold || topChunks.length === 0) {
      return {
        answer:
          "I don't have enough information in the uploaded course materials to answer this question. " +
          'Try uploading relevant materials first, or ask something related to the available courses.',
        sources: [],
        metadata: {
          queryType, complexity, attempt, bestScore, confidence: 0,
          faithfulness: 0, coverage: 0, evalReasoning: 'No relevant context found',
        },
      };
    }

    // ── STAGE 3: Answer Generation ───────────────────────────────────────────────
    const prompt = buildPrompt(question, topChunks);
    let answer = await generateResponse(prompt, {
      temperature: 0.1,
      max_tokens:  350,
    });
    answer = (answer || '').trim();
    if (!answer) {
      answer = 'I was unable to generate a response. Please try rephrasing your question.';
    }

    // ── STAGE 4: Self-Evaluation ─────────────────────────────────────────────────
    evaluation = await runSelfEvaluation({
      question,
      answer,
      retrievedDocs: topChunks,
    });

    console.log(
      `[RAG] Self-Eval → faithfulness=${evaluation.faithfulness.toFixed(2)}, ` +
      `coverage=${evaluation.coverage.toFixed(2)}, ` +
      `confidence=${evaluation.confidence.toFixed(2)}, ` +
      `supported=${evaluation.supported}, pass=${evaluation.pass}`
    );

    finalAnswer = answer;
    finalChunks = topChunks;

    // ── STAGE 5: Decision Engine ─────────────────────────────────────────────────
    if (evaluation.pass) {
      console.log('[RAG] ✅ Answer accepted by self-evaluator');
      break;
    }

    if (attempt < MAX_RETRIES) {
      console.log('[RAG] 🔁 Confidence below threshold — broadening retrieval query');
      // Retry strategy: append a detail-seeking variant to widen recall
      currentQueries = [
        ...new Set([
          ...expandedQueries,
          `${question} explain in detail`,
          `${question} definition example`,
        ]),
      ];
    } else {
      console.log('[RAG] ⚠️ Max retries reached — returning best-effort answer');
    }
  }

  return {
    answer: finalAnswer,
    sources: extractSources(finalChunks),
    metadata: {
      queryType,
      complexity,
      attempt,
      bestScore:     finalChunks[0]?.score        ?? 0,
      confidence:    evaluation?.confidence        ?? 0,
      faithfulness:  evaluation?.faithfulness      ?? 0,
      coverage:      evaluation?.coverage          ?? 0,
      supported:     evaluation?.supported         ?? 'PARTIAL',
      evalReasoning: evaluation?.reasoning         ?? '',
      parseFailed:   evaluation?.parse_failed      ?? false,
    },
  };
};
