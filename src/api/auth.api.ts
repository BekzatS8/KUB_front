import api, { setAuthToken, setRefreshToken } from './index'
import { setCurrentUser, setCurrentCompany } from '@/lib/auth'
import { tokenManager } from '@/lib/token-manager'
import type * as Models from '../models/Auth.model'

// Функция для преобразования данных пользователя с сервера в формат приложения
function transformUserFromServer(serverUser: any): any {
  return {
    id: serverUser.id,
    first_name: serverUser.first_name,
    last_name: serverUser.last_name,
    middle_name: serverUser.middle_name,
    full_name: serverUser.full_name,
    email: serverUser.email,
    phone: serverUser.phone,
    position: serverUser.position,
    role: serverUser.role || { id: 0, code: '', legacy_name: '' },
    branch: serverUser.branch || null,
    is_active: serverUser.is_active,
    is_verified: serverUser.is_verified,
    telegram: serverUser.telegram || { chat_id: 0, notify_tasks: false },
    legacy: serverUser.legacy || { company_name: '', bin_iin: '' },
    // Legacy fields for backward compatibility
    role_id: serverUser.role?.id,
    company_name: serverUser.legacy?.company_name,
    bin_iin: serverUser.legacy?.bin_iin,
    telegram_chat_id: serverUser.telegram?.chat_id,
    notify_tasks_telegram: serverUser.telegram?.notify_tasks,
    status: 'active'
  }
}

// Функция для преобразования role_id в строковую роль
function getRoleFromId(roleId: number): string {
  const roleMapping: Record<number, string> = {
    50: 'system_admin',
    40: 'leadership',
    30: 'control',
    20: 'operations',
    10: 'sales',
  }
  return roleMapping[roleId] || 'user'
}

// Функция для нормализации role codes
function normalizeRoleCode(roleCode: string): string {
  const codeMapping: Record<string, string> = {
    'system_admin': 'system_admin',
    'leadership': 'leadership',
    'management': 'leadership',
    'control': 'control',
    'operations': 'operations',
    'sales': 'sales',
  }
  return codeMapping[roleCode] || roleCode
}

export async function login(payload: Models.Auth_Login_Request, params?: Record<string, any>): Promise<Models.Auth_Login_Response> {
  const res = await api.post(`/auth/login`, payload)
  const data = res.data
  
  console.log("Login API response:", data); // Debug log
  
  try {
    if (data?.tokens?.access_token) {
      setAuthToken(data.tokens.access_token)
      // Initialize proactive token refresh
      tokenManager.scheduleTokenRefresh(data.tokens.access_token)
      console.log("Token set successfully");
    }
    if (data?.tokens?.refresh_token) {
      setRefreshToken(data.tokens.refresh_token)
      console.log("Refresh token set successfully");
    }
    if (data?.user) {
      console.log("User data found in response:", data.user); // Debug log
      // Преобразуем пользователя с сервера в формат приложения
      const transformedUser = transformUserFromServer(data.user)
      console.log("Transformed user data:", transformedUser); // Debug log
      setCurrentUser(transformedUser)
      console.log("setCurrentUser called successfully"); // Debug log
      
      // Также создаем компанию на основе данных пользователя
      const company = {
        id: String(data.user.id),
        name: data.user.legacy?.company_name || data.user.full_name,
        bin_iin: data.user.legacy?.bin_iin,
        email: data.user.email,
        phone: data.user.phone,
        status: 'active'
      }
      setCurrentCompany(company)
      console.log("Company data set successfully:", company); // Debug log
    } else {
      console.log("No user data found in login response");
    }
  } catch (e) {
    console.error('Ошибка при сохранении данных авторизации:', e)
  }
  
  return data
}

export async function refresh_token(payload: Models.Auth_Refresh_token_Request, params?: Record<string, any>): Promise<any> {
  try {
    const res = await api.post(`/auth/refresh`, payload)
    const data = res.data
    
    console.log("Refresh token API response:", data);
    
    // Handle different response formats
    let newAccessToken: string | null = null;
    
    if (data?.tokens?.access_token) {
      setAuthToken(data.tokens.access_token)
      newAccessToken = data.tokens.access_token;
      console.log("New access token set successfully");
    }
    if (data?.tokens?.refresh_token) {
      setRefreshToken(data.tokens.refresh_token)
      console.log("New refresh token set successfully");
    }
    
    // Handle direct token format (fallback)
    if (data?.access_token && !data?.tokens?.access_token) {
      setAuthToken(data.access_token)
      newAccessToken = data.access_token;
      console.log("New access token set successfully (direct format)");
    }
    if (data?.refresh_token && !data?.tokens?.refresh_token) {
      setRefreshToken(data.refresh_token)
      console.log("New refresh token set successfully (direct format)");
    }
    
    // Schedule next proactive refresh if we got a new access token
    if (newAccessToken) {
      tokenManager.scheduleTokenRefresh(newAccessToken);
    }
    
    return data
  } catch (error) {
    console.error('Refresh token failed:', error);
    throw error;
  }
}

export async function forgot_password(payload: Models.Auth_Forgot_password_Request, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/auth/forgot-password`, payload)
  return res.data
}

export async function reset_password(payload: Models.Auth_Reset_password_Request, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/auth/reset-password`, payload)
  return res.data
}

export async function register(payload: Models.Auth_Register_Request, params?: Record<string, any>): Promise<Models.Auth_Register_Response> {
  const res = await api.post(`/register`, payload)
  return res.data
}

export async function confirm_registration(payload: Models.Auth_Confirm_registration_Request, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/register/confirm`, payload)
  return res.data
}

export async function resend_confirmation(payload: Models.Auth_Resend_confirmation_Request, params?: Record<string, any>): Promise<any> {
  const res = await api.post(`/register/resend`, payload)
  return res.data
}

export async function getMe(): Promise<Models.Auth_Login_Response['user']> {
  const res = await api.get('/users/me');
  return res.data;
}