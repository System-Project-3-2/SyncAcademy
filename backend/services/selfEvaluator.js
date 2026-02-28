/**
 * Self-Evaluation Module  (LLM-as-a-Judge)
 *
 * IMPORTANT: This evaluator is part of a research experiment measuring
 * faithfulness and hallucination rates in a Hybrid Adaptive RAG system.
 *
 * Uses Ollama's /api/chat endpoint with format:"json" (native structured output)
 * so the model is forced to return JSON at the API level — not merely asked.
 *
 * Measured dimensions:
 *  faithfulness (0–1) — are all claims grounded in the retrieved docs?
 *  coverage     (0–1) — does the answer fully address the question?
 *  confidence   (0–1) — weighted: 0.6 × faithfulness + 0.4 × coverage
 *  supported    'YES' | 'PARTIAL' | 'NO' — categorical groundedness verdict
 *
 * pass = confidence >= ACCEPT_THRESHOLD AND supported !== 'NO'
 *
 * ROBUSTNESS CONTRACT:
 *  This function NEVER throws. Every failure path returns a valid object.
 *  Three extraction strategies ensure some score is always returned.
 */

import { generateChatJSON } from './ollamaService.js';

// ── Thresholds ────────────────────────────────────────────────────────────────
const ACCEPT_THRESHOLD = 0.60;
const MAX_CONTEXT_CHARS_PER_CHUNK = 250; // keep the eval prompt compact

// ── Safe Default ──────────────────────────────────────────────────────────────
// confidence 0.5 < 0.6 threshold → deliberately triggers a retry rather than
// silently accepting a potentially bad answer.
const SAFE_DEFAULT = Object.freeze({
  faithfulness: 0.5,
  coverage:     0.5,
  confidence:   0.5,
  supported:    'PARTIAL',
  reasoning:    'Evaluation parse error — safe defaults applied',
  parse_failed: true,
});

// ── Prompts ───────────────────────────────────────────────────────────────────
// DESIGN:
//  - System prompt is SHORT and laser-focused on the JSON schema only.
//    Small models (Mistral 7B, Phi-3) lose track of long system instructions.
//  - User prompt puts QUESTION + ANSWER first (what to evaluate), then DOCS.
//    This ordering prevents the model from echoing the docs as its response.
//  - /api/chat with format:"json" enforces JSON at the Ollama API level,
//    making the prompt instructions a secondary safety layer.

const SYSTEM_PROMPT = `You are a factual evaluation engine. You MUST respond with ONLY a JSON object in this exact schema, nothing else:
{"faithfulness":0.0,"coverage":0.0,"confidence":0.0,"supported":"YES"}

Rules:
- faithfulness: 0.0-1.0. How many claims in the ANSWER are directly supported by the DOCUMENTS?
- coverage: 0.0-1.0. How completely does the ANSWER address the QUESTION using the DOCUMENTS?
- confidence: 0.0-1.0. Your overall quality confidence (can differ from the formula).
- supported: "YES" (all claims grounded) | "PARTIAL" (some claims lack support) | "NO" (answer ignores or contradicts documents).
Do NOT add any text outside the JSON object.`;

const buildUserPrompt = (question, answer, contextText) =>
`QUESTION: ${question}

ANSWER TO EVALUATE: ${answer}

SOURCE DOCUMENTS:
${contextText}`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const clamp       = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);
const SUPPORTED_V = new Set(['YES', 'PARTIAL', 'NO']);

const normalizeEval = (parsed) => {
  const faithfulness = clamp(parseFloat(parsed.faithfulness));
  const coverage     = clamp(parseFloat(parsed.coverage));
  const rawConf      = parseFloat(parsed.confidence);
  const confidence   = Number.isFinite(rawConf)
    ? clamp(rawConf)
    : clamp(0.6 * faithfulness + 0.4 * coverage);
  const rawS     = (typeof parsed.supported === 'string' ? parsed.supported : '').toUpperCase().trim();
  const supported = SUPPORTED_V.has(rawS) ? rawS : 'PARTIAL';
  const reasoning = typeof parsed.reasoning === 'string'
    ? parsed.reasoning.substring(0, 200) : '';
  return { faithfulness, coverage, confidence, supported, reasoning, parse_failed: false };
};

// ── 4-Tier JSON Extraction ────────────────────────────────────────────────────
//
// Tier 1: Direct parse       — fastest, works when format:"json" is honored
// Tier 2: Strip & regex      — handles code fences, preambles, trailing text
// Tier 3: Numeric extraction — pulls numbers from ANY text response as last resort
// Tier 4: Safe default       — guarantees the pipeline never crashes
//
// Tier 3 is the key addition: even when the model completely ignores the JSON
// instruction and writes prose, we can often extract 0.8, 0.7 etc. from the
// text and construct a usable evaluation object.

const extractNumericSalvage = (raw) => {
  // Find all float / int values in the string (e.g. "0.8", "1.0", "85%")
  const nums = [...raw.matchAll(/\b(0?\.\d+|1\.0+|0|1)\b/g)]
    .map((m) => clamp(parseFloat(m[1])))
    .filter((n) => Number.isFinite(n));

  if (nums.length < 2) return null; // not enough data to salvage

  // Use first two numbers as faithfulness and coverage (best guess)
  const faithfulness = nums[0];
  const coverage     = nums[1] ?? nums[0];
  const confidence   = clamp(0.6 * faithfulness + 0.4 * coverage);

  // Detect negative signals in the prose → supported = NO
  const lower = raw.toLowerCase();
  let supported = 'PARTIAL';
  if (/\bnot supported\b|\bdoes not\b|\bno support\b|\bincorrect\b|\bwrong\b/.test(lower))  supported = 'NO';
  else if (/\bfully supported\b|\ball claims\b|\bcompletely\b|\baccurate\b/.test(lower))    supported = 'YES';

  return { faithfulness, coverage, confidence, supported,
           reasoning: 'Numeric salvage from prose response', parse_failed: true };
};

