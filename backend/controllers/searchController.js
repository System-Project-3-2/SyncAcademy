import MaterialChunk from "../models/materialChunkModel.js";
import Material from "../models/materialModel.js";
import SearchHistory from "../models/searchHistoryModel.js";
import { embedText } from "../services/embeddingServices.js";
import { cosineSimilarity } from "../utils/cosineSimilarity.js";

export const semanticSearch = async (req, res) => {
  try {
    const { query, courseNo, type } = req.body;

    if (!query) {
      return res.status(400).json({ message: "Query is required" });
    }

    const queryEmbedding = await embedText(query);

    // Build material filter
    const materialFilter = {};
    if (courseNo) materialFilter.courseNo = courseNo;
    if (type) materialFilter.type = type;

    // Fetch chunks with filtered materials
    const chunks = await MaterialChunk.find().populate({
      path: "materialId",
      match: materialFilter, //acts as where clause
    });

    // Remove unmatched materials
    const validChunks = chunks.filter((c) => c.materialId);

    const scored = validChunks.map((chunk) => ({
      materialId: chunk.materialId._id.toString(), //material ID as string
      courseTitle: chunk.materialId.courseTitle,
      courseNo: chunk.materialId.courseNo,
      type: chunk.materialId.type,
      fileUrl: chunk.materialId.fileUrl,
      text: chunk.chunkText,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);

    // Group by material
    const grouped = {};
    for (const item of scored.slice(0, 30)) {
      if (!grouped[item.materialId]) {
        grouped[item.materialId] = {
          courseTitle: item.courseTitle,
          courseNo: item.courseNo,
          type: item.type,
          fileUrl: item.fileUrl,
          matches: [],
        };
      }
      grouped[item.materialId].matches.push(item.text);
    }

    const results = Object.values(grouped);

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

    // Search in material titles and course numbers
    const [titleMatches, courseMatches, recentSearches] = await Promise.all([
      Material.find({ courseTitle: regex })
        .select("courseTitle courseNo")
        .limit(5)
        .lean(),
      Material.find({ courseNo: regex })
        .select("courseTitle courseNo")
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
