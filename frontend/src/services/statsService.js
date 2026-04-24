/**
 * Statistics Service
 * Handles dashboard statistics API calls
 */
import api from './api';

const statsService = {
  /**
   * Get public landing page statistics
   * @returns {Promise} API response with public counts
   */
  getPublicLandingStats: async () => {
    const response = await api.get('/stats/public');
    return response.data;
  },

  /**
   * Get admin dashboard statistics
   * @returns {Promise} API response with admin stats
   */
  getAdminStats: async () => {
    const response = await api.get('/stats/admin');
    return response.data;
  },

  /**
   * Get teacher dashboard statistics
   * @returns {Promise} API response with teacher stats
   */
  getTeacherStats: async () => {
    const response = await api.get('/stats/teacher');
    return response.data;
  },

  /**
   * Get student dashboard statistics
   * @returns {Promise} API response with student stats
   */
  getStudentStats: async () => {
    const response = await api.get('/stats/student');
    return response.data;
  },
};

export default statsService;
