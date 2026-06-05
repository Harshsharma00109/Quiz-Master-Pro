// PATH: quiz-platform/frontend/src/utils/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
});

// Attach JWT token to every request — always reads fresh from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qm_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally — BUT skip if we are on a payment/subscription route
// because those use a freshly issued token that may not be in axios defaults yet
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const url = err.config?.url || '';
      const isPaymentRoute =
        url.includes('razorpay') ||
        url.includes('subscription') ||
        url.includes('verify-payment') ||
        url.includes('create-order');

      // Only auto-logout on 401 if NOT a payment route
      if (!isPaymentRoute) {
        localStorage.removeItem('qm_token');
        localStorage.removeItem('qm_user');
        window.location.href = '/';
      }
    }
    return Promise.reject(err);
  }
);

// ── AUTH ───────────────────────────────────────────────────
export const authAPI = {
  register:      (data) => api.post('/auth/register',    data),
  login:         (data) => api.post('/auth/login',       data),
  me:            ()     => api.get('/auth/me'),
  sendOtp:       (data) => api.post('/auth/send-otp',    data),
  verifyOtp:     (data) => api.post('/auth/verify-otp',  data),
  updateProfile: (data) => api.put('/auth/profile',      data),
};

// ── QUIZZES ────────────────────────────────────────────────
export const quizAPI = {
  getAll:      (params)   => api.get('/quizzes',               { params }),
  getMine:     ()         => api.get('/quizzes/my'),
  getById:     (id)       => api.get(`/quizzes/${id}`),
  create:      (data)     => api.post('/quizzes',               data),
  update:      (id, data) => api.put(`/quizzes/${id}`,          data),
  remove:      (id)       => api.delete(`/quizzes/${id}`),
  attempt:     (id, data) => api.post(`/quizzes/${id}/attempt`, data),
  leaderboard: (id)       => api.get(`/quizzes/${id}/leaderboard`),
};

// ── USER ───────────────────────────────────────────────────
export const userAPI = {
  attempts: (userId) => api.get(`/users/${userId}/attempts`),
};

// ── MISC ───────────────────────────────────────────────────
export const miscAPI = {
  stats:      () => api.get('/stats'),
  categories: () => api.get('/categories'),
  health:     () => api.get('/health'),
};

// ── AI ─────────────────────────────────────────────────────
export const aiAPI = {
  generate: (data) => api.post('/ai/generate-questions', data),
};

export default api;