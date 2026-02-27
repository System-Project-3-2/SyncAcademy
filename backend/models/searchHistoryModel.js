import mongoose from "mongoose";

const searchHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    query: {
      type: String,
      required: true,
      trim: true,
    },
    filters: {
      courseNo: String,
      type: String,
    },
    resultsCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index for fast lookups
searchHistorySchema.index({ user: 1, createdAt: -1 });
searchHistorySchema.index({ query: 1 });

const SearchHistory = mongoose.model("SearchHistory", searchHistorySchema);

export default SearchHistory;
