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
      type: String,
      fileUrl: String,
      relevance: Number,
    },
  ],
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

// Auto-generate title from first user message
chatSessionSchema.pre("save", function (next) {
  if (this.isNew && this.messages.length > 0) {
    const firstMsg = this.messages.find((m) => m.role === "user");
    if (firstMsg) {
      this.title = firstMsg.content.substring(0, 60) + (firstMsg.content.length > 60 ? "..." : "");
    }
  }
  next();
});

const ChatSession = mongoose.model("ChatSession", chatSessionSchema);

export default ChatSession;
