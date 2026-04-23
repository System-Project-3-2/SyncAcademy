/**
 * Topic Tag Service
 * Frontend API for topic taxonomy and tagging workflows
 */
import api from './api';

const topicTagService = {
  /**
   * Get active topic taxonomy entries for a course
   * @param {string} courseId
   * @returns {Promise}
   */
  getTaxonomyByCourse: async (courseId) => {
    const response = await api.get(`/topic-tags/taxonomy/${courseId}`);
    return response.data;
  },

  /**
   * Create or update a taxonomy entry
   * @param {Object} payload
   * @returns {Promise}
   */
  createTaxonomyEntry: async (payload) => {
    const response = await api.post('/topic-tags/taxonomy', payload);
    return response.data;
  },

  /**
   * Auto-tag a material from its content
   * @param {string} materialId
   * @returns {Promise}
   */
  autoTagMaterial: async (materialId) => {
    const response = await api.post(`/topic-tags/materials/${materialId}/auto-tag`);
    return response.data;
  },
};

export default topicTagService;
