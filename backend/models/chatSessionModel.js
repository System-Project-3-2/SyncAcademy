import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  sources: [
    {
      courseTitle: String,
      courseNo: String,
      type: { type: String },
      fileUrl: String,
      relevance: Number,
    },
  ],
  // Hybrid RAG evaluation metadata — stored per assistant message
  ragMetadata: {
    queryType:     String,   // 'factual' | 'conceptual' | 'procedural' | 'comparative' | ...
    complexity:    String,   // 'simple' | 'moderate' | 'complex'
    attempt:       Number,   // how many retrieval attempts were needed
    bestScore:     Number,   // top cosine similarity score from retrieval
    confidence:    Number,   // self-eval combined confidence (0–1)
    faithfulness:  Number,   // faithfulness score (0–1)
    coverage:      Number,   // coverage score (0–1)
    supported:     String,   // 'YES' | 'PARTIAL' | 'NO' — categorical groundedness verdict
    evalReasoning: String,   // one-sentence justification from evaluator
    parseFailed:   Boolean,  // true if judge JSON extraction fell back to safe defaults
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const chatSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      default: "New Chat",
    },
    messages: [messageSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

chatSessionSchema.index({ user: 1, updatedAt: -1 });
chatSessionSchema.index({ user: 1, isActive: 1, updatedAt: -1 });

// Auto-generate title from first user message
chatSessionSchema.pre("save", async function () {
  if (this.isNew && this.messages.length > 0) {
    const firstMsg = this.messages.find((m) => m.role === "user");
    if (firstMsg && this.title === "New Chat") {
      this.title = firstMsg.content.substring(0, 60) + (firstMsg.content.length > 60 ? "..." : "");
    }
  }
});

const ChatSession = mongoose.model("ChatSession", chatSessionSchema);

export default ChatSession;
