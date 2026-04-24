/**
 * API Configuration
 * Central configuration for axios instance with interceptors for auth
 */
import axios from 'axios';

const resolveApiBaseUrl = () => {
  const envBaseUrl = process.env.REACT_APP_API_BASE_URL || process.env.VITE_API_BASE_URL;
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'student-aid-semantic-search.onrender.com') {
      return 'https://student-aid-1mvg.onrender.com/api';
    }
  }

  return 'http://localhost:5000/api';
};

// Create axios instance with base URL from environment variable
const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || resolveApiBaseUrl(),
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
