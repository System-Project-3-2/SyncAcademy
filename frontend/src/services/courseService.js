/**
 * Course Service
 * Handles all course-related API calls
 */
import api from './api';

const courseService = {
  /**
   * Get all courses with optional pagination and filters
   * @param {Object} params - Query parameters (page, limit, search, department, semester)
   * @returns {Promise} API response with courses data
   */
  getAllCourses: async (params = {}) => {
    const response = await api.get('/courses', { params });
    return response.data;
  },

  /**
   * Get a single course by ID
   * @param {string} courseId - Course ID
   * @returns {Promise} API response with course data
   */
  getCourseById: async (courseId) => {
    const response = await api.get(`/courses/${courseId}`);
    return response.data;
  },

  /**
   * Create a new course (Teacher/Admin only)
   * @param {Object} courseData - { courseNo, courseTitle, description, department, semester }
   * @returns {Promise} API response with created course
   */
  createCourse: async (courseData) => {
    const response = await api.post('/courses', courseData);
    return response.data;
  },

  /**
   * Update a course (Teacher/Admin only)
   * @param {string} courseId - Course ID
   * @param {Object} courseData - Updated course data
   * @returns {Promise} API response with updated course
   */
  updateCourse: async (courseId, courseData) => {
    const response = await api.put(`/courses/${courseId}`, courseData);
    return response.data;
  },

  /**
   * Delete a course (Admin only)
   * @param {string} courseId - Course ID
   * @returns {Promise} API response
   */
  deleteCourse: async (courseId) => {
    const response = await api.delete(`/courses/${courseId}`);
    return response.data;
  },

  /**
   * Regenerate course code (secret enrollment key)
   * @param {string} courseId - Course ID
   * @returns {Promise} API response with new { courseCode }
   */
  regenerateCourseCode: async (courseId) => {
    const response = await api.post(`/courses/${courseId}/regenerate-code`);
    return response.data;
  },

  /**
   * Get all unique departments
   * @returns {Promise} API response with departments array
   */
  getDepartments: async () => {
    const response = await api.get('/courses/meta/departments');
    return response.data;
  },

  /**
   * Get search history for the current user
   * @param {number} limit - Number of history items to fetch
   * @returns {Promise} API response with search history
   */
  getSearchHistory: async (limit = 10) => {
    const response = await api.get('/search/history', { params: { limit } });
    return response.data;
  },

  /**
   * Clear search history
   * @returns {Promise} API response
   */
  clearSearchHistory: async () => {
    const response = await api.delete('/search/history');
    return response.data;
  },

  /**
   * Get autocomplete suggestions
   * @param {string} query - Search query
   * @returns {Promise} API response with suggestions
   */
  getSearchSuggestions: async (query) => {
    const response = await api.get('/search/suggestions', { params: { q: query } });
    return response.data;
  },
};

export default courseService;
