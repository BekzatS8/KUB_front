import { User } from '@/src/models/User.model'
import { Client } from '@/src/models/Client.model'
import { tokenManager } from '@/lib/token-manager'

// Функции для работы с пользователем
export function setCurrentUser(user: User): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('current_user', JSON.stringify(user))
    }
  } catch (e) {
    console.error('Ошибка при сохранении пользователя:', e)
  }
}

export function getCurrentUser(): User | null {
  try {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem('current_user')
      return data ? JSON.parse(data) : null
    }
  } catch (e) {
    console.error('Ошибка при получении пользователя:', e)
  }
  return null
}

// Функции для работы с компанией
export function setCurrentCompany(company: Client): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('current_company', JSON.stringify(company))
    }
  } catch (e) {
    console.error('Ошибка при сохранении компании:', e)
  }
}

export function getCurrentCompany(): Client | null {
  try {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem('current_company')
      return data ? JSON.parse(data) : null
    }
  } catch (e) {
    console.error('Ошибка при получении компании:', e)
  }
  return null
}

// Очистка всех данных авторизации
export function clearAuthData(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('current_user')
      localStorage.removeItem('current_company')
      localStorage.removeItem('auth_token')
      localStorage.removeItem('refresh_token')
      // Clear token refresh timer
      tokenManager.clearRefreshTimer()
    }
  } catch (e) {
    console.error('Ошибка при очистке данных авторизации:', e)
  }
}

// Token validation utilities
export function getStoredTokens(): { accessToken: string | null; refreshToken: string | null } {
  try {
    if (typeof window !== 'undefined') {
      const accessToken = localStorage.getItem('auth_token')
      const refreshToken = localStorage.getItem('refresh_token')
      return { accessToken, refreshToken }
    }
  } catch (e) {
    console.error('Ошибка при получении токенов:', e)
  }
  return { accessToken: null, refreshToken: null }
}

export function isTokenValid(token: string): boolean {
  if (!token) return false
  return !tokenManager.isTokenExpiringSoon(token)
}

export function getTokenExpiryTime(token: string): number {
  return tokenManager.getTimeUntilExpiry(token)
}

export function initializeTokenRefresh(): void {
  tokenManager.initializeTokenRefresh()
}

export function normalizeRoleCode(roleCode?: string | null): string | undefined {
  const normalized = String(roleCode || '').trim().toLowerCase()
  if (!normalized) return undefined

  const codeMapping: Record<string, string> = {
    admin: 'system_admin',
    admin_staff: 'system_admin',
    system_admin: 'system_admin',
    systemadmin: 'system_admin',
    management: 'leadership',
    manager: 'leadership',
    leadership: 'leadership',
    control: 'control',
    operations: 'operations',
    operation: 'operations',
    sales: 'sales',
    seller: 'sales',
  }

  return codeMapping[normalized] || normalized
}

export function getRoleKeyFromId(roleId?: number | string | null): string {
  const roleMapping: Record<number, string> = {
    50: 'system_admin',
    40: 'leadership',
    30: 'control',
    20: 'operations',
    10: 'sales',
  }
  return roleMapping[Number(roleId || 0)] || 'user'
}

export function getRoleCode(user: any): string | undefined {
  if (!user) return undefined
  if (typeof user.role === 'string') return normalizeRoleCode(user.role)
  if (user.role?.code) return normalizeRoleCode(user.role.code)
  if (user.role?.id) return getRoleKeyFromId(user.role.id)
  if (user.role_id) return getRoleKeyFromId(user.role_id)
  return undefined
}

