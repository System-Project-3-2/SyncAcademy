/**
 * Admin Service
 * Handles all admin-related API calls
 */
import api from './api';

const adminService = {
  /**
   * Get all users with optional filters
   * @param {Object} params - Query parameters (role, search, isVerified)
   */
  getAllUsers: async (params = {}) => {
    const response = await api.get('/admin/users', { params });
    return response.data;
  },

  /**
   * Get user by ID
   * @param {string} id - User ID
   */
  getUserById: async (id) => {
    const response = await api.get(`/admin/users/${id}`);
    return response.data;
  },

  /**
   * Create new user
   * @param {Object} userData - User data (name, email, password, role)
   */
  createUser: async (userData) => {
    const response = await api.post('/admin/users', userData);
    return response.data;
  },

  /**
   * Update user
   * @param {string} id - User ID
   * @param {Object} userData - Updated user data
   */
  updateUser: async (id, userData) => {
    const response = await api.put(`/admin/users/${id}`, userData);
    return response.data;
  },

  /**
   * Delete user
   * @param {string} id - User ID
   */
  deleteUser: async (id) => {
    const response = await api.delete(`/admin/users/${id}`);
    return response.data;
  },

  /**
   * Get user statistics
   */
  getUserStats: async () => {
    const response = await api.get('/admin/users/stats');
    return response.data;
  },

  /**
   * Generate synthetic dataset for demos/testing
   * @param {Object} config - Dataset scale configuration
   */
  generateSyntheticData: async (config = {}) => {
    const response = await api.post('/admin/synthetic-data/generate', config);
    return response.data;
  },
};

export default adminService;
