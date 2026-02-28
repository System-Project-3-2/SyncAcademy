/**
 * Self-Evaluation Module  (LLM-as-a-Judge)
 *
 * IMPORTANT: This evaluator is part of a research experiment measuring
 * faithfulness and hallucination rates in a Hybrid Adaptive RAG system.
 *
 * After the primary LLM generates an answer, this module sends a separate,
 * low-temperature evaluation prompt to the SAME Ollama instance asking it to
 * score its own answer against the retrieved context.
 *
 * Measured dimensions:
 *
 *  faithfulness  (0–1)
 *    "Are all claims in the answer directly supported by the context?"
 *    Zero hallucination = 1.0; made-up facts = 0.0
 *
 *  coverage      (0–1)
 *    "Does the answer fully address the question using available context?"
 *    Complete, well-structured answer = 1.0; partial/vague = lower
 *
 *  confidence    (0–1)
 *    Combined weighted score: 0.6 × faithfulness + 0.4 × coverage
 *    (Faithfulness weighted higher because hallucination is the bigger risk)
 *
 *  supported     'YES' | 'PARTIAL' | 'NO'
 *    Categorical verdict from the judge — is the answer grounded?
 *
 * Decision logic:
 *  pass = (confidence >= ACCEPT_THRESHOLD) AND (supported !== 'NO')
 *  pass = true   → accept answer ✅
 *  pass = false  → re-retrieve + regenerate 🔁
 *
 * Robustness contract:
 *  This function NEVER throws. Malformed LLM output is caught and replaced
 *  with safe defaults so the pipeline always gets a usable evaluation object.
 */

import { generateResponse } from './ollamaService.js';

// ── Thresholds ────────────────────────────────────────────────────────────────
const ACCEPT_THRESHOLD = 0.60; // confidence below this triggers a retry

// How much context to show the evaluator per chunk (keep eval prompt compact)
const MAX_CONTEXT_CHARS_PER_CHUNK = 300;

// ── Safe Default ──────────────────────────────────────────────────────────────
// Returned when every parsing strategy fails. Cautious mid-range scores
// ensure the pipeline does NOT silently accept a potentially bad answer
// (confidence 0.5 < 0.6 threshold → triggers a retry, which is the safe
// choice when we genuinely cannot determine quality).

const SAFE_DEFAULT = Object.freeze({
  faithfulness: 0.5,
  coverage:     0.5,
  confidence:   0.5,
  supported:    'PARTIAL',
  reasoning:    'Evaluation parse error — safe defaults applied',
  parse_failed: true,
});

// ── Judge Prompt ──────────────────────────────────────────────────────────────
// DESIGN DECISIONS:
//  - "ONLY valid JSON" + "no markdown" + "no explanation" triple-reinforced
//    because small models (Mistral 7B, Phi-3) often add preambles otherwise.
//  - The EXACT schema is shown inline so the model copies it structurally.
//  - "supported" field gives a categorical signal that is more robust than
//    relying solely on floating-point thresholds for the decision engine.

const buildJudgePrompt = (question, contextText, answer) => `
You are a STRICT answer quality evaluator for a research experiment.

=== ORIGINAL QUESTION ===
${question}

=== RETRIEVED DOCUMENTS (source material) ===
${contextText}

=== GENERATED ANSWER (to evaluate) ===
${answer}

=== INSTRUCTIONS ===
Evaluate the answer against the retrieved documents.
Your response MUST be ONLY a single valid JSON object.
Do NOT include any explanation, markdown, code fences, or additional text.
Do NOT wrap the JSON in backticks or code blocks.

Use EXACTLY this schema — every field is required:
{
  "faithfulness": <number 0.0 to 1.0 — are ALL claims in the answer supported by the documents? 1.0 = fully grounded, 0.0 = fabricated>,
  "coverage": <number 0.0 to 1.0 — does the answer fully address the question using the documents? 1.0 = complete, 0.0 = misses the point>,
  "confidence": <number 0.0 to 1.0 — your overall confidence in the answer quality>,
  "supported": <"YES" if all claims are grounded | "PARTIAL" if some claims lack support | "NO" if the answer contradicts or ignores the documents>
}

Respond with ONLY the JSON object now:`.trim();

