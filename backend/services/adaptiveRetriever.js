/**
 * Adaptive Retrieval Controller
 *
 * Maps query analysis output (type + complexity) to the right retrieval
 * parameters, then executes multi-query retrieval with deduplication.
 *
 * Key ideas:
 *  - "Simple" queries → tight threshold, small top-K  (precision > recall)
 *  - "Complex" queries → relaxed threshold, large top-K (recall > precision)
 *  - Multi-query expansion → embed ALL sub-queries, merge results by best score
 */

import MaterialChunk from '../models/materialChunkModel.js';
import { embedText }  from './embeddingServices.js';
import { cosineSimilarity } from '../utils/cosineSimilarity.js';

// ── Retrieval Config Table ─────────────────────────────────────────────────────
// Each complexity level maps to a different operating point on the
// precision/recall trade-off curve.
//
//  topK              – max chunks passed to LLM   (more = richer context, longer prompt)
//  threshold         – minimum similarity to keep a chunk
//  noContextThreshold– if best score < this, abort (no relevant material at all)
//
const RETRIEVAL_CONFIG = {
  simple:   { topK: 3, threshold: 0.50, noContextThreshold: 0.42 },
  moderate: { topK: 5, threshold: 0.42, noContextThreshold: 0.36 },
  complex:  { topK: 8, threshold: 0.35, noContextThreshold: 0.30 },
};

const loadCandidateChunks = async (filters = {}) => {
  const materialFilter = {};
  if (filters.courseNo) materialFilter.courseNo = filters.courseNo;
  if (filters.type) materialFilter.type = filters.type;

  const chunks = await MaterialChunk.find()
    .populate({
      path: 'materialId',
      match: Object.keys(materialFilter).length > 0 ? materialFilter : undefined,
      select: 'courseTitle courseNo type fileUrl',
    })
    .select('materialId chunkText embedding')
    .lean();

  return chunks.filter((c) => c.materialId);
};

// ── Low-Level Retriever ────────────────────────────────────────────────────────

/**
 * Score all candidate chunks against one embeddings vector.
 * Applies optional material-level filters (courseNo, type).
 *
 * @param   {number[]} queryEmbedding
 * @param   {object}   filters         - optional {courseNo, type}
 * @returns {Array}    scored chunk objects, unsorted
 */
const scoreAllChunks = (queryEmbedding, candidates) => {
  return candidates.map((chunk) => ({
    materialId: chunk.materialId._id.toString(),
    courseTitle: chunk.materialId.courseTitle,
    courseNo: chunk.materialId.courseNo,
    type: chunk.materialId.type,
    fileUrl: chunk.materialId.fileUrl,
    text: chunk.chunkText,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));
};

// ── Multi-Query Merge ──────────────────────────────────────────────────────────

/**
 * Merge scored-chunk arrays from multiple sub-queries.
 * Deduplication key = first 80 chars of chunk text.
 * Keeps the highest score if the same chunk appears in multiple query results.
 *
 * @param   {Array[]} scoredArrays - array-of-arrays from each sub-query
 * @returns {Array}   deduplicated, merged list
 */
const mergeAndDeduplicate = (scoredArrays) => {
  const chunkMap = new Map();

  for (const scored of scoredArrays) {
    for (const chunk of scored) {
      const key = chunk.text.substring(0, 80); // dedup fingerprint
      const existing = chunkMap.get(key);
      if (!existing || existing.score < chunk.score) {
        chunkMap.set(key, chunk);
      }
    }
  }

  return Array.from(chunkMap.values());
};

// ── Main Export ────────────────────────────────────────────────────────────────

/**
 * Adaptive Retrieve — the single entry point for all retrieval.
 *
 * 1. Looks up the config for the given complexity level.
 * 2. Embeds each sub-query in parallel (Promise.all).
 * 3. Scores all DB chunks against every embedding.
 * 4. Merges + deduplicates results across sub-queries.
 * 5. Applies threshold filter and top-K cap.
 *
 * @param   {string[]} queries    - Sub-queries from queryAnalyzer (len >= 1)
 * @param   {string}   complexity - 'simple' | 'moderate' | 'complex'
 * @param   {object}   filters    - optional {courseNo, type}
 * @returns {{
 *   topChunks : Array,    // final chunks passed to LLM
 *   bestScore : number,   // highest similarity score found (pre-threshold)
 *   config    : object    // the retrieval config that was used
 * }}
 */
export const adaptiveRetrieve = async (queries, complexity, filters = {}) => {
  const config = RETRIEVAL_CONFIG[complexity] ?? RETRIEVAL_CONFIG.moderate;
  const candidates = await loadCandidateChunks(filters);

  if (candidates.length === 0) {
    return { topChunks: [], bestScore: 0, config };
  }

  // Step 1 — embed all sub-queries concurrently
  const embeddings = await Promise.all(queries.map((q) => embedText(q)));

  // Step 2 — score chunks against each embedding concurrently
  //           Note: candidates are already loaded once from DB.
  const scoredArrays = await Promise.all(
    embeddings.map((emb) => scoreAllChunks(emb, candidates))
  );

  // Step 3 — merge and deduplicate across sub-queries
  const merged = mergeAndDeduplicate(scoredArrays);

  // Step 4 — sort descending by score
  merged.sort((a, b) => b.score - a.score);

  // Step 5 — record the best raw score (before any threshold filtering)
  const bestScore = merged.length > 0 ? merged[0].score : 0;

  // Step 6 — apply threshold + top-K cap
  const topChunks = merged
    .filter((c) => c.score >= config.threshold)
    .slice(0, config.topK);

  return { topChunks, bestScore, config };
};