// Функция для проверки прав доступа
export function hasPermission(userRole: string | undefined, requiredPermissions: string[]): boolean {
  userRole = normalizeRoleCode(userRole)

  // Если пользователь не авторизован или нет роли
  if (!userRole) {
    return false;
  }

  // Если нет требуемых разрешений, разрешаем доступ
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  // Маппинг ролей к разрешениям согласно требованиям к уровням доступа (backend RBAC)
  const rolePermissions: Record<string, string[]> = {
    system_admin: [
      // Системный администратор: CanManageSystem, CanAssignRoles, CanAccessLogs, CanManageIntegrations
      'users:read',
      'users:write',
      'leads:read',
      'leads:write',
      'deals:read',
      'deals:write',
      'clients:read',
      'clients:write',
      'tasks:read',
      'tasks:write',
      'documents:read',
      'documents:write',
      'analytics:read',
      'analytics:write',
      'settings:read',
      'settings:write',
    ],
    leadership: [
      // Руководство: CanViewLeadershipData, CanViewAllBusinessData, CanProcessDocuments, CanWorkWithLeads
      'users:read',
      'leads:read',
      'leads:write',
      'deals:read',
      'deals:write',
      'clients:read',
      'clients:write',
      'tasks:read',
      'tasks:write',
      'documents:read',
      'documents:write',
      'analytics:read',
      'analytics:write',
    ],
    control: [
      // Отдел контроля: CanViewAllBusinessData (read-only)
      'leads:read',
      'deals:read',
      'clients:read',
      'tasks:read',
      'documents:read',
      'analytics:read',
    ],
    operations: [
      // Операционный отдел: CanViewAllBusinessData, CanProcessDocuments, CanWorkWithLeads
      'leads:read',
      'leads:write',
      'deals:read',
      'deals:write',
      'clients:read',
      'clients:write',
      'tasks:read',
      'tasks:write',
      'documents:read',
      'documents:write',
    ],
    sales: [
      // Отдел продаж: CanWorkWithLeads
      'leads:read',
      'leads:write',
      'deals:read',
      'deals:write',
      'clients:read',
      'clients:write',
      'tasks:read',
      'tasks:write',
      'documents:read',
      'documents:write',
    ],
  };

  // Получаем разрешения для роли пользователя
  const userPermissions = rolePermissions[userRole] || [];

  // Проверяем, есть ли у пользователя все требуемые разрешения
  return requiredPermissions.every(permission => 
    userPermissions.includes(permission)
  );
}

// Функция для проверки роли
export function hasRole(userRole: string | undefined, requiredRoles: string[]): boolean {
  userRole = normalizeRoleCode(userRole)
  if (!userRole) return false;
  return requiredRoles.map((role) => normalizeRoleCode(role)).includes(userRole);
}

// Функция для получения роли пользователя в текстовом формате
export function getUserRoleText(role: string | undefined): string {
  role = normalizeRoleCode(role)
  const roleMap: Record<string, string> = {
    system_admin: 'Системный администратор',
    leadership: 'Руководство',
    control: 'Отдел контроля',
    operations: 'Операционный отдел',
    sales: 'Отдел продаж',
  };
  
  return roleMap[role ?? ''] ?? role ?? 'Пользователь';
}

// Функция для проверки авторизации пользователя
export function isAuthenticated(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      const user = getCurrentUser();
      return !!(token && user);
    }
    return false;
  } catch (e) {
    console.error('Ошибка при проверке авторизации:', e);
    return false;
  }
}

// Functions for testing roles (dev only)
export function switchTestRole(roleCode: string): void {
  const currentUser = getCurrentUser();
  if (currentUser && typeof window !== 'undefined') {
    // Store original role if not already stored
    if (!localStorage.getItem('original_user_role')) {
      localStorage.setItem('original_user_role', JSON.stringify(currentUser.role));
    }
    
    // Map role code to role object
    const roleMapping: Record<string, { id: number; code: string; legacy_name: string }> = {
      'system_admin': { id: 50, code: 'system_admin', legacy_name: 'Системный администратор' },
      'leadership': { id: 40, code: 'leadership', legacy_name: 'Руководство' },
      'control': { id: 30, code: 'control', legacy_name: 'Отдел контроля' },
      'operations': { id: 20, code: 'operations', legacy_name: 'Операционный отдел' },
      'sales': { id: 10, code: 'sales', legacy_name: 'Отдел продаж' },
    };
    
    const updatedUser = { ...currentUser, role: roleMapping[roleCode] || currentUser.role, role_id: roleMapping[roleCode]?.id };
    setCurrentUser(updatedUser);
    window.location.reload();
  }
}

export function resetTestRole(): void {
  if (typeof window !== 'undefined') {
    const originalRoleStr = localStorage.getItem('original_user_role');
    const currentUser = getCurrentUser();
    
    if (currentUser && originalRoleStr) {
      try {
        const originalRole = JSON.parse(originalRoleStr);
        const updatedUser = { ...currentUser, role: originalRole, role_id: originalRole.id };
        setCurrentUser(updatedUser);
        localStorage.removeItem('original_user_role');
        window.location.reload();
      } catch (e) {
        console.error('Failed to parse original role:', e);
      }
    } else if (currentUser) {
      // Fallback if original role not found, reset to system_admin
      const updatedUser = { ...currentUser, role: { id: 50, code: 'system_admin', legacy_name: 'Системный администратор' }, role_id: 50 };
      setCurrentUser(updatedUser);
      window.location.reload();
    }
  }
}
