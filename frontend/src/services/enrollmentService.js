/**
 * Enrollment Service
 * Handles all enrollment-related API calls
 */
import api from './api';

const enrollmentService = {
  /**
   * Enroll in a course using secret course code
   * @param {string} courseCode - The secret course code to enroll with
   * @returns {Promise} API response with enrollment data
   */
  enrollInCourse: async (courseCode) => {
    const response = await api.post('/enrollments/enroll', { courseCode });
    return response.data;
  },

  /**
   * Unenroll from a course
   * @param {string} courseId - The course ID to unenroll from
   * @returns {Promise} API response
   */
  unenrollFromCourse: async (courseId) => {
    const response = await api.post(`/enrollments/unenroll/${courseId}`);
    return response.data;
  },

  /**
   * Get current student's enrolled courses
   * @param {Object} params - Optional { search }
   * @returns {Promise} API response with enrolled courses array
   */
  getMyEnrolledCourses: async (params = {}) => {
    const response = await api.get('/enrollments/my-courses', { params });
    return response.data;
  },

  /**
   * Get students enrolled in a course
   * @param {string} courseId - The course ID
   * @param {Object} params - Optional { search }
   * @returns {Promise} API response with { course, students, totalStudents }
   */
  getCourseStudents: async (courseId, params = {}) => {
    const response = await api.get(`/enrollments/course/${courseId}/students`, { params });
    return response.data;
  },

  /**
   * Remove a student from a course
   * @param {string} courseId - The course ID
   * @param {string} studentId - The student ID to remove
   * @returns {Promise} API response
   */
  removeStudent: async (courseId, studentId) => {
    const response = await api.delete(`/enrollments/course/${courseId}/student/${studentId}`);
    return response.data;
  },

  /**
   * Get enrollment count for a course
   * @param {string} courseId - The course ID
   * @returns {Promise} API response with { count }
   */
  getCourseEnrollmentCount: async (courseId) => {
    const response = await api.get(`/enrollments/course/${courseId}/count`);
    return response.data;
  },
};

export default enrollmentService;
