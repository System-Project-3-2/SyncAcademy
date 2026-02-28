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
// CRITICAL: Mistral 7B will answer from its training data if the instruction
// is too weak. The prompt must explicitly forbid every escape route:
//   - forbid outside knowledge by name
//   - require exact phrasing for the no-info case so isGracefulFallback() fires
//   - reject partial knowledge ("if ANY part is missing, say the phrase")
//   - hard sentence limit to prevent knowledge-dump padding
const SYSTEM_PROMPT = `You are a study assistant that ONLY reads the CONTEXT below.

RULES — violating any rule means your answer is wrong:
1. Every sentence you write MUST be directly supported by text in the CONTEXT.
2. Do NOT use any knowledge from your training. The CONTEXT is your only source.
3. If the question cannot be fully answered from the CONTEXT alone, say EXACTLY:
   "I don't have enough information in the uploaded materials to answer this."
4. If ANY part of the answer is missing from the CONTEXT, use rule 3 instead.
5. Maximum 3 sentences. No bullet points. No headers. No elaboration.`;

// ── Prompt Builder ─────────────────────────────────────────────────────────────
// NOTE: Do NOT use a trailing label like "Answer (use ONLY...):" — Mistral
// treats it as a sentence to complete and echoes the instruction back into the
// output ("In this context, it's being asked... The answer would be:").
// Ending with a clean [CONTEXT END] boundary gives the model a clear stop point.
const buildPrompt = (question, contextChunks) => {
  let prompt = `${SYSTEM_PROMPT}\n\n`;
  prompt += '[CONTEXT START]\n';
  contextChunks.forEach((chunk) => {
    const text = chunk.text.length > 400 ? chunk.text.substring(0, 400) + '...' : chunk.text;
    prompt += `[${chunk.courseNo} - ${chunk.courseTitle}]: ${text}\n\n`;
  });
  prompt += '[CONTEXT END]\n\n';
  prompt += `Student question: ${question}\n`;
  prompt += 'Answer based only on the context above (3 sentences max):';
  return prompt;
};

// ── Topic Relevance Gate ───────────────────────────────────────────────────────
// Cosine similarity can score 0.60+ for off-topic questions because embedding
// models share a general semantic latent space. A question about Newton's laws
// will embed near "forces / action / reaction" — words that can accidentally
// co-occur in engineering course material.
//
// This gate checks whether the key DOMAIN-SPECIFIC nouns from the question
// appear verbatim in the retrieved chunk texts. If none do, the retrieval hit
// is a false positive and we should return the no-info fallback immediately
// rather than letting the LLM hallucinate an answer.
//
// Algorithm:
//  1. Strip punctuation + lowercase, tokenise on whitespace.
//  2. Keep tokens ≥ 5 characters that are NOT in a common-English stop list.
//  3. If fewer than MIN_MATCH_RATIO of those tokens appear in the combined
//     chunk text, the topic is considered out-of-scope.

const TOPIC_STOP_WORDS = new Set([
  'about','above','after','again','also','although','always','another',
  'before','being','below','between','could','define','description',
  'during','either','every','explain','first','following','given',
  'having','hence','however','known','latter','least','making',
  'means','might','often','order','other','otherwise','please',
  'quite','rather','same','second','shall','should','since','stated',
  'still','their','there','these','third','those','through','under',
  'until','using','where','whether','which','while','whose','within',
  'without','would','write','written','describe','mentioned',
]);

const MIN_MATCH_RATIO = 0.25; // at least 25% of signal words must appear in chunks

const checkTopicRelevance = (question, chunks) => {
  const signalWords = question
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')  // remove digits and punctuation
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !TOPIC_STOP_WORDS.has(w));

  // If no signal words extracted, we cannot determine relevance — allow through
  if (signalWords.length === 0) return true;

  const combinedText = chunks.map((c) => (c.text || '').toLowerCase()).join(' ');
  const matchCount   = signalWords.filter((w) => combinedText.includes(w)).length;
  const ratio        = matchCount / signalWords.length;

  console.log(
    `[RAG] Topic relevance → signal=[${signalWords.join(', ')}], ` +
    `matches=${matchCount}/${signalWords.length}, ratio=${ratio.toFixed(2)}`
  );

  return ratio >= MIN_MATCH_RATIO;
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

    // Topic relevance gate: cosine similarity can be spuriously high for
    // off-topic questions when the embedding model finds incidental overlap.
    // Verify that the question's domain-specific vocabulary actually appears
    // in the retrieved chunks before spending an LLM call.
    if (!checkTopicRelevance(question, topChunks)) {
      console.log('[RAG] ❌ Topic relevance gate failed — off-topic question detected');
      return {
        answer:
          "I don't have enough information in the uploaded course materials to answer this question. " +
          'This topic does not appear to be covered in the available materials.',
        sources: [],
        metadata: {
          queryType, complexity, attempt, bestScore, confidence: 0,
          faithfulness: 0, coverage: 0, evalReasoning: 'Topic relevance gate: question vocabulary absent from chunks',
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
      threshold: 0.50,
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
      console.log('[RAG] ⚠️ Max retries reached — all evaluations failed');
    }
  }

  // If every self-eval attempt failed, decide whether to accept a best-effort
  // answer or return the no-info message.
  //
  // Accept when ALL of:
  //   • retrieval score >= 0.55  (chunks are semantically close to the question)
  //   • faithfulness   >= 0.40  (most answer claims appear in the context)
  //   • supported is not "NO"   (judge did not entirely reject grounding)
  // This guards against the judge LLM inconsistently penalising genuinely
  // grounded answers while still blocking low-quality / hallucinated responses.
  if (evaluation && !evaluation.pass) {
    const retrievalScore = finalChunks[0]?.score ?? 0;
    const acceptBestEffort =
      retrievalScore           >= 0.55 &&
      evaluation.faithfulness  >= 0.40 &&
      evaluation.supported     !== 'NO';

    if (acceptBestEffort) {
      console.log(
        `[RAG] ⚡ Best-effort acceptance — ` +
        `retrievalScore=${retrievalScore.toFixed(3)}, ` +
        `faithfulness=${evaluation.faithfulness.toFixed(2)}, ` +
        `supported=${evaluation.supported}`
      );
    } else {
      console.log('[RAG] ❌ All attempts failed evaluation — returning no-info response');
      return {
        answer:
          "I don't have enough information in the uploaded course materials to answer this question. " +
          'The retrieved documents do not contain sufficient grounding for this topic. ' +
          'Try uploading relevant materials first.',
        sources: [],
        metadata: {
          queryType, complexity, attempt,
          bestScore:    retrievalScore,
          confidence:   evaluation.confidence   ?? 0,
          faithfulness: evaluation.faithfulness ?? 0,
          coverage:     evaluation.coverage     ?? 0,
          supported:    evaluation.supported    ?? 'NO',
          evalReasoning: 'All attempts rejected — likely parametric knowledge answer',
          parseFailed:  evaluation.parse_failed ?? false,
        },
      };
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
