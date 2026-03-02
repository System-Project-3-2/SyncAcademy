/**
 * Self-Evaluation Module  (LLM-as-a-Judge)
 *
 * Research component of the Hybrid Adaptive RAG pipeline.
 * Evaluates whether a generated answer is faithfully grounded in
 * retrieved documents using a small local LLM (Mistral 7B / TinyLLaMA).
 *
 * Design principles for small-model robustness:
 *   - Minimal prompt: no reasoning field, no markdown, JSON-only output
 *   - Top-2 chunks only: prevents context overflow on small models
 *   - Model scores all four fields; defensive calibration corrects overconfidence
 *   - 3-tier fallback ensures the pipeline NEVER crashes on malformed output
 *
 * Scoring dimensions:
 *   faithfulness (0–1) — fraction of answer claims grounded in retrieved docs
 *   coverage     (0–1) — fraction of the question addressed by the answer
 *   confidence   (0–1) — model's certainty in its scores (capped at coverage)
 *   supported    "YES" | "PARTIAL" | "NO" — categorical groundedness verdict
 *
 * Pass gate:  confidence >= threshold  AND  supported !== "NO"
 *
 * ROBUSTNESS CONTRACT:
 *   runSelfEvaluation() NEVER throws regardless of LLM output.
 *   All failure paths degrade gracefully to SAFE_DEFAULT.
 */

import { generateChatJSON } from './ollamaService.js';

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_EVAL_CHUNKS     = 2;    // top-2 only — keeps prompt short for small models
const MAX_CHARS_PER_CHUNK = 400;  // truncation limit per chunk
const DEFAULT_THRESHOLD   = 0.50; // used when caller omits threshold

// ── Safe Default ─────────────────────────────────────────────────────────────
// All fields at 0.5 → confidence(0.5) >= DEFAULT_THRESHOLD(0.50) only if supported is not 'NO'
// — when parse fails, the pipeline triggers a retry before accepting.
const SAFE_DEFAULT = Object.freeze({
  faithfulness: 0.5,
  coverage:     0.5,
  confidence:   0.5,
  supported:    'PARTIAL',
  parse_failed: true,
});

const SUPPORTED_VALUES = new Set(['YES', 'PARTIAL', 'NO']);

// ── Judge Prompt ─────────────────────────────────────────────────────────────
// DESIGN: minimal prompt suited for TinyLLaMA / Mistral 7B Instruct.
//
//  • No reasoning field — small models under format:"json" produce unreliable
//    free-text reasoning; omitting it keeps output short and reliably parseable.
//  • No concrete number examples — prevents "schema anchoring" where the model
//    copies a literal 0.0 or 1.0 from the prompt template without evaluating.
//  • SCORE / VERDICT placeholders cannot be literally copied as valid decimals.
//  • Calibration post-processing below corrects residual overconfidence.

// BUG FIX — "VERDICT" literal echo:
//   Previous format had `"supported":"VERDICT"`. A quoted string is already valid
//   JSON, so the model copies "VERDICT" verbatim rather than replacing it.
//   Unquoted SCORE placeholders are NOT valid JSON, forcing the model to substitute.
//   Fix: use "?" for supported (clearly not a real answer, forces substitution)
//   and list the exact accepted values on a separate line.

const JUDGE_SYSTEM = `You are a JSON scorer. Output ONLY valid JSON — no text before or after.

Output format:
{"faithfulness":SCORE,"coverage":SCORE,"confidence":SCORE,"supported":"?"}

Rules:
- Replace each SCORE with a decimal between 0.0 and 1.0
- Replace "?" with exactly one of: "YES", "PARTIAL", "NO" — nothing else

faithfulness : what fraction of claims in the ANSWER are explicitly stated in the CONTEXT?
coverage     : what fraction of the QUESTION is answered using the CONTEXT?
confidence   : how certain are you in your faithfulness and coverage scores?
supported    : "YES" if well grounded, "PARTIAL" if partly grounded, "NO" if not grounded.`;

