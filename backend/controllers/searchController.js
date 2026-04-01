import MaterialChunk from "../models/materialChunkModel.js";
import Material from "../models/materialModel.js";
import Enrollment from "../models/enrollmentModel.js";
import SearchHistory from "../models/searchHistoryModel.js";
import { embedText } from "../services/embeddingServices.js";
import { cosineSimilarity } from "../utils/cosineSimilarity.js";

// ==================== Search Configuration ====================
const SEARCH_CONFIG = {
  MIN_QUERY_LENGTH: 3,            // Minimum characters for a valid query
  MIN_SIMILARITY_THRESHOLD: Number(process.env.SEARCH_MIN_SIMILARITY_THRESHOLD || 0.4),
  MIN_HYBRID_SCORE_THRESHOLD: Number(process.env.SEARCH_MIN_HYBRID_THRESHOLD || 0.42),
  MIN_TOKEN_OVERLAP_RATIO: Number(process.env.SEARCH_MIN_TOKEN_OVERLAP_RATIO || 0.08),
  MIN_SHORT_QUERY_TOKEN_OVERLAP_RATIO: Number(process.env.SEARCH_MIN_SHORT_QUERY_TOKEN_OVERLAP_RATIO || 0.34),
  SHORT_QUERY_TOKEN_LIMIT: Number(process.env.SEARCH_SHORT_QUERY_TOKEN_LIMIT || 3),
  MIN_MEANINGFUL_WORDS: 2,
  MAX_NON_ALNUM_RATIO: 0.45,
  MIN_TOP_SCORE_FOR_VALID_RESULTS: Number(process.env.SEARCH_MIN_TOP_SCORE || 0.45),
  MAX_CHUNKS_TO_CONSIDER: 50,     // Top N scored chunks to consider before grouping
  MAX_MATCHES_PER_MATERIAL: 5,    // Max matched text snippets per material
  MAX_RESULTS: 20,                // Max materials in final results
};

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "was", "were", "what", "when", "where", "which", "with", "why", "your", "you",
]);

const tokenize = (text) => {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
};

const calculateTokenOverlapRatio = (queryTokens, text) => {
  if (!queryTokens.length || !text) return 0;
  const querySet = new Set(queryTokens);
  const textSet = new Set(tokenize(text));
  if (!textSet.size) return 0;

  let overlapCount = 0;
  for (const token of querySet) {
    if (textSet.has(token)) overlapCount += 1;
  }
  return overlapCount / querySet.size;
};

/**
 * Validate search query quality
 * Returns { valid: boolean, message?: string }
 */
const validateQuery = (query) => {
  const trimmed = query.trim();

  if (trimmed.length < SEARCH_CONFIG.MIN_QUERY_LENGTH) {
    return {
      valid: false,
      message: `Search query must be at least ${SEARCH_CONFIG.MIN_QUERY_LENGTH} characters long`,
    };
  }

  const words = trimmed.split(/\s+/).filter((w) => /[a-zA-Z]{2,}/.test(w));
  if (words.length < SEARCH_CONFIG.MIN_MEANINGFUL_WORDS) {
    return {
      valid: false,
      message: "Please enter a meaningful query with at least two real words",
    };
  }

  const nonAlnumChars = (trimmed.match(/[^a-zA-Z0-9\s]/g) || []).length;
  const nonAlnumRatio = trimmed.length ? nonAlnumChars / trimmed.length : 1;
  if (nonAlnumRatio > SEARCH_CONFIG.MAX_NON_ALNUM_RATIO) {
    return {
      valid: false,
      message: "Query appears invalid. Please use meaningful words related to your course materials.",
    };
  }

  const uniqueAlphaNum = new Set(trimmed.toLowerCase().replace(/[^a-z0-9]/g, "")).size;
  if (uniqueAlphaNum <= 2) {
    return {
      valid: false,
      message: "Query appears repetitive or nonsensical. Try a clearer question or topic.",
    };
  }

  return { valid: true };
};

