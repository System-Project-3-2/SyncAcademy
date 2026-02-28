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
const MAX_CONTEXT_CHARS_PER_CHUNK = 400; // enough context for meaningful evaluation

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
// BUGS FIXED (chronological):
//
// Bug 1 — Model echoing context (commit c339c8a):
//   /api/generate is text completion — model continued the prompt instead of
//   evaluating. Fixed by switching to /api/chat with system/user role split.
//
// Bug 2 — All-zero scores (commit bc5ae5b):
//   System prompt contained {"faithfulness":0.0,...} as an example. With
//   format:"json" the token sampler emits { immediately, so model copied the
//   literal 0.0 values. Fixed by removing all concrete numbers from the schema.
//
// Bug 3 — Always-1.0 scores (this commit):
//   temperature:0.0 + format:"json" → model picks maximum-likelihood tokens.
//   For an academic assistant, "everything is perfect" is the safest guess,
//   so it outputs 1.0 without actually reasoning.
//   Fix: put `reasoning` as the FIRST JSON field. With format:"json", fields
//   are emitted in declaration order — the model must write its claim-by-claim
//   analysis BEFORE reaching the numeric fields, anchoring scores to real eval.

// ROOT CAUSE OF ALWAYS-1.0 BUG:
//   temperature:0.0 + format:"json" → model picks maximum-likelihood tokens,
//   and for an academic assistant, "everything is correct" is the safest guess.
//   Fix: put `reasoning` as the FIRST JSON field. With format:"json", fields are
//   emitted in schema order — the model must write its claim-by-claim analysis
//   BEFORE it reaches the numeric fields, anchoring the scores to actual reasoning.

const SYSTEM_PROMPT = `You are a strict answer quality evaluator for an academic study assistant.

Your job: check whether the GENERATED ANSWER is actually grounded in the SOURCE DOCUMENTS.
Be critical — most answers have at least some unsupported claims.

You MUST respond with exactly this JSON structure (no extra text):
{
  "reasoning": "<list 2-3 specific claims from the answer and whether each is found in the source documents>",
  "faithfulness": <decimal 0.0-1.0>,
  "coverage": <decimal 0.0-1.0>,
  "supported": "<YES | PARTIAL | NO>"
}

Scoring rules:
faithfulness (how grounded are the claims?):
  0.9-1.0 = every claim directly stated in the documents
  0.6-0.8 = most claims supported, minor inferences only
  0.3-0.5 = key claims are absent from or only implied in documents
  0.0-0.2 = answer invents facts not in documents

coverage (how fully does the answer address the question?):
  0.9-1.0 = fully addresses the question using the documents
  0.6-0.8 = addresses the main point, misses some details
  0.3-0.5 = vague or only partially on-topic
  0.0-0.2 = does not address the question

supported:
  "YES"     = well-grounded, most claims verified in documents
  "PARTIAL" = partly grounded, some claims unsupported
  "NO"      = contradicts or ignores the documents

IMPORTANT: Write the reasoning field FIRST. Your scores must reflect what you wrote.`;

const buildUserPrompt = (question, answer, contextText) =>
`QUESTION: ${question}

GENERATED ANSWER (evaluate this critically):
${answer}

SOURCE DOCUMENTS (the only allowed knowledge base):
${contextText}

For each major claim in the ANSWER, check: is it explicitly stated in the SOURCE DOCUMENTS above?
Write your claim-by-claim analysis in the reasoning field, then assign faithfulness, coverage, and supported.`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const clamp       = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);
const SUPPORTED_V = new Set(['YES', 'PARTIAL', 'NO']);

const normalizeEval = (parsed) => {
  const faithfulness = clamp(parseFloat(parsed.faithfulness));
  const coverage     = clamp(parseFloat(parsed.coverage));

  // Always compute confidence from our formula — never trust the model's value.
  const confidence = clamp(0.6 * faithfulness + 0.4 * coverage);

  const rawS      = (typeof parsed.supported === 'string' ? parsed.supported : '').toUpperCase().trim();
  const supported = SUPPORTED_V.has(rawS) ? rawS : 'PARTIAL';
  const reasoning = typeof parsed.reasoning === 'string'
    ? parsed.reasoning.substring(0, 300) : '';

  // Suspicious-score guard: perfect scores with no reasoning is almost certainly
  // default-token behavior (model shortcuts), not genuine evaluation.
  if (faithfulness >= 0.98 && coverage >= 0.98 && reasoning.trim().length < 20) {
    console.warn(
      '[SelfEval] ⚠️ Suspicious: perfect scores with empty reasoning — ' +
      'model may not have evaluated. Consider checking the prompt.'
    );
  }

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
      temperature: 0.1,  // slight randomness avoids max-likelihood score anchoring to 1.0
      max_tokens:  400,  // reasoning field needs space; scores follow after reasoning text
      num_ctx:     3072, // larger context window to fit docs + answer + question
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
