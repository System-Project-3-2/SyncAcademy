import express from "express";
import {
  semanticSearch,
  getSearchHistory,
  clearSearchHistory,
  getSearchSuggestions,
} from "../controllers/searchController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

// Semantic search
router.post("/", semanticSearch);

// Search history
router.get("/history", getSearchHistory);
router.delete("/history", clearSearchHistory);

// Autocomplete suggestions
router.get("/suggestions", getSearchSuggestions);

export default router;
