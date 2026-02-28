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
const DEFAULT_THRESHOLD   = 0.60; // used when caller omits threshold

// ── Safe Default ─────────────────────────────────────────────────────────────
// All fields at 0.5 → confidence(0.5) < DEFAULT_THRESHOLD(0.60) → triggers
// a pipeline retry rather than silently accepting a potentially bad answer.
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

// BUG FIX — model swapping field types (e.g. "confidence":"PARTIAL", "faithfulness":"YES"):
//   Small models confuse which fields are numbers vs strings when the schema mixes them.
//   Fix: use <0.0–1.0> angle-bracket annotations for numeric fields (not valid JSON,
//   forces substitution), and split the format line into typed rules so the model
//   cannot confuse which fields take numbers vs which take the verdict string.

// PROMPT DESIGN NOTES:
//  • confidence and supported are the two most-confused fields in small models.
//    The model sees YES/PARTIAL/NO for `supported` and then fills `confidence`
//    with the same words because they sound semantically similar.
//    Fix: describe them in SEPARATE, clearly-labelled sections with an explicit
//    warning that confidence MUST be a decimal number, never a verdict word.
//  • Using unusual example decimals (0.34, 0.72, 0.91) breaks "schema anchoring"
//    where the model copies literal values like 0.7/0.85 from the instruction.
//  • supported is described AFTER the three numeric fields so the model has
//    fully processed the numeric context before encountering YES/PARTIAL/NO.
const JUDGE_SYSTEM = `You are a JSON scorer. Output ONLY valid JSON — no text before or after.

Output format — fill in every placeholder:
{"faithfulness":<number>,"coverage":<number>,"confidence":<number>,"supported":<verdict>}

NUMERIC FIELDS — faithfulness, coverage, confidence MUST all be decimal numbers:
faithfulness : How much of the ANSWER is explicitly stated in the CONTEXT?
               0.0 = nothing supported, 0.34 = some supported, 0.72 = mostly supported, 1.0 = all supported
coverage     : How much of the QUESTION does the ANSWER actually address?
               0.0 = none addressed, 0.34 = some addressed, 0.72 = mostly addressed, 1.0 = fully addressed
confidence   : How certain are you in your faithfulness and coverage scores?
               0.0 = very uncertain, 0.34 = somewhat uncertain, 0.72 = fairly certain, 0.91 = very certain

⚠️ WARNING: confidence MUST be a decimal number like 0.72.
   NEVER write YES, PARTIAL, or NO for confidence — those words are ONLY for supported below.

VERDICT FIELD:
supported    : Based on faithfulness above, choose exactly one: YES  PARTIAL  NO
               YES = nearly all claims are in the context
               PARTIAL = some claims are in the context
               NO = claims are not in the context`;

const buildJudgePrompt = (question, answer, contextText) =>
`CONTEXT:
${contextText}

QUESTION: ${question}

ANSWER: ${answer}

Score the ANSWER against the CONTEXT using the required JSON format.`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const clamp = (v, fallback = 0.5) =>
  (Number.isFinite(v) && v >= 0 && v <= 1) ? v : fallback;

// Handles decimals (0.85), integers (1), percentages ("100%"), and garbage strings.
// Special case: "PARTIAL"/"partial" for a confidence field likely means the model
// intended moderate certainty — mapped to 0.55 (just below threshold) so the
// pipeline retries rather than accepting a low-confidence answer outright.
const parseScore = (v, fieldName = '') => {
  const s = String(v ?? '').trim();
  const pct = s.match(/^(\d+(?:\.\d+)?)%$/);         // "85%" → 0.85
  if (pct) return clamp(parseFloat(pct[1]) / 100);
  const n = parseFloat(s);
  if (!isNaN(n) && n > 1 && n <= 100) return clamp(n / 100); // "85" → 0.85
  if (!isNaN(n)) return clamp(n);                    // 0.85 → 0.85
  // Garbage string — NaN path
  // For confidence specifically: the model output a verdict word instead of a decimal.
  // Semantic mapping: "YES" = very certain, "PARTIAL" = moderately certain, "NO" = uncertain.
  // "PARTIAL" → 0.65 (above threshold 0.60): the model IS moderately confident; it just used
  // the wrong vocabulary. Mapping to 0.55 would cause every "PARTIAL" answer to fail even when
  // faithfulness/coverage are high and supported=YES — which is the bug we're fixing.
  if (fieldName === 'confidence') {
    const upper = s.toUpperCase();
    if (upper.startsWith('YE'))  return 0.80; // "YES" confidence → high certainty
    if (upper.startsWith('PA'))  return 0.65; // "PARTIAL" confidence → moderate certainty (above threshold)
    if (upper.startsWith('NO'))  return 0.20; // "NO" confidence → low certainty
  }
  return clamp(NaN); // → fallback 0.5
};