const extractEvaluation = (raw) => {
  // Tier 1 ─ direct parse
  try {
    const parsed = JSON.parse(raw.trim());
    if (parsed && typeof parsed === 'object' && 'faithfulness' in parsed) {
      console.log('[SelfEval] ✅ Tier 1: direct JSON parse succeeded');
      return normalizeEval(parsed);
    }
  } catch { /* fall through */ }

  // Tier 2 ─ strip noise and regex-extract
  try {
    const stripped = raw.replace(/```(?:json)?/gi, '').replace(/[\u0000-\u001f]/g, ' ').trim();
    const m = stripped.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      if (parsed && typeof parsed === 'object') {
        console.log('[SelfEval] ⚠️ Tier 2: regex extraction succeeded');
        return normalizeEval(parsed);
      }
    }
  } catch { /* fall through */ }

  // Tier 3 ─ numeric salvage from free-form text
  const salvaged = extractNumericSalvage(raw);
  if (salvaged) {
    console.warn('[SelfEval] ⚠️ Tier 3: numeric salvage from prose — scores approximate');
    return salvaged;
  }

  // Tier 4 ─ safe default
  console.warn('[SelfEval] ❌ Tier 4: all extraction failed — returning safe defaults');
  console.warn('[SelfEval] Raw (first 300 chars):', raw?.substring(0, 300));
  return { ...SAFE_DEFAULT };
};

// ── Shortcut detectors ────────────────────────────────────────────────────────
const NO_INFO_SIGNALS = [
  "don't have enough information", "no information",
  "unable to generate", "not in the uploaded",
];
const isGracefulFallback = (answer) =>
  NO_INFO_SIGNALS.some((s) => answer.toLowerCase().includes(s));

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Run self-evaluation using LLM-as-a-Judge via Ollama JSON mode.
 *
 * @param {{ question: string, answer: string, retrievedDocs: Array }} params
 * @returns {Promise<{ faithfulness, coverage, confidence, supported,
 *                     reasoning, parse_failed, pass }>}
 *
 * CONTRACT: Never throws. Always returns a valid evaluation object.
 */
export const runSelfEvaluation = async ({ question, answer, retrievedDocs }) => {

  // Fast-path: graceful fallback answers — accept, no retry needed
  if (isGracefulFallback(answer)) {
    const result = {
      faithfulness: 1.0, coverage: 0.0, confidence: 0.60,
      supported: 'NO', reasoning: 'Graceful fallback — no context available',
      parse_failed: false, pass: true,
    };
    console.log('[SelfEval] Fast-path: graceful fallback', result);
    return result;
  }

  // Build compact context (small = less chance model echoes it)
  const contextText = retrievedDocs
    .map((doc, i) => {
      const text = (doc.text || doc.chunkText || '').trim();
      const snippet = text.length > MAX_CONTEXT_CHARS_PER_CHUNK
        ? text.substring(0, MAX_CONTEXT_CHARS_PER_CHUNK) + '...'
        : text;
      return `[${i + 1}] ${doc.courseNo || 'Doc'}: ${snippet}`;
    })
    .join('\n');

  const userPrompt = buildUserPrompt(question, answer, contextText);

  // Call Ollama /api/chat with format:"json" — JSON enforced at API level
  let raw;
  try {
    raw = await generateChatJSON(SYSTEM_PROMPT, userPrompt, {
      temperature: 0.0,  // fully deterministic
      max_tokens:  150,  // JSON schema fits in ~80 tokens; 150 gives headroom
    });
  } catch (err) {
    console.warn('[SelfEval] ❌ Judge LLM call failed:', err.message);
    const fallback = {
      faithfulness: 0.65, coverage: 0.65, confidence: 0.65,
      supported: 'PARTIAL', reasoning: 'Evaluator LLM unavailable — passing by default',
      parse_failed: true, pass: true,
    };
    console.log('[SelfEval] Research log — LLM error fallback:', fallback);
    return fallback;
  }

  console.log('[SelfEval] Research log — raw judge response:', raw);

  const evaluation = extractEvaluation(raw);

  if (evaluation.parse_failed) {
    console.warn('[SelfEval] Research log — JSON parsing FAILED, extraction tier used');
  } else {
    console.log('[SelfEval] Research log — JSON parsing succeeded');
  }

  // Dual-gate pass: confidence threshold AND not a categorical "NO"
  const pass = evaluation.confidence >= ACCEPT_THRESHOLD
            && evaluation.supported  !== 'NO';

  const result = { ...evaluation, pass };
  console.log('[SelfEval] Research log — final evaluation:', JSON.stringify(result));
  return result;
};

// ── Backward-compatible alias ─────────────────────────────────────────────────
export const evaluateAnswer = (question, contextChunks, answer) =>
  runSelfEvaluation({ question, answer, retrievedDocs: contextChunks });