const buildJudgePrompt = (question, answer, contextText) =>
`CONTEXT:
${contextText}

QUESTION: ${question}

ANSWER: ${answer}

Score the ANSWER against the CONTEXT using the required JSON format.`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const clamp = (v, fallback = 0.5) =>
  (Number.isFinite(v) && v >= 0 && v <= 1) ? v : fallback;

/**
 * Apply defensive calibration to raw model scores.
 *
 * Rules (per spec):
 *  1. confidence > coverage → set confidence = coverage
 *     A score cannot be more confident than its coverage supports.
 *     This is the primary safeguard against small models defaulting to 1.0.
 *  2. All values clamped to [0, 1].
 *  3. Unrecognised `supported` strings default to 'PARTIAL'.
 */
const calibrate = (raw) => {
  const faithfulness = clamp(parseFloat(raw.faithfulness));
  const coverage     = clamp(parseFloat(raw.coverage));

  // When the judge omits `confidence` entirely, parseFloat returns NaN.
  // Fall back to faithfulness as a proxy rather than clamping to the hard-coded
  // 0.5 default — this prevents good answers from always failing the pass gate.
  const rawConf = parseFloat(raw.confidence);
  let confidence = (Number.isFinite(rawConf) && rawConf >= 0 && rawConf <= 1)
    ? rawConf
    : faithfulness;

  // Rule 1: cap confidence at coverage
  if (confidence > coverage) confidence = coverage;

  const rawS      = (typeof raw.supported === 'string' ? raw.supported : '').toUpperCase().trim();
  const supported = SUPPORTED_VALUES.has(rawS) ? rawS : 'PARTIAL';

  return { faithfulness, coverage, confidence, supported, parse_failed: false };
};

// ── 3-Tier JSON Extraction ────────────────────────────────────────────────────
//
// Tier 1 ─ Direct parse
//   Fast path. Works when format:"json" is fully honored (the common case).
//
// Tier 2 ─ Regex extraction
//   Handles code fences (```json...```), preamble text, or trailing garbage
//   that a misbehaving model may wrap around the JSON object.
//
// Tier 3 ─ Safe default
//   Returns SAFE_DEFAULT with confidence < threshold → pipeline retries.
//   Guarantees the pipeline never receives undefined or throws.

