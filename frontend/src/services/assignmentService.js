/**
 * Assignment Service
 * API calls for assignment, submission, and grading features
 */
import api from './api';

const multipartConfig = { headers: { 'Content-Type': 'multipart/form-data' } };

const assignmentService = {
  // ─── Assignments ──────────────────────────────────────────────────────
  getAssignmentsByCourse: async (courseId, params = {}) => {
    const { page = 1, limit = 20 } = params;
    const response = await api.get(`/assignments/course/${courseId}?page=${page}&limit=${limit}`);
    return response.data;
  },

  getAssignment: async (id) => {
    const response = await api.get(`/assignments/${id}`);
    return response.data;
  },

  createAssignment: async (data) => {
    const fd = new FormData();
    fd.append('courseId', data.courseId);
    fd.append('title', data.title);
    if (data.description) fd.append('description', data.description);
    if (data.dueDate) fd.append('dueDate', data.dueDate);
    if (data.totalMarks !== undefined) fd.append('totalMarks', data.totalMarks);
    if (data.isPublished !== undefined) fd.append('isPublished', data.isPublished);
    if (data.files) {
      data.files.forEach((f) => fd.append('attachments', f));
    }
    const response = await api.post('/assignments', fd, multipartConfig);
    return response.data;
  },

  updateAssignment: async (id, data) => {
    const fd = new FormData();
    if (data.title) fd.append('title', data.title);
    if (data.description !== undefined) fd.append('description', data.description);
    if (data.dueDate !== undefined) fd.append('dueDate', data.dueDate);
    if (data.totalMarks !== undefined) fd.append('totalMarks', data.totalMarks);
    if (data.isPublished !== undefined) fd.append('isPublished', data.isPublished);
    if (data.removeAttachments) {
      data.removeAttachments.forEach((u) => fd.append('removeAttachments', u));
    }
    if (data.files) {
      data.files.forEach((f) => fd.append('attachments', f));
    }
    const response = await api.put(`/assignments/${id}`, fd, multipartConfig);
    return response.data;
  },

  deleteAssignment: async (id) => {
    const response = await api.delete(`/assignments/${id}`);
    return response.data;
  },

  // ─── Submissions ──────────────────────────────────────────────────────
  submitAssignment: async (id, { file, textContent }) => {
    const fd = new FormData();
    if (file) fd.append('file', file);
    if (textContent) fd.append('textContent', textContent);
    const response = await api.post(`/assignments/${id}/submit`, fd, multipartConfig);
    return response.data;
  },

  getMySubmission: async (assignmentId) => {
    const response = await api.get(`/assignments/${assignmentId}/my-submission`);
    return response.data;
  },

  getSubmissions: async (assignmentId) => {
    const response = await api.get(`/assignments/${assignmentId}/submissions`);
    return response.data;
  },

  gradeSubmission: async (assignmentId, submissionId, { grade, feedback }) => {
    const response = await api.put(`/assignments/${assignmentId}/submissions/${submissionId}/grade`, {
      grade,
      feedback,
    });
    return response.data;
  },

  // ─── Grades ───────────────────────────────────────────────────────────
  getMyGrades: async () => {
    const response = await api.get('/assignments/my-grades');
    return response.data;
  },
};

export default assignmentService;
