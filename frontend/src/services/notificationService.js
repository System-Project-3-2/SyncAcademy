import api from './api';

const notificationService = {
  getNotifications: (page = 1, limit = 20) =>
    api.get('/notifications', { params: { page, limit } }),

  getUnreadCount: () => api.get('/notifications/unread-count'),

  markAsRead: (id) => api.put(`/notifications/${id}/read`),

  markAllAsRead: () => api.put('/notifications/read-all'),

  deleteNotification: (id) => api.delete(`/notifications/${id}`),

  clearAll: () => api.delete('/notifications'),
};

export default notificationService;
