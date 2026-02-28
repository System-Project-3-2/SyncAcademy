/**
 * Query Analyzer
 *
 * Classifies incoming user queries with zero LLM overhead (pure heuristics).
 * Feeds directly into the Adaptive Retrieval Controller to choose the right
 * retrieval strategy before a single DB call is made.
 *
 * Outputs:
 *   queryType        : 'factual' | 'conceptual' | 'procedural' | 'comparative' | 'ambiguous'
 *   complexity       : 'simple' | 'moderate' | 'complex'
 *   initialConfidence: number 0–1  (rough pre-retrieval confidence estimate)
 *   expandedQueries  : string[]    (original + sub-queries for multi-hop retrieval)
 */

// ── Pattern Library ───────────────────────────────────────────────────────────

const FACTUAL_PATTERNS     = /^(what is|what are|who is|define|definition of|when did|where is|name the|list the)\b/i;
const PROCEDURAL_PATTERNS  = /^(how (do|does|can|to|would)|steps (to|for)|process of|explain how|describe how|procedure for)\b/i;
const COMPARATIVE_PATTERNS = /\b(compare|comparison|difference|differences|vs\.?|versus|contrast|better than|worse than|advantages|disadvantages|pros and cons)\b/i;
const MULTI_PART_PATTERNS  = /\b(and|also|as well as|both|all of|along with|furthermore)\b/i;
const CAUSAL_PATTERNS      = /\b(why|reason|cause|effect|impact|result in|leads to|because)\b/i;

// ── Complexity Scoring ────────────────────────────────────────────────────────

/**
 * Scores a query's complexity on three signals:
 * - Word count  (longer → more complex)
 * - Pattern matches (multi-part, comparative, causal → complex)
 * - Clause count  (commas / semicolons suggest compound questions)
 */
const scoreComplexity = (query) => {
  const wordCount  = query.split(/\s+/).length;
  const clauseCount = (query.match(/[,;]/g) || []).length;

  let score = 0;
  if (wordCount > 20)                       score += 2;
  else if (wordCount > 10)                  score += 1;
  if (clauseCount >= 2)                     score += 1;
  if (COMPARATIVE_PATTERNS.test(query))     score += 2;
  if (MULTI_PART_PATTERNS.test(query))      score += 1;
  if (CAUSAL_PATTERNS.test(query))          score += 1;

  if (score >= 4) return 'complex';
  if (score >= 2) return 'moderate';
  return 'simple';
};

// ── Sub-Query Expansion ───────────────────────────────────────────────────────

/**
 * Generates focused sub-queries from a complex question.
 * Keeps the original query plus targeted angle queries.
 * No LLM call — pattern-based decomposition.
 */
const generateSubQueries = (query, queryType, complexity) => {
  if (complexity === 'simple') return [query];

  const subQueries = [query]; // always keep the original

  if (queryType === 'comparative') {
    // "Compare X and Y" → also retrieve standalone X and Y
    const conjunctionPattern = /\s+(?:vs\.?|versus|and|compared to|contrast with)\s+/i;
    const parts = query
      .replace(/^(compare|contrast|difference between|differences between)\s+/i, '')
      .split(conjunctionPattern);

    if (parts.length === 2) {
      const cleanA = parts[0].trim();
      const cleanB = parts[1].replace(/[?.!]$/,'').trim();
      if (cleanA.split(/\s+/).length <= 8) subQueries.push(cleanA);
      if (cleanB.split(/\s+/).length <= 8) subQueries.push(cleanB);
    }
  }

  if (queryType === 'procedural' && complexity === 'complex') {
    // "How to implement X in context Y" → also search just "X"
    const stripped = query
      .replace(/^how (do|does|can|to|would)\s+/i, '')
      .replace(/[?.!]$/, '')
      .trim();
    if (stripped.length > 0 && stripped !== query) subQueries.push(stripped);
  }

  if (queryType === 'causal') {
    // "Why does X happen" → also search "X mechanism" / "X explanation"
    const stripped = query
      .replace(/^why (does|do|is|are|did|would)\s+/i, '')
      .replace(/[?.!]$/, '')
      .trim();
    if (stripped.length > 0) subQueries.push(`${stripped} explanation`);
  }

  // For multi-part complex queries, try splitting on "and" at the clause level
  if (MULTI_PART_PATTERNS.test(query) && complexity === 'complex') {
    const halves = query.split(/\s+and\s+/i);
    if (halves.length === 2) {
      halves.forEach((h) => {
        const clean = h.replace(/[?.!]$/, '').trim();
        if (clean.split(/\s+/).length >= 3) subQueries.push(clean);
      });
    }
  }

  return [...new Set(subQueries)]; // remove duplicates
};

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Analyze an incoming user query.
 *
 * @param   {string} query
 * @returns {{
 *   queryType:         string,
 *   complexity:        string,
 *   initialConfidence: number,
 *   expandedQueries:   string[]
 * }}
 */
export const analyzeQuery = (query) => {
  const trimmed = query.trim();
  const wordCount = trimmed.split(/\s+/).length;

  // ── Query Type Classification ─────────────────────────────
  let queryType = 'conceptual'; // default bucket
  if (wordCount < 4)                             queryType = 'ambiguous';
  else if (FACTUAL_PATTERNS.test(trimmed))       queryType = 'factual';
  else if (PROCEDURAL_PATTERNS.test(trimmed))    queryType = 'procedural';
  else if (COMPARATIVE_PATTERNS.test(trimmed))   queryType = 'comparative';
  else if (CAUSAL_PATTERNS.test(trimmed))        queryType = 'causal';

  // ── Complexity Estimation ─────────────────────────────────
  const complexity = scoreComplexity(trimmed);

  // ── Initial Confidence Prediction ─────────────────────────
  // Before any retrieval, estimate how likely we are to find good context.
  // Factual + simple → high confidence; ambiguous or complex → lower.
  let initialConfidence = 0.70;
  if (queryType === 'ambiguous')  initialConfidence -= 0.30;
  if (queryType === 'factual')    initialConfidence += 0.10;
  if (queryType === 'comparative') initialConfidence -= 0.05;
  if (complexity === 'complex')   initialConfidence -= 0.10;
  if (complexity === 'simple')    initialConfidence += 0.05;
  initialConfidence = Math.min(1, Math.max(0.1, initialConfidence));

  // ── Query Expansion ───────────────────────────────────────
  const expandedQueries = generateSubQueries(trimmed, queryType, complexity);

  return {
    queryType,
    complexity,
    initialConfidence,
    expandedQueries,
  };
};