export const semanticSearch = async (req, res) => {
  try {
    const { query, courseNo, type } = req.body;

    if (!query) {
      return res.status(400).json({ message: "Query is required" });
    }

    // Validate query quality
    const validation = validateQuery(query);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const normalizedQuery = query.trim();
    const queryEmbedding = await embedText(normalizedQuery);
    const queryTokens = tokenize(normalizedQuery);

    // Build material filter
    const materialFilter = {};
    if (courseNo) materialFilter.courseNo = courseNo;
    if (type) materialFilter.type = type;

    // Students only search through enrolled courses
    if (req.user.role === "student") {
      const enrollments = await Enrollment.find({
        student: req.user._id,
        status: "active",
      }).populate("course", "courseNo");
      const enrolledCourseNos = enrollments
        .filter((e) => e.course)
        .map((e) => e.course.courseNo);
      materialFilter.courseNo = courseNo
        ? (enrolledCourseNos.includes(courseNo) ? courseNo : "__none__")
        : { $in: enrolledCourseNos };
    }

    // Fetch chunks with filtered materials
    const chunks = await MaterialChunk.find().populate({
      path: "materialId",
      match: materialFilter, //acts as where clause
    });

    // Remove unmatched materials
    const validChunks = chunks.filter((c) => c.materialId);

    const scored = validChunks.map((chunk) => {
      const semanticScore = cosineSimilarity(queryEmbedding, chunk.embedding);
      const lexicalSignal = calculateTokenOverlapRatio(
        queryTokens,
        `${chunk.materialId.title || ""} ${chunk.materialId.courseTitle || ""} ${chunk.chunkText || ""}`
      );
      const hybridScore = semanticScore * 0.8 + lexicalSignal * 0.2;

      return {
        materialId: chunk.materialId._id.toString(),
        title: chunk.materialId.title,
        courseTitle: chunk.materialId.courseTitle,
        courseNo: chunk.materialId.courseNo,
        type: chunk.materialId.type,
        fileUrl: chunk.materialId.fileUrl,
        originalFileName: chunk.materialId.originalFileName,
        text: chunk.chunkText,
        score: semanticScore,
        lexicalSignal,
        hybridScore,
      };
    });

    const isShortQuery = queryTokens.length <= SEARCH_CONFIG.SHORT_QUERY_TOKEN_LIMIT;

    // Hybrid confidence gate:
    // - short queries must have explicit lexical anchor (prevents off-topic semantic drift)
    // - longer queries use hybrid confidence with lexical signal
    const relevantScored = scored.filter(
      (item) => {
        if (item.score < SEARCH_CONFIG.MIN_SIMILARITY_THRESHOLD) {
          return false;
        }

        if (isShortQuery) {
          return item.lexicalSignal >= SEARCH_CONFIG.MIN_SHORT_QUERY_TOKEN_OVERLAP_RATIO;
        }

        return (
          item.hybridScore >= SEARCH_CONFIG.MIN_HYBRID_SCORE_THRESHOLD &&
          item.lexicalSignal >= SEARCH_CONFIG.MIN_TOKEN_OVERLAP_RATIO
        );
      }
    );

    // Sort by score descending
    relevantScored.sort((a, b) => b.score - a.score);

    // If the best candidate confidence is too weak, treat as out-of-domain/noise.
    if (!relevantScored.length || relevantScored[0].score < SEARCH_CONFIG.MIN_TOP_SCORE_FOR_VALID_RESULTS) {
      return res.json([]);
    }

    // Take top N chunks for grouping
    const topChunks = relevantScored.slice(0, SEARCH_CONFIG.MAX_CHUNKS_TO_CONSIDER);

    // Group by material
    const grouped = {};
    for (const item of topChunks) {
      if (!grouped[item.materialId]) {
        grouped[item.materialId] = {
          materialId: item.materialId,
          title: item.title || item.courseTitle,
          courseTitle: item.courseTitle,
          courseNo: item.courseNo,
          course: item.courseNo,
          type: item.type,
          fileUrl: item.fileUrl,
          originalFileName: item.originalFileName,
          relevanceScore: item.score,
          matches: [],
        };
      } else {
        // Keep the best (max) similarity score
        if (item.score > grouped[item.materialId].relevanceScore) {
          grouped[item.materialId].relevanceScore = item.score;
        }
      }
      // Limit matches per material to avoid overloading
      if (grouped[item.materialId].matches.length < SEARCH_CONFIG.MAX_MATCHES_PER_MATERIAL) {
        grouped[item.materialId].matches.push(item.text);
      }
    }

    // Sort results by relevance score and limit
    const results = Object.values(grouped)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, SEARCH_CONFIG.MAX_RESULTS);

    // Save search to history (non-blocking, best-effort)
    try {
      const historyEntry = {
        user: req.user._id,
        query,
        resultsCount: results.length,
      };
      // Only include filters if values exist
      const filters = {};
      if (courseNo) filters.courseNo = courseNo;
      if (type) filters.type = type;
      if (Object.keys(filters).length > 0) historyEntry.filters = filters;

      await SearchHistory.create(historyEntry);
    } catch (historyError) {
      console.warn("[INFO] Search history save skipped:", historyError.message);
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get search history for the current user
 * @route GET /api/search/history
 */
export const getSearchHistory = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const history = await SearchHistory.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select("query filters resultsCount createdAt");

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete search history
 * @route DELETE /api/search/history
 */
export const clearSearchHistory = async (req, res) => {
  try {
    await SearchHistory.deleteMany({ user: req.user._id });
    res.json({ message: "Search history cleared" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get autocomplete suggestions based on existing materials
 * @route GET /api/search/suggestions
 */
export const getSearchSuggestions = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const regex = new RegExp(q, "i");

    // Search in material titles, course titles, and course numbers
    const [titleMatches, courseMatches, materialTitleMatches, recentSearches] = await Promise.all([
      Material.find({ courseTitle: regex })
        .select("title courseTitle courseNo")
        .limit(5)
        .lean(),
      Material.find({ courseNo: regex })
        .select("title courseTitle courseNo")
        .limit(5)
        .lean(),
      Material.find({ title: regex })
        .select("title courseTitle courseNo")
        .limit(5)
        .lean(),
      SearchHistory.find({ user: req.user._id, query: regex })
        .sort({ createdAt: -1 })
        .limit(3)
        .select("query")
        .lean(),
    ]);

    // Deduplicate and format suggestions
    const suggestions = [];
    const seen = new Set();

    recentSearches.forEach((s) => {
      if (!seen.has(s.query.toLowerCase())) {
        seen.add(s.query.toLowerCase());
        suggestions.push({ text: s.query, type: "history" });
      }
    });

    titleMatches.forEach((m) => {
      if (!seen.has(m.courseTitle.toLowerCase())) {
        seen.add(m.courseTitle.toLowerCase());
        suggestions.push({ text: m.courseTitle, type: "material", courseNo: m.courseNo });
      }
    });

    materialTitleMatches.forEach((m) => {
      if (m.title && !seen.has(m.title.toLowerCase())) {
        seen.add(m.title.toLowerCase());
        suggestions.push({ text: m.title, type: "material", courseNo: m.courseNo });
      }
    });

    courseMatches.forEach((m) => {
      const key = `${m.courseNo} - ${m.courseTitle}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({ text: `${m.courseNo} - ${m.courseTitle}`, type: "course" });
      }
    });

    res.json(suggestions.slice(0, 10));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
