import api from './api';

const eventService = {
  // ── Teacher ──────────────────────────────────────────────
  /** Create a new event */
  createEvent: async (data) => {
    const res = await api.post('/events', data);
    return res.data;
  },

  /** Get all events where the teacher is creator or assigned */
  getMyEvents: async () => {
    const res = await api.get('/events');
    return res.data;
  },

  /** Get a single event with registrations */
  getEventById: async (id) => {
    const res = await api.get(`/events/${id}`);
    return res.data;
  },

  /** Update an event (creator only) */
  updateEvent: async (id, data) => {
    const res = await api.put(`/events/${id}`, data);
    return res.data;
  },

  /** Delete an event (creator only) */
  deleteEvent: async (id) => {
    const res = await api.delete(`/events/${id}`);
    return res.data;
  },

  /** Save marks for assigned course(s) */
  saveMarks: async (eventId, marks) => {
    const res = await api.post(`/events/${eventId}/marks`, { marks });
    return res.data;
  },

  /** Get marks for an event */
  getMarks: async (eventId) => {
    const res = await api.get(`/events/${eventId}/marks`);
    return res.data;
  },

  /** Download detailed result as CSV blob */
  downloadDetailedResult: async (eventId) => {
    const res = await api.get(`/events/${eventId}/detailed-result`, { responseType: 'blob' });
    return res;
  },

  /** Download professional PDF result sheet */
  downloadResultSheetPdf: async (eventId) => {
    const res = await api.get(`/events/${eventId}/result-sheet-pdf`, { responseType: 'blob' });
    return res;
  },

  // ── Student ──────────────────────────────────────────────
  /** Register for an event with a code */
  registerForEvent: async (registrationCode) => {
    const res = await api.post('/events/register', { registrationCode });
    return res.data;
  },

  /** Get the student's registered events */
  getMyRegistrations: async () => {
    const res = await api.get('/events/my-registrations');
    return res.data;
  },
};

export default eventService;
