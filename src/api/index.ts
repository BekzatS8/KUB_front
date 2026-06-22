import axios from "axios"
import { tokenManager } from "@/lib/token-manager"

// Используем прокси маршрут для обхода CORS
const isBrowser = typeof window !== 'undefined'

/** Force https:// protocol on any URL */
function enforceHttpsUrl(url: string): string {
  return url.replace(/^http:\/\//i, 'https://')
}

let baseURL: string

if (isBrowser) {
  // В браузере используем относительный путь через прокси
  baseURL = '/api-proxy'
} else {
  // На сервере используем прямой URL (всегда HTTPS)
  baseURL = enforceHttpsUrl(process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.kubcrm.kz")
}

console.log('API Base URL:', baseURL)

export const api = axios.create({
  baseURL,
  timeout: 30000,
})

// Остальной код остается без изменений...
// Simple cookie helpers (client-side only)
function setCookie(name: string, value: string, days = 7) {
  try {
    if (typeof window === 'undefined') return
    const expires = new Date(Date.now() + days * 864e5).toUTCString()
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; samesite=lax`
  } catch (e) {
    console.error('Error setting cookie:', e)
  }
}

function getCookie(name: string) {
  try {
    if (typeof window === 'undefined') return null
    const match = document.cookie.split('; ').find((row) => row.startsWith(name + '='))
    return match ? decodeURIComponent(match.split('=')[1]) : null
  } catch (e) {
    console.error('Error getting cookie:', e)
    return null
  }
}

function deleteCookie(name: string) {
  try {
    if (typeof window === 'undefined') return
    document.cookie = `${name}=; Max-Age=0; path=/; samesite=lax`
  } catch (e) {
    console.error('Error deleting cookie:', e)
  }
}

// Attach token to axios and store in cookie (client side)
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`
    try {
      setCookie("auth_token", token, 7)
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', token)
        // Initialize proactive token refresh
        tokenManager.scheduleTokenRefresh(token)
      }
    } catch (e) {
      console.error('Error setting auth token:', e)
    }
  } else {
    delete api.defaults.headers.common["Authorization"]
    try {
      deleteCookie("auth_token")
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token')
        // Clear refresh timer on logout
        tokenManager.clearRefreshTimer()
      }
    } catch (e) {
      console.error('Error removing auth token:', e)
    }
  }
}

export function setRefreshToken(token: string | null) {
  try {
    if (token) {
      setCookie('refresh_token', token, 30)
      if (typeof window !== 'undefined') {
        localStorage.setItem('refresh_token', token)
      }
    } else {
      deleteCookie('refresh_token')
      if (typeof window !== 'undefined') {
        localStorage.removeItem('refresh_token')
      }
    }
  } catch (e) {
    console.error('Error setting refresh token:', e)
  }
}

// Получение токена из разных источников
function getAuthToken(): string | null {
  try {
    // Сначала проверяем куки
    if (typeof window !== 'undefined') {
      const cookieToken = getCookie("auth_token")
      if (cookieToken) return cookieToken

      // Затем localStorage
      const localStorageToken = localStorage.getItem('auth_token')
      if (localStorageToken) return localStorageToken
    }

    return null
  } catch (e) {
    console.error('Error getting auth token:', e)
    return null
  }
}

// Request interceptor to ensure token present (reads from multiple sources)
api.interceptors.request.use((config) => {
  // Добавляем логирование для отладки
  console.log('Making request to:', config.url)

  if (typeof window !== "undefined") {
    const token = getAuthToken()
    if (token) {
      // Use .set() method to properly set headers
      if (config.headers) {
        config.headers.set('Authorization', `Bearer ${token}`)
      }
      console.log('Added auth token to request')
    }
  }
  return config
}, (error) => {
  console.error('Request error:', error)
  return Promise.reject(error)
})

import { clearAuthData } from "@/lib/auth";

// Refresh token mutex to prevent race conditions
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

