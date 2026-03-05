/**
 * Announcement Service
 * API calls for course notice / announcement features
 */
import api from './api';

/** Builds a FormData from { courseId, title, content, links[], files[], removeAttachments[] } */
const buildFormData = ({ courseId, title, content, links = [], files = [], removeAttachments = [] } = {}) => {
  const fd = new FormData();
  if (courseId) fd.append('courseId', courseId);
  if (title) fd.append('title', title);
  if (content) fd.append('content', content);
  links.filter(Boolean).forEach((l) => fd.append('links', l));
  removeAttachments.forEach((u) => fd.append('removeAttachments', u));
  files.forEach((f) => fd.append('attachments', f));
  return fd;
};

const multipartConfig = { headers: { 'Content-Type': 'multipart/form-data' } };

const announcementService = {
  getAnnouncementsByCourse: async (courseId, params = {}) => {
    const { page = 1, limit = 10 } = params;
    const response = await api.get(`/announcements/course/${courseId}?page=${page}&limit=${limit}`);
    return response.data;
  },

  getAnnouncement: async (id) => {
    const response = await api.get(`/announcements/${id}`);
    return response.data;
  },

  /** @param {{ courseId, title, content, links?, files? }} data */
  createAnnouncement: async (data) => {
    const fd = buildFormData(data);
    const response = await api.post('/announcements', fd, multipartConfig);
    return response.data;
  },

  /** @param {string} id @param {{ title?, content?, links?, files?, removeAttachments? }} data */
  updateAnnouncement: async (id, data) => {
    const fd = buildFormData(data);
    const response = await api.put(`/announcements/${id}`, fd, multipartConfig);
    return response.data;
  },

  deleteAnnouncement: async (id) => {
    const response = await api.delete(`/announcements/${id}`);
    return response.data;
  },

  pinAnnouncement: async (id) => {
    const response = await api.put(`/announcements/${id}/pin`);
    return response.data;
  },

  addComment: async (id, text) => {
    const response = await api.post(`/announcements/${id}/comments`, { text });
    return response.data;
  },

  editComment: async (id, commentId, text) => {
    const response = await api.put(`/announcements/${id}/comments/${commentId}`, { text });
    return response.data;
  },

  deleteComment: async (id, commentId) => {
    const response = await api.delete(`/announcements/${id}/comments/${commentId}`);
    return response.data;
  },

  addCommentReply: async (id, commentId, text) => {
    const response = await api.post(`/announcements/${id}/comments/${commentId}/replies`, { text });
    return response.data;
  },

  editCommentReply: async (id, commentId, replyId, text) => {
    const response = await api.put(`/announcements/${id}/comments/${commentId}/replies/${replyId}`, { text });
    return response.data;
  },

  deleteCommentReply: async (id, commentId, replyId) => {
    const response = await api.delete(`/announcements/${id}/comments/${commentId}/replies/${replyId}`);
    return response.data;
  },
};

export default announcementService;
