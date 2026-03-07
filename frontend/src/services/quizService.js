/**
 * Quiz Service
 * API calls for AI quiz generation, attempts, and results
 */
import api from './api';

const quizService = {
  // ─── Quiz Management (Teacher) ──────────────────────────────────────

  generateQuiz: async (data) => {
    const response = await api.post('/quizzes/generate', data);
    return response.data;
  },

  createManualQuiz: async (data) => {
    const response = await api.post('/quizzes/manual', data);
    return response.data;
  },

  getMyCreatedQuizzes: async () => {
    const response = await api.get('/quizzes/my-created');
    return response.data;
  },

  getQuizzesByCourse: async (courseId) => {
    const response = await api.get(`/quizzes/course/${courseId}`);
    return response.data;
  },

  getQuiz: async (id) => {
    const response = await api.get(`/quizzes/${id}`);
    return response.data;
  },

  updateQuiz: async (id, data) => {
    const response = await api.put(`/quizzes/${id}`, data);
    return response.data;
  },

  publishQuiz: async (id, publish = true) => {
    const response = await api.put(`/quizzes/${id}/publish`, { publish });
    return response.data;
  },

  scheduleQuiz: async (id, { scheduledAt, availableUntil }) => {
    const response = await api.put(`/quizzes/${id}/schedule`, { scheduledAt, availableUntil });
    return response.data;
  },

  deleteQuiz: async (id) => {
    const response = await api.delete(`/quizzes/${id}`);
    return response.data;
  },

  // ─── Student Attempts ─────────────────────────────────────────────

  submitAttempt: async (quizId, data) => {
    const response = await api.post(`/quizzes/${quizId}/attempt`, data);
    return response.data;
  },

  getMyAttempts: async () => {
    const response = await api.get('/quizzes/my-attempts');
    return response.data;
  },

  // ─── Results (Teacher) ────────────────────────────────────────────

  getQuizResults: async (quizId) => {
    const response = await api.get(`/quizzes/${quizId}/results`);
    return response.data;
  },
};

export default quizService;
