import MaterialChunk from "../models/materialChunkModel.js";
import Material from "../models/materialModel.js";
import Enrollment from "../models/enrollmentModel.js";
import SearchHistory from "../models/searchHistoryModel.js";
import { embedText } from "../services/embeddingServices.js";
import { cosineSimilarity } from "../utils/cosineSimilarity.js";
import { getRedis } from "../config/redis.js";

// ==================== Search Configuration ====================
const SEARCH_CONFIG = {
  MIN_QUERY_LENGTH: 3,            // Minimum characters for a valid query
  MIN_SIMILARITY_THRESHOLD: 0.35, // Minimum cosine similarity to include a result
  MAX_CHUNKS_TO_CONSIDER: 50,     // Top N scored chunks to consider before grouping
  MAX_MATCHES_PER_MATERIAL: 5,    // Max matched text snippets per material
  MAX_RESULTS: 20,                // Max materials in final results
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

  // Check for gibberish — query should contain at least one real word (2+ alpha chars)
  const words = trimmed.split(/\s+/).filter((w) => /[a-zA-Z]{2,}/.test(w));
  if (words.length === 0) {
    return {
      valid: false,
      message: "Please enter a meaningful search query with real words",
    };
  }

  return { valid: true };
};

export const semanticSearch = async (req, res) => {
  try {
    const { query, courseNo, type } = req.body;

    const redis = getRedis();
    const cacheTtl = Number(process.env.SEARCH_CACHE_TTL_SECONDS || 30);
    const cacheKey = `search:${req.user._id}:${(query || "").trim()}:${courseNo || "all"}:${type || "all"}`;
    if (process.env.ENABLE_API_CACHE === "true" && redis.status === "ready") {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }

    if (!query) {
      return res.status(400).json({ message: "Query is required" });
    }

    // Validate query quality
    const validation = validateQuery(query);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const queryEmbedding = await embedText(query.trim());

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

    const scored = validChunks.map((chunk) => ({
      materialId: chunk.materialId._id.toString(), //material ID as string
      title: chunk.materialId.title,
      courseTitle: chunk.materialId.courseTitle,
      courseNo: chunk.materialId.courseNo,
      type: chunk.materialId.type,
      fileUrl: chunk.materialId.fileUrl,
      originalFileName: chunk.materialId.originalFileName,
      text: chunk.chunkText,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    // Filter out chunks below the minimum similarity threshold
    const relevantScored = scored.filter(
      (item) => item.score >= SEARCH_CONFIG.MIN_SIMILARITY_THRESHOLD
    );

    // Sort by score descending
    relevantScored.sort((a, b) => b.score - a.score);

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

    if (process.env.ENABLE_API_CACHE === "true" && redis.status === "ready") {
      await redis.setex(cacheKey, cacheTtl, JSON.stringify(results));
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
