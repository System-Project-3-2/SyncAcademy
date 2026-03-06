import api from './api';

const invitationService = {
  /** Get all teachers (for invite autocomplete) */
  getAllTeachers: async () => {
    const res = await api.get('/course-invitations/teachers');
    return res.data;
  },

  /** Send invitation to another teacher */
  sendInvitation: async (data) => {
    const res = await api.post('/course-invitations', data);
    return res.data;
  },

  /** Get invitations received by the logged-in teacher */
  getReceived: async () => {
    const res = await api.get('/course-invitations/received');
    return res.data;
  },

  /** Get invitations sent by the logged-in teacher */
  getSent: async () => {
    const res = await api.get('/course-invitations/sent');
    return res.data;
  },

  /** Accept or decline an invitation */
  respond: async (id, status) => {
    const res = await api.put(`/course-invitations/${id}/respond`, { status });
    return res.data;
  },
};

export default invitationService;
