/**
 * Chat Service
 * API calls for the RAG-powered chatbot
 */
import api from './api';

const chatService = {
  /**
   * Send a message and get an AI response
   * @param {string} message - User's question
   * @param {string} [sessionId] - Existing session ID (null for new chat)
   * @param {object} [filters] - Optional { courseNo, type }
   */
  sendMessage: async (message, sessionId = null, filters = {}) => {
    const { data } = await api.post('/chat', { message, sessionId, filters });
    return data;
  },

  /** Get all chat sessions for the current user */
  getSessions: async () => {
    const { data } = await api.get('/chat/sessions');
    return data;
  },

  /** Get a single chat session with full message history */
  getSession: async (sessionId) => {
    const { data } = await api.get(`/chat/sessions/${sessionId}`);
    return data;
  },

  /** Delete a chat session */
  deleteSession: async (sessionId) => {
    const { data } = await api.delete(`/chat/sessions/${sessionId}`);
    return data;
  },

  /** Clear all chat sessions */
  clearSessions: async () => {
    const { data } = await api.delete('/chat/sessions');
    return data;
  },

  /** Check AI model health */
  checkHealth: async () => {
    const { data } = await api.get('/chat/health');
    return data;
  },
};

export default chatService;