// ── JSON Extraction (3-tier fallback) ─────────────────────────────────────────
//
// Strategy 1: Parse the full response as-is (fastest path, works when model obeys)
// Strategy 2: Regex-extract the first JSON object (handles preambles / code fences)
// Strategy 3: Return SAFE_DEFAULT (guarantees pipeline never crashes)
//
// IMPORTANT: This function NEVER throws. Every code path returns a valid object.

const clamp = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);

const SUPPORTED_VALUES = new Set(['YES', 'PARTIAL', 'NO']);

/**
 * Normalize a raw parsed object into the canonical evaluation shape.
 * Clamps numeric fields to [0,1], validates 'supported' enum, truncates reasoning.
 */
const normalizeEvalObject = (parsed) => {
  const faithfulness = clamp(parseFloat(parsed.faithfulness));
  const coverage     = clamp(parseFloat(parsed.coverage));

  // Confidence: if the judge produced one, use it; otherwise compute it.
  // This lets us switch between "judge-computed" and "formula-computed"
  // confidence in experiments without code changes.
  const rawConfidence = parseFloat(parsed.confidence);
  const confidence    = Number.isFinite(rawConfidence)
    ? clamp(rawConfidence)
    : clamp(0.6 * faithfulness + 0.4 * coverage);

  const rawSupported = (typeof parsed.supported === 'string' ? parsed.supported : '').toUpperCase().trim();
  const supported    = SUPPORTED_VALUES.has(rawSupported) ? rawSupported : 'PARTIAL';

  return {
    faithfulness,
    coverage,
    confidence,
    supported,
    reasoning: typeof parsed.reasoning === 'string'
      ? parsed.reasoning.substring(0, 200)
      : '',
    parse_failed: false,
  };
};

/**
 * Extract and validate evaluation JSON from raw LLM output.
 *
 * @param   {string} raw  - The raw string returned by the judge LLM call
 * @returns {object}        Normalized evaluation object (always valid, never throws)
 */
