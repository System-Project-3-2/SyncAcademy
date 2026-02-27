/**
 * Chat Controller
 * Handles RAG-powered chatbot endpoints
 */
import ChatSession from "../models/chatSessionModel.js";
import { ragChat } from "../services/ragService.js";
import { checkOllamaHealth } from "../services/ollamaService.js";

/**
 * POST /api/chat
 * Send a message and get a RAG-powered response
 */
export const sendMessage = async (req, res) => {
  try {
    const { message, sessionId, filters } = req.body;
    const userId = req.user._id;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    // Find or create session
    let session;
    if (sessionId) {
      session = await ChatSession.findOne({ _id: sessionId, user: userId });
      if (!session) {
        return res.status(404).json({ message: "Chat session not found" });
      }
    } else {
      session = new ChatSession({ user: userId, messages: [] });
    }

    // Add user message
    session.messages.push({ role: "user", content: message.trim() });

    // Build chat history for context (last 4 messages = 2 exchanges, keeps prompt small for local LLMs)
    const chatHistory = session.messages.slice(-4).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Run RAG pipeline
    const { answer, sources } = await ragChat(message.trim(), chatHistory, filters);

    // Add assistant message
    session.messages.push({
      role: "assistant",
      content: answer,
      sources,
    });

    // Auto-generate title from first user message
    if (session.messages.filter((m) => m.role === "user").length === 1) {
      session.title =
        message.trim().substring(0, 60) +
        (message.trim().length > 60 ? "..." : "");
    }

    await session.save();

    const assistantMsg = session.messages[session.messages.length - 1];

    res.json({
      sessionId: session._id,
      message: {
        role: "assistant",
        content: assistantMsg.content,
        sources: assistantMsg.sources,
        timestamp: assistantMsg.timestamp,
      },
    });
  } catch (error) {
    console.error("Chat error:", error.message);

    // Provide a user-friendly error if Ollama is down
    if (error.message.includes("ECONNREFUSED")) {
      return res.status(503).json({
        message: "AI model is offline. Run 'ollama serve' in a terminal and try again.",
        details: error.message,
      });
    }
    if (error.message.includes("timed out")) {
      return res.status(504).json({
        message: "AI took too long to respond. Try asking a shorter or simpler question.",
        details: error.message,
      });
    }

    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/chat/sessions
 * Get all chat sessions for the current user
 */
export const getSessions = async (req, res) => {
  try {
    const sessions = await ChatSession.find({ user: req.user._id })
      .select("title createdAt updatedAt messages")
      .sort({ updatedAt: -1 })
      .lean();

    // Add message count and last message preview
    const formatted = sessions.map((s) => ({
      _id: s._id,
      title: s.title,
      messageCount: s.messages.length,
      lastMessage:
        s.messages.length > 0
          ? s.messages[s.messages.length - 1].content.substring(0, 80)
          : "",
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/chat/sessions/:id
 * Get a specific chat session with all messages
 */
export const getSession = async (req, res) => {
  try {
    const session = await ChatSession.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ message: "Chat session not found" });
    }

    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * DELETE /api/chat/sessions/:id
 * Delete a chat session
 */
export const deleteSession = async (req, res) => {
  try {
    const session = await ChatSession.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ message: "Chat session not found" });
    }

    res.json({ message: "Chat session deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * DELETE /api/chat/sessions
 * Delete all chat sessions for the current user
 */
export const clearSessions = async (req, res) => {
  try {
    await ChatSession.deleteMany({ user: req.user._id });
    res.json({ message: "All chat sessions cleared" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/chat/health
 * Check if the AI model (Ollama) is available
 */
export const healthCheck = async (req, res) => {
  try {
    const health = await checkOllamaHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ healthy: false, error: error.message });
  }
};