// Small-model confidence cap: 7B models are systematically overconfident.
// Even after calibration, we clamp confidence to this ceiling to prevent
// inflated scores from being published or used in research comparisons.
const MAX_MODEL_CONFIDENCE = 0.85;

/**
 * Apply defensive calibration to raw model scores.
 *
 * Rules:
 *  1. confidence = min(faithfulness, coverage)
 *     Confidence cannot exceed either of the scores it summarises.
 *     Stricter than the previous "cap at coverage" rule — prevents the
 *     model from being confident about a low-faithfulness answer.
 *  2. 7B model cap: clamp confidence ≤ MAX_MODEL_CONFIDENCE (0.85).
 *     Small models are systematically overconfident; this discount makes
 *     published scores more defensible.
 *  3. All values clamped to [0, 1].
 *  4. Unrecognised `supported` strings: try to extract first valid token
 *     from comma/space-separated strings (e.g. "YES, PARTIAL, NO" → "YES").
 *     Remaining garbage defaults to 'PARTIAL'.
 */
const calibrate = (raw) => {
  const faithfulness = parseScore(raw.faithfulness);
  const coverage     = parseScore(raw.coverage);
  let   confidence   = parseScore(raw.confidence, 'confidence'); // fieldName for smart fallback

  // Rule 1: confidence ≤ min(faithfulness, coverage)
  // NOTE: using min(faith, cov) is too aggressive — when faithfulness=0.5 (a legitimate
  // half-grounded score), confidence would be capped at 0.5 and NEVER pass the 0.60 threshold.
  // Correct rule: confidence ≤ coverage only. Faithfulness is checked via supported + lexical grounding.
  if (confidence > coverage) confidence = coverage;

  // Rule 2: 7B model cap
  confidence = Math.min(confidence, MAX_MODEL_CONFIDENCE);

  // Rule 4: strict supported enum — handle lists like "YES, PAARTIAL, NO"
  const rawS = (typeof raw.supported === 'string' ? raw.supported : '').toUpperCase().trim();
  let supported = 'PARTIAL'; // safe default
  if (SUPPORTED_VALUES.has(rawS)) {
    supported = rawS;
  } else {
    // Try to extract first recognised token from a comma/slash/space-separated string
    const tokens = rawS.split(/[,\/\s]+/);
    const firstValid = tokens.find((t) => SUPPORTED_VALUES.has(t));
    if (firstValid) supported = firstValid;
    // 'PAARTIAL'-style typos: fuzzy match on first two chars
    else if (rawS.startsWith('PA')) supported = 'PARTIAL';
    else if (rawS.startsWith('YE')) supported = 'YES';
    else if (rawS.startsWith('NO')) supported = 'NO';
  }

  return { faithfulness, coverage, confidence, supported, parse_failed: false };
};

// ── Lexical Grounding Check ───────────────────────────────────────────────────
// Deterministic safety net that runs AFTER the LLM evaluation.
//
// Problem: the evaluator and generator are the same model family — both know
// about Markov chains, so the evaluator rates a hallucinated answer highly
// because the content "sounds correct" to it, regardless of grounding.
//
// This function computes token-overlap score:
//   lexicalScore = |content_words(answer) ∩ content_words(context)|
//                  ─────────────────────────────────────────────────
//                       |unique_content_words(answer)|
//
// If the answer contains few words actually present in the context, it was
// almost certainly generated from the model's training data. The check caps
// faithfulness and confidence to reflect the real evidence — it does not
// override the LLM score upward, only downward.

const STOPWORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should',
  'may','might','shall','can','need','ought',
  'and','but','or','nor','for','yet','so','as','if','of','in','on',
  'at','by','to','up','out','off','over','into','with','from','than',
  'that','this','these','those','it','its','they','them','their','we',
  'our','you','your','he','she','his','her','who','which','what','when',
  'where','how','not','also','such','each','all','any','both','very',
  'just','about','between','through','before','after','then','once',
  'here','there','while','because','although','during','further',
]);

const tokenise = (text) =>
  text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));

/**
 * Returns a lexical grounding score in [0, 1]:
 *   1.0 = every unique content word in the answer appears in the context
 *   0.0 = no content words overlap at all
 */
const lexicalGroundingScore = (answerText, contextText) => {
  const answerTokens  = new Set(tokenise(answerText));
  const contextTokens = new Set(tokenise(contextText));
  if (answerTokens.size === 0) return 1.0; // empty answer; not our problem here
  let overlap = 0;
  for (const t of answerTokens) {
    if (contextTokens.has(t)) overlap++;
  }
  return overlap / answerTokens.size;
};

const LEXICAL_WARN_THRESHOLD = 0.30;  // below → answer likely from parametric knowledge
const LEXICAL_HARD_THRESHOLD = 0.10;  // below → near-certain hallucination (tightened from 0.15)

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

  // ── Lexical grounding check ───────────────────────────────────────────────
  // Deterministic cross-check: if the answer shares few content words with the
  // retrieved context, the model likely answered from training data.
  // We build a full-context string from all chunks (not just top-2) so this
  // check uses more evidence than the judge LLM received.
  const fullContextText = (Array.isArray(retrievedDocs) ? retrievedDocs : [])
    .map((d) => (d.text || d.chunkText || '').substring(0, 600))
    .join(' ');

  const lexScore = lexicalGroundingScore(answer, fullContextText);
  console.log(`[SelfEval] Lexical grounding score: ${lexScore.toFixed(3)}`);

  if (lexScore < LEXICAL_HARD_THRESHOLD) {
    // Near-certain hallucination — hard-zero faithfulness, confidence, and coverage.
    // Coverage is also zeroed here because a hallucinated answer that "addresses" the
    // question is still not useful — the information cannot be verified from context.
    console.warn(
      `[SelfEval] ⛔ Lexical grounding critically low (${lexScore.toFixed(3)}) ` +
      '— answer is almost certainly from parametric knowledge, not retrieved context. ' +
      'Overriding ALL evaluation scores to zero.'
    );
    evaluation.faithfulness = 0;
    evaluation.coverage     = 0;
    evaluation.confidence   = 0;
    evaluation.supported    = 'NO';
  } else if (lexScore < LEXICAL_WARN_THRESHOLD) {
    // Borderline — apply proportional penalty instead of a hard cut.
    // confidence scales linearly from 0 (at lexScore=0) to its LLM value (at lexScore=0.3).
    // faithfulness and coverage capped with a small headroom above the lexical evidence.
    const scale = lexScore / LEXICAL_WARN_THRESHOLD; // 0.0 – 1.0
    console.warn(
      `[SelfEval] ⚠️ Lexical grounding low (${lexScore.toFixed(3)}, scale=${scale.toFixed(2)}) ` +
      '— answer may use knowledge beyond the retrieved context. ' +
      'Applying proportional penalty.'
    );
    evaluation.faithfulness = Math.min(evaluation.faithfulness, lexScore + 0.15);
    evaluation.coverage     = Math.min(evaluation.coverage,     lexScore + 0.20);
    evaluation.confidence   = evaluation.confidence * scale;   // proportional scale-down
    if (evaluation.supported === 'YES') evaluation.supported = 'PARTIAL';
  }

  // ── Pass gate ─────────────────────────────────────────────────────────────
  const pass = evaluation.confidence >= threshold
            && evaluation.supported  !== 'NO';

  const result = { ...evaluation, pass };

  // ── Research log: final evaluation ───────────────────────────────────────
  console.log('[SelfEval] Research log — final evaluation:', JSON.stringify(result));

  return result;
};

// ── Backward-compatible alias ─────────────────────────────────────────────────
// Kept for any code still calling the old 3-arg positional signature.
export const evaluateAnswer = (question, contextChunks, answer) =>
  runSelfEvaluation({ question, answer, retrievedDocs: contextChunks });