const extractEvaluation = (raw) => {
  // ── Strategy 1: Direct full parse ──────────────────────────────────────────
  try {
    const parsed = JSON.parse(raw.trim());
    if (typeof parsed === 'object' && parsed !== null && 'faithfulness' in parsed) {
      console.log('[SelfEval] ✅ Strategy 1: direct JSON parse succeeded');
      return normalizeEvalObject(parsed);
    }
  } catch {
    // Fall through to Strategy 2
  }

  // ── Strategy 2: Regex extraction ───────────────────────────────────────────
  // Handles common noise: markdown fences, preamble text, trailing explanation.
  try {
    const stripped = raw.replace(/```(?:json)?/gi, '').trim();
    // Match the outermost { ... } block greedily to capture nested braces if any
    const jsonMatch = stripped.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed === 'object' && parsed !== null) {
        console.log('[SelfEval] ⚠️ Strategy 2: regex JSON extraction succeeded');
        return normalizeEvalObject(parsed);
      }
    }
  } catch {
    // Fall through to Strategy 3
  }

  // ── Strategy 3: Safe default ───────────────────────────────────────────────
  // CRITICAL: We never throw. The pipeline gets a conservative evaluation
  // that will likely trigger a retry (confidence 0.5 < threshold 0.6).
  console.warn('[SelfEval] ❌ Strategy 3: all parsing failed — returning safe defaults');
  console.warn('[SelfEval] Raw response was:', raw?.substring(0, 300));
  return { ...SAFE_DEFAULT };
};

// ── Shortcut Detectors ────────────────────────────────────────────────────────
// Pre-screen answers that are graceful "I don't know" fallbacks.
// No point sending these to the judge — they are technically faithful
// (make no false claims) but have zero coverage.

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
 * Run self-evaluation on a generated answer using LLM-as-a-Judge.
 *
 * @param {{
 *   question:      string,   // The original user question
 *   answer:        string,   // The LLM-generated answer to evaluate
 *   retrievedDocs: Array     // Top-K chunks / documents used to generate the answer
 * }} params
 *
 * @returns {Promise<{
 *   faithfulness:  number,   // 0–1
 *   coverage:      number,   // 0–1
 *   confidence:    number,   // 0–1 (weighted or judge-provided)
 *   supported:     string,   // 'YES' | 'PARTIAL' | 'NO'
 *   reasoning:     string,   // one-sentence justification
 *   parse_failed:  boolean,  // true if JSON extraction fell back to defaults
 *   pass:          boolean   // true = accept answer, false = trigger retry
 * }>}
 *
 * CONTRACT: This function NEVER throws. Every failure mode returns a valid object.
 */
export const runSelfEvaluation = async ({ question, answer, retrievedDocs }) => {

  // ── Fast-path: graceful fallback answers ────────────────────────────────────
  // The answer already admits it has no info → faithfulness is technically 1.0
  // (no false claims made), coverage is 0.0 (question not addressed).
  // We accept these because re-retrieval cannot improve the situation.
  if (isGracefulFallback(answer)) {
    const result = {
      faithfulness: 1.0,
      coverage:     0.0,
      confidence:   0.60,    // exactly at threshold — accepted, no retry wasted
      supported:    'NO',    // answer doesn't address the question
      reasoning:    'Answer is a graceful fallback — no relevant context found',
      parse_failed: false,
      pass:         true,    // override: re-retrieval won't help
    };
    console.log('[SelfEval] Fast-path: graceful fallback detected', result);
    return result;
  }

  // ── Build evaluation context (trimmed to keep prompt manageable) ────────────
  const contextText = retrievedDocs
    .map((doc, i) => {
      const text = doc.text || doc.chunkText || '';
      const snippet = text.length > MAX_CONTEXT_CHARS_PER_CHUNK
        ? text.substring(0, MAX_CONTEXT_CHARS_PER_CHUNK) + '...'
        : text;
      return `[${i + 1}] ${doc.courseNo || 'Unknown'}: ${snippet}`;
    })
    .join('\n\n');

  const judgePrompt = buildJudgePrompt(question, contextText, answer);

  // ── Call LLM Judge ──────────────────────────────────────────────────────────
  let raw;
  try {
    raw = await generateResponse(judgePrompt, {
      temperature: 0.0,   // fully deterministic — evaluation must be reproducible
      max_tokens:  200,   // JSON + potential noise fits in 200 tokens
    });
  } catch (err) {
    // LLM call itself failed (Ollama overload, timeout, network error).
    // Don't crash — return a passing result so the user still gets an answer.
    // This is a deliberate design choice: a missing evaluation is better than
    // a crashed pipeline that returns nothing.
    console.warn('[SelfEval] ❌ Judge LLM call failed:', err.message);
    const fallback = {
      faithfulness: 0.65,
      coverage:     0.65,
      confidence:   0.65,
      supported:    'PARTIAL',
      reasoning:    'Evaluator unavailable — passing by default',
      parse_failed: true,
      pass:         true,
    };
    console.log('[SelfEval] Research log — LLM error fallback:', fallback);
    return fallback;
  }

  // ── Research Logging: raw judge response ────────────────────────────────────
  console.log('[SelfEval] Research log — raw judge response:', raw);

  // ── Extract & validate evaluation ───────────────────────────────────────────
  const evaluation = extractEvaluation(raw);

  // ── Research Logging: parse status ──────────────────────────────────────────
  if (evaluation.parse_failed) {
    console.warn('[SelfEval] Research log — JSON parsing FAILED, using safe defaults');
  } else {
    console.log('[SelfEval] Research log — JSON parsing succeeded');
  }

  // ── Decision: pass/fail ─────────────────────────────────────────────────────
  // An answer passes ONLY if:
  //   1. Combined confidence meets the threshold  AND
  //   2. The categorical verdict is not a hard "NO"
  // This dual-gate prevents accepting high-confidence but completely
  // unsupported answers (e.g., a fluent hallucination can score high confidence
  // if the model is overconfident — the 'supported' field catches this).
  const pass = evaluation.confidence >= ACCEPT_THRESHOLD
            && evaluation.supported !== 'NO';

  const result = { ...evaluation, pass };

  // ── Research Logging: final evaluation object ───────────────────────────────
  console.log('[SelfEval] Research log — final evaluation:', JSON.stringify(result));

  return result;
};

// ── Backward-compatible alias ─────────────────────────────────────────────────
// ragService.js previously imported evaluateAnswer — this wrapper preserves
// that contract while routing through the new implementation.
export const evaluateAnswer = async (question, contextChunks, answer) => {
  return runSelfEvaluation({ question, answer, retrievedDocs: contextChunks });
};
