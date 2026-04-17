/**
 * Knowledge Tracing Service
 * Frontend contract for mastery, weak topic, and recommendation insights
 */
import api from './api';

const ktService = {
  getInsights: async (courseId, params = {}) => {
    const response = await api.get(`/kt/insights/${courseId}`, { params });
    return response.data;
  },

  getMastery: async (courseId) => {
    const response = await api.get(`/kt/mastery/${courseId}`);
    return response.data;
  },

  getWeakTopics: async (courseId, params = {}) => {
    const response = await api.get(`/kt/weak-topics/${courseId}`, { params });
    return response.data;
  },

  getRecommendations: async (courseId, params = {}) => {
    const response = await api.get(`/kt/recommendations/${courseId}`, { params });
    return response.data;
  },

  getExplainability: async (courseId, params = {}) => {
    const response = await api.get(`/kt/explainability/${courseId}`, { params });
    return response.data;
  },

  logLearningEvent: async (payload) => {
    const response = await api.post('/kt/events', payload);
    return response.data;
  },

  logLearningEventsBulk: async (events = []) => {
    const response = await api.post('/kt/events/bulk', { events });
    return response.data;
  },
};

export default ktService;
