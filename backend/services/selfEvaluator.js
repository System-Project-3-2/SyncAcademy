/**
 * Self-Evaluation Module  (LLM-as-a-Judge)
 *
 * After the primary LLM generates an answer, this module sends a separate,
 * low-temperature evaluation prompt to the SAME Ollama instance asking it to
 * score its own answer against the retrieved context.
 *
 * Two dimensions are measured:
 *
 *  faithfulness  (0–1)
 *    "Are all claims in the answer directly supported by the context?"
 *    Zero hallucination = 1.0; made-up facts = 0.0
 *
 *  coverage      (0–1)
 *    "Does the answer fully address the question using available context?"
 *    Complete, well-structured answer = 1.0; partial/vague = lower
 *
 * Combined confidence = 0.6 × faithfulness + 0.4 × coverage
 * (Faithfulness weighted higher because hallucination is the bigger risk)
 *
 * Decision thresholds:
 *  confidence >= ACCEPT_THRESHOLD  → accept answer ✅
 *  confidence <  ACCEPT_THRESHOLD  → re-retrieve + regenerate 🔁
 */

import { generateResponse } from './ollamaService.js';

// ── Thresholds ────────────────────────────────────────────────────────────────
const ACCEPT_THRESHOLD = 0.60; // answers below this trigger a retry

// How much context to show the evaluator per chunk (keep eval prompt small)
const MAX_CONTEXT_CHARS_PER_CHUNK = 300;

// ── Eval Prompt ───────────────────────────────────────────────────────────────

const buildEvalPrompt = (question, contextText, answer) => `
You are a strict answer quality evaluator for a student study assistant.

=== ORIGINAL QUESTION ===
${question}

=== RETRIEVED CONTEXT (source materials) ===
${contextText}

=== GENERATED ANSWER (to evaluate) ===
${answer}

=== YOUR TASK ===
Evaluate the answer on exactly two dimensions.

faithfulness  : Float 0.0–1.0
  → Are ALL claims in the answer directly supported by the context above?
  → 1.0 = every statement is grounded in context; 0.0 = answer ignores context or invents facts.

coverage      : Float 0.0–1.0
  → Does the answer fully and correctly address the question using the available context?
  → 1.0 = complete, on-point answer; 0.0 = answer misses the point or is too vague.

Respond with EXACTLY this JSON — no preamble, no explanation outside the JSON:
{
  "faithfulness": <float>,
  "coverage": <float>,
  "reasoning": "<one concise sentence explaining both scores>"
}
`.trim();

// ── JSON Parser (robust) ──────────────────────────────────────────────────────

/**
 * Extract evaluation scores from the LLM's raw string output.
 * Handles cases where the model wraps JSON in markdown or adds extra text.
 */
const parseEvalResponse = (raw) => {
  try {
    // Strip markdown code fences if present
    const stripped = raw.replace(/```(?:json)?/gi, '').trim();

    const jsonMatch = stripped.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error('No JSON object found in eval response');

    const parsed = JSON.parse(jsonMatch[0]);

    const faithfulness = clamp(parseFloat(parsed.faithfulness));
    const coverage     = clamp(parseFloat(parsed.coverage));
    const reasoning    = typeof parsed.reasoning === 'string'
      ? parsed.reasoning.substring(0, 200)
      : '';

    return { faithfulness, coverage, reasoning };
  } catch (err) {
    // Graceful degradation: if the LLM can't produce parseable JSON,
    // assign cautious mid-range scores rather than crashing the pipeline.
    console.warn('[SelfEval] Failed to parse eval response:', err.message);
    console.warn('[SelfEval] Raw response was:', raw?.substring(0, 200));
    return {
      faithfulness: 0.50,
      coverage:     0.50,
      reasoning:    'Evaluation parse error — cautious defaults applied',
    };
  }
};

const clamp = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);

// ── Shortcut Detectors ────────────────────────────────────────────────────────

const NO_INFO_SIGNALS = [
  "don't have enough information",
  "no information",
  "unable to generate",
  "not in the uploaded",
];

const isGracefulFallback = (answer) =>
  NO_INFO_SIGNALS.some((s) => answer.toLowerCase().includes(s));

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Evaluate a generated answer against its retrieved context.
 *
 * @param {string}  question      - The original user question
 * @param {Array}   contextChunks - Top-K chunks used to generate the answer
 * @param {string}  answer        - The LLM-generated answer to evaluate
 *
 * @returns {{
 *   faithfulness : number,  // 0–1
 *   coverage     : number,  // 0–1
 *   confidence   : number,  // combined score (0–1)
 *   reasoning    : string,
 *   pass         : boolean  // true = accept, false = trigger retry
 * }}
 */
export const evaluateAnswer = async (question, contextChunks, answer) => {
  // ── Fast-path 1: graceful fallback answers ──────────────────────────────────
  // The answer already admits it has no info → faithfulness is technically
  // correct (no false claims), but coverage is 0 (question was not answered).
  // We still accept them because re-retrieval won't change the situation.
  if (isGracefulFallback(answer)) {
    return {
      faithfulness: 1.0,
      coverage:     0.0,
      confidence:   0.60, // just at the accept threshold — no retry wasted
      reasoning:    'Answer is a graceful fallback — no relevant context found',
      pass:         true,
    };
  }

  // ── Build evaluation context (trimmed to keep prompt manageable) ────────────
  const contextText = contextChunks
    .map((c, i) => {
      const snippet = c.text.length > MAX_CONTEXT_CHARS_PER_CHUNK
        ? c.text.substring(0, MAX_CONTEXT_CHARS_PER_CHUNK) + '...'
        : c.text;
      return `[${i + 1}] ${c.courseNo || 'Unknown'}: ${snippet}`;
    })
    .join('\n\n');

  const evalPrompt = buildEvalPrompt(question, contextText, answer);

  // ── Call Ollama with deterministic settings ─────────────────────────────────
  let raw;
  try {
    raw = await generateResponse(evalPrompt, {
      temperature: 0.0,   // fully deterministic — evaluation must be consistent
      max_tokens:  150,   // scores + one-sentence reasoning fits in 150 tokens
    });
  } catch (err) {
    // If the evaluator call itself fails (e.g. Ollama overload), don't crash —
    // return a passing score so the pipeline still delivers an answer.
    console.warn('[SelfEval] Evaluator call failed:', err.message);
    return {
      faithfulness: 0.65,
      coverage:     0.65,
      confidence:   0.65,
      reasoning:    'Evaluator unavailable — passing by default',
      pass:         true,
    };
  }

  // ── Parse and compute final scores ─────────────────────────────────────────
  const { faithfulness, coverage, reasoning } = parseEvalResponse(raw);

  // Weighted combination — faithfulness matters more (anti-hallucination)
  const confidence = 0.6 * faithfulness + 0.4 * coverage;
  const pass = confidence >= ACCEPT_THRESHOLD;

  return { faithfulness, coverage, confidence, reasoning, pass };
};