// Add subscriber to be notified when token is refreshed
function addRefreshSubscriber(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

// Notify all subscribers that token has been refreshed
function notifyRefreshSubscribers(token: string) {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
}

// Response interceptor: attempt refresh on 401/403, otherwise normalize error
api.interceptors.response.use(
  (res) => {
    console.log('Response received:', res.status, res.config.url)
    return res
  },
  async (error) => {
    console.error('API Error:', error);
    console.error('API Error Details:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      code: error.code
    })

    const status = error?.response?.status;
    const originalRequest = error?.config;

    // Handle 401 Unauthorized errors
    if (status === 401 && originalRequest && !originalRequest._retry) {
      // Prevent recursive refresh if the refresh call itself fails
      if (originalRequest.url === '/auth/refresh') {
        console.log("Refresh endpoint failed - logging out...");
        await forceLogout('Session expired. Please login again.');
        return Promise.reject(error);
      }

      // If already refreshing, wait for the new token
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          addRefreshSubscriber((token: string) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      console.log('Attempting token refresh...');
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          // Create a new axios instance for refresh to avoid interceptor loop
          const refreshApi = axios.create({
            baseURL,
            headers: {
              "Content-Type": "application/json",
            },
            timeout: 30000,
          });
          
          const resp = await refreshApi.post('/auth/refresh', { refresh_token: refreshToken });
          const data = resp.data;
          
          // Handle different response formats
          const newAccess = data?.tokens?.access_token || data?.access_token;
          const newRefresh = data?.tokens?.refresh_token || data?.refresh_token;

          if (newAccess) {
            setAuthToken(newAccess);
            console.log('Access token refreshed successfully');
            // Notify all waiting requests
            notifyRefreshSubscribers(newAccess);
          }
          if (newRefresh) {
            setRefreshToken(newRefresh);
            console.log('Refresh token rotated successfully');
          }

          // Update original request with new token
          if (newAccess) {
            originalRequest.headers['Authorization'] = `Bearer ${newAccess}`;
            console.log('Retrying original request with new token');
            return api(originalRequest);
          }
        } else {
          console.log('No refresh token available');
          await forceLogout('No refresh token available. Please login again.');
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        await forceLogout('Failed to refresh session. Please login again.');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle 403 Forbidden errors
    if (status === 403) {
      console.error('Access forbidden - insufficient permissions');
      const message = error?.response?.data?.message || 'Access forbidden. You do not have permission to perform this action.';
      return Promise.reject(new Error(message));
    }

    // Handle network errors
    if (!status && error.code === 'NETWORK_ERROR') {
      console.error('Network error - no connection');
      return Promise.reject(new Error('Network error. Please check your internet connection.'));
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout');
      return Promise.reject(new Error('Request timeout. Please try again.'));
    }

    // Handle other errors
    if (status === 400) {
      // For 400 errors, preserve the original response data for detailed error handling
      const originalError = new Error(error.message);
      (originalError as any).response = error.response;
      return Promise.reject(originalError);
    }

    const message = error?.response?.data?.message ||
      error?.response?.data?.error ||
      error.message ||
      `Server error: ${status || 'Unknown'}`;

    console.error('Error message:', message);
    return Promise.reject(new Error(message));
  }
)

// Unified logout function with proper cleanup
async function forceLogout(message?: string) {
  if (typeof window !== 'undefined') {
    console.log("Logging out due to authentication failure...");
    
    // Clear all authentication data
    clearAuthData();
    deleteCookie('auth_token');
    deleteCookie('refresh_token');
    
    // Clear token refresh timer
    tokenManager.clearRefreshTimer();
    
    // Clear axios default headers
    delete api.defaults.headers.common["Authorization"];
    
    // Store logout message for display on login page
    if (message) {
      sessionStorage.setItem('logout_message', message);
    }
    
    // Only redirect if not already on login page
    if (!window.location.pathname.includes('/auth/login')) {
      window.location.href = '/auth/login';
    }
  }
}

// Export logout function for manual use
export function logout(message?: string) {
  return forceLogout(message);
}

// Helper function to get refresh token from multiple sources
function getRefreshToken(): string | null {
  try {
    if (typeof window !== 'undefined') {
      const cookieToken = getCookie('refresh_token');
      if (cookieToken) return cookieToken;
      
      const localStorageToken = localStorage.getItem('refresh_token');
      if (localStorageToken) return localStorageToken;
    }
    return null;
  } catch (e) {
    console.error('Error getting refresh token:', e);
    return null;
  }
}

export default api