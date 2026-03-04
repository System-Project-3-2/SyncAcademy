/**
 * User Service
 * Handles user profile operations
 */
import api from './api';

const userService = {
  /**
   * Get current user profile
   * @returns {Promise} API response with user data
   */
  getProfile: async () => {
    const response = await api.get('/users/profile');
    return response.data;
  },

  /**
   * Update current user profile
   * @param {Object} data - { name, email }
   * @returns {Promise} API response
   */
  updateProfile: async (data) => {
    const response = await api.put('/users/profile', data);
    // Update local storage with new user data
    if (response.data.user) {
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  /**
   * Change password
   * @param {Object} data - { currentPassword, newPassword }
   * @returns {Promise} API response
   */
  changePassword: async (data) => {
    const response = await api.put('/users/change-password', data);
    return response.data;
  },

  /**
   * Upload avatar image
   * @param {FormData} formData - FormData with 'avatar' file field
   * @returns {Promise} API response with updated user
   */
  uploadAvatar: async (formData) => {
    const response = await api.put('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (response.data.user) {
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },
};

export default userService;
