import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api', // Adjust in .env mostly, but standard for dev
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Optionally handle 401 Unauthorized globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // window.location.href = '/login'; // Optional auto-redirect
    }
    return Promise.reject(error);
  }
);

export default api;
