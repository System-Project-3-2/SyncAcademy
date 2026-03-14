import express from "express";
import {
  semanticSearch,
  getSearchHistory,
  clearSearchHistory,
  getSearchSuggestions,
} from "../controllers/searchController.js";
import { protect } from "../middleware/authMiddleware.js";
import { cacheGet } from "../middleware/cacheMiddleware.js";

const router = express.Router();

router.use(protect);

// Semantic search
router.post("/", semanticSearch);

// Search history
router.get("/history", cacheGet({ ttl: 30 }), getSearchHistory);
router.delete("/history", clearSearchHistory);

// Autocomplete suggestions
router.get("/suggestions", cacheGet({ ttl: 30 }), getSearchSuggestions);

export default router;