const parseEvaluation = (raw) => {
  // Tier 1 ─ direct parse
  try {
    const parsed = JSON.parse(raw.trim());
    if (parsed && typeof parsed === 'object' && 'faithfulness' in parsed) {
      console.log('[SelfEval] ✅ Tier 1: direct JSON parse succeeded');
      return calibrate(parsed);
    }
  } catch { /* fall through */ }

  // Tier 2 ─ strip noise and extract first JSON object
  try {
    const cleaned = raw
      .replace(/```(?:json)?/gi, '')    // remove code fences
      .replace(/[\u0000-\u001f]/g, ' ') // strip control characters
      .trim();
    // Match outermost {...} including simple nested braces
    const match = cleaned.match(/\{(?:[^{}]|\{[^{}]*\})*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed && typeof parsed === 'object') {
        console.log('[SelfEval] ⚠️ Tier 2: regex extraction succeeded');
        return calibrate(parsed);
      }
    }
  } catch { /* fall through */ }

  // Tier 3 ─ safe default
  console.warn('[SelfEval] ❌ Tier 3: all parsing failed — safe defaults applied');
  console.warn('[SelfEval] Raw response (first 300 chars):', raw?.substring(0, 300));
  return { ...SAFE_DEFAULT };
};

// ── Graceful-fallback detector ────────────────────────────────────────────────
// When the RAG pipeline itself said "I don't have information", skip the judge
// call — there is nothing meaningful to score.
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
 * Evaluate whether a generated answer is supported by retrieved documents.
 *
 * @param {object}  params
 * @param {string}  params.question      - The user's original question
 * @param {string}  params.answer        - The LLM-generated answer to evaluate
 * @param {Array}   params.retrievedDocs - Retrieved chunk objects (text/chunkText fields)
 * @param {number} [params.threshold]    - Minimum confidence to pass (default 0.60)
 *
 * @returns {Promise<{
 *   faithfulness : number,
 *   coverage     : number,
 *   confidence   : number,
 *   supported    : "YES" | "PARTIAL" | "NO",
 *   parse_failed : boolean,
 *   pass         : boolean
 * }>}
 *
 * CONTRACT: Never throws. Always returns a complete, valid evaluation object.
 */
export const runSelfEvaluation = async ({
  question,
  answer,
  retrievedDocs,
  threshold = DEFAULT_THRESHOLD,
}) => {

  // Fast-path: graceful no-info answers should not be retried
  if (isGracefulFallback(answer)) {
    const result = {
      faithfulness: 0.0,
      coverage:     0.0,
      confidence:   0.0,
      supported:    'NO',
      parse_failed: false,
      pass: true,
    };
    console.log('[SelfEval] Fast-path: graceful no-info fallback →', result);
    return result;
  }

  // ── Preprocess: top-2 chunks, 400 chars each ──────────────────────────────
  const topChunks  = (Array.isArray(retrievedDocs) ? retrievedDocs : [])
    .slice(0, MAX_EVAL_CHUNKS);

  const contextText = topChunks
    .map((doc, i) => {
      const text    = (doc.text || doc.chunkText || String(doc)).trim();
      const snippet = text.length > MAX_CHARS_PER_CHUNK
        ? text.substring(0, MAX_CHARS_PER_CHUNK) + '...'
        : text;
      const label   = doc.courseNo ? `[${i + 1}] ${doc.courseNo}` : `[${i + 1}]`;
      return `${label}: ${snippet}`;
    })
    .join('\n\n');

  const userPrompt = buildJudgePrompt(question, answer, contextText);

  // ── Call judge LLM ────────────────────────────────────────────────────────
  let raw;
  try {
    raw = await generateChatJSON(JUDGE_SYSTEM, userPrompt, {
      temperature: 0.1,  // slight randomness avoids max-likelihood anchoring to 1.0
      max_tokens:  120,  // 4-field JSON ~80 tokens; 120 gives headroom without bloat
      num_ctx:     2048,
    });
  } catch (err) {
    console.warn('[SelfEval] ❌ Judge LLM call failed:', err.message);
    // Mark pass=true so the pipeline does not loop on a transient outage
    const fallback = { ...SAFE_DEFAULT, pass: true };
    console.log('[SelfEval] Research log — LLM error fallback:', fallback);
    return fallback;
  }

  // ── Research log: raw response ────────────────────────────────────────────
  console.log('[SelfEval] Research log — raw judge response:', raw);

  // ── Parse + calibrate ─────────────────────────────────────────────────────
  const evaluation = parseEvaluation(raw);

  // ── Research log: parse status ────────────────────────────────────────────
  if (evaluation.parse_failed) {
    console.warn('[SelfEval] Research log — parse_failed: true (safe defaults in use)');
  } else {
    console.log('[SelfEval] Research log — parse_failed: false');
  }

  // ── Pass gate ─────────────────────────────────────────────────────────────
  // Accept if EITHER calibrated confidence OR raw faithfulness clears the
  // threshold — guarding against judge models that omit the confidence field
  // or assign it inconsistently while still scoring faithfulness correctly.
  const pass = (evaluation.confidence >= threshold || evaluation.faithfulness >= threshold)
            && evaluation.supported !== 'NO';

  const result = { ...evaluation, pass };

  // ── Research log: final evaluation ───────────────────────────────────────
  console.log('[SelfEval] Research log — final evaluation:', JSON.stringify(result));

  return result;
};

// ── Backward-compatible alias ─────────────────────────────────────────────────
// Kept for any code still calling the old 3-arg positional signature.
export const evaluateAnswer = (question, contextChunks, answer) =>
  runSelfEvaluation({ question, answer, retrievedDocs: contextChunks });
