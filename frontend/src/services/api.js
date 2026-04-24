/**
 * API Configuration
 * Central configuration for axios instance with interceptors for auth
 */
import axios from 'axios';

const normalizeUrl = (url) => url?.replace(/\/+$/, '');

const isLocalHostname = (hostname) => {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
};

const resolveApiBaseUrl = () => {
  const localApiBaseUrl =
    process.env.REACT_APP_LOCAL_API_BASE_URL ||
    process.env.VITE_LOCAL_API_BASE_URL ||
    'http://localhost:5000/api';

  const remoteApiBaseUrl =
    process.env.REACT_APP_REMOTE_API_BASE_URL ||
    process.env.VITE_REMOTE_API_BASE_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    process.env.VITE_API_BASE_URL ||
    'https://student-aid-1mvg.onrender.com/api';

  if (typeof window !== 'undefined') {
    if (isLocalHostname(window.location.hostname)) {
      return normalizeUrl(localApiBaseUrl);
    }

    return normalizeUrl(remoteApiBaseUrl);
  }

  return normalizeUrl(remoteApiBaseUrl);
};

// Create axios instance with base URL from environment variable
const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 600000, // 10 min — long enough for local LLM quiz generation
});

// Request interceptor - adds auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handles auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
