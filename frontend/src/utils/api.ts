import axios from 'axios';
import toast from 'react-hot-toast';

// Use local API in development, production URL in production
const getBaseURL = () => {
  // Check if we're in development (localhost)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // In development, use local backend
    return 'http://localhost:3001/api';
  }
  // In production, use the deployed backend
  return process.env.REACT_APP_API_URL || 'https://gymsage-backend-production-4ebe.up.railway.app/api';
};

// Configure axios defaults
const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000, // 30 second timeout
});

// Add request interceptor to include auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Generic API call helper with error handling
 * @param {Function} apiCall - The API call function
 * @param {string} errorMessage - Custom error message
 * @param {boolean} showToast - Whether to show error toast
 * @returns {Promise} API response or throws error
 */
export const apiCall = async (apiCall: () => Promise<any>, errorMessage = 'Something went wrong', showToast = true) => {
  try {
    const response = await apiCall();
    return response.data;
  } catch (error: any) {
    console.error('API Error:', error);
    
    const message = error.response?.data?.error || error.message || errorMessage;
    
    if (showToast) {
      toast.error(message);
    }
    
    throw error;
  }
};

/**
 * Voice parsing API call
 * @param {string} transcript - Voice transcript
 * @returns {Promise} Parsed workout data
 */
export const parseVoiceTranscript = async (transcript: string) => {
  return apiCall(
    () => api.post('/voice/parse', { transcript }),
    'Failed to parse voice transcript'
  );
};

/**
 * AI Coach chat API call
 * @param {string} message - User message
 * @param {Array} history - Conversation history (optional)
 * @returns {Promise} AI response
 */
export const chatWithCoach = async (message: string, history: Array<{role: string; content: string}> = []) => {
  return apiCall(
    () => api.post('/coach/chat', { message, history }),
    'Failed to get AI coach response'
  );
};

/**
 * Get AI Coach recommendations
 * @returns {Promise} Recommendations data
 */
export const getCoachRecommendations = async () => {
  return apiCall(
    () => api.get('/coach/recommendations'),
    'Failed to get recommendations'
  );
};

// Photo analysis functions disabled - coming soon!
// export const uploadPhoto = async (formData: FormData) => { ... }
// export const analyzePhoto = async (photoId: string) => { ... }

export default api;
