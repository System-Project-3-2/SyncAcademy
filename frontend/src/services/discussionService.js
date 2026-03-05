/**
 * Discussion Service
 * API calls for course Q&A / discussion features
 */
import api from './api';

const multipartConfig = { headers: { 'Content-Type': 'multipart/form-data' } };

const buildFormData = ({ courseId, title, content, links = [], tags = [], files = [], removeAttachments = [] } = {}) => {
  const fd = new FormData();
  if (courseId) fd.append('courseId', courseId);
  if (title) fd.append('title', title);
  if (content) fd.append('content', content);
  links.filter(Boolean).forEach((l) => fd.append('links', l));
  tags.filter(Boolean).forEach((t) => fd.append('tags', t));
  removeAttachments.forEach((u) => fd.append('removeAttachments', u));
  files.forEach((f) => fd.append('attachments', f));
  return fd;
};

const buildReplyFormData = ({ content, links = [], files = [] } = {}) => {
  const fd = new FormData();
  if (content) fd.append('content', content);
  links.filter(Boolean).forEach((l) => fd.append('links', l));
  files.forEach((f) => fd.append('attachments', f));
  return fd;
};

const discussionService = {
  getDiscussionsByCourse: async (courseId, params = {}) => {
    const { page = 1, limit = 10, status } = params;
    let url = `/discussions/course/${courseId}?page=${page}&limit=${limit}`;
    if (status) url += `&status=${status}`;
    const response = await api.get(url);
    return response.data;
  },

  getDiscussion: async (id) => {
    const response = await api.get(`/discussions/${id}`);
    return response.data;
  },

  createDiscussion: async (data) => {
    const fd = buildFormData(data);
    const response = await api.post('/discussions', fd, multipartConfig);
    return response.data;
  },

  updateDiscussion: async (id, data) => {
    const fd = buildFormData(data);
    const response = await api.put(`/discussions/${id}`, fd, multipartConfig);
    return response.data;
  },

  deleteDiscussion: async (id) => {
    const response = await api.delete(`/discussions/${id}`);
    return response.data;
  },

  toggleStatus: async (id) => {
    const response = await api.put(`/discussions/${id}/status`);
    return response.data;
  },

  addReply: async (id, data) => {
    const fd = buildReplyFormData(data);
    const response = await api.post(`/discussions/${id}/replies`, fd, multipartConfig);
    return response.data;
  },

  editReply: async (id, replyId, content) => {
    const response = await api.put(`/discussions/${id}/replies/${replyId}`, { content });
    return response.data;
  },

  deleteReply: async (id, replyId) => {
    const response = await api.delete(`/discussions/${id}/replies/${replyId}`);
    return response.data;
  },

  acceptReply: async (id, replyId) => {
    const response = await api.put(`/discussions/${id}/replies/${replyId}/accept`);
    return response.data;
  },

  addSubReply: async (id, replyId, content) => {
    const response = await api.post(`/discussions/${id}/replies/${replyId}/subreplies`, { content });
    return response.data;
  },

  editSubReply: async (id, replyId, subReplyId, content) => {
    const response = await api.put(`/discussions/${id}/replies/${replyId}/subreplies/${subReplyId}`, { content });
    return response.data;
  },

  deleteSubReply: async (id, replyId, subReplyId) => {
    const response = await api.delete(`/discussions/${id}/replies/${replyId}/subreplies/${subReplyId}`);
    return response.data;
  },

  voteDiscussion: async (id, value) => {
    const response = await api.put(`/discussions/${id}/vote`, { value });
    return response.data;
  },

  voteReply: async (id, replyId, value) => {
    const response = await api.put(`/discussions/${id}/replies/${replyId}/vote`, { value });
    return response.data;
  },
};

export default discussionService;
