import { refresh_token } from '@/src/api/auth.api'
import { setAuthToken, setRefreshToken } from '@/src/api/index'

// JWT token utilities
export class TokenManager {
  private static instance: TokenManager
  private refreshTimer: NodeJS.Timeout | null = null

  private constructor() {}

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager()
    }
    return TokenManager.instance
  }

  // Parse JWT token to get expiration time
  parseToken(token: string): { exp: number; iat: number } | null {
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
      return JSON.parse(jsonPayload)
    } catch (error) {
      console.error('Error parsing JWT token:', error)
      return null
    }
  }

  // Check if token is expired or will expire soon (within 5 minutes)
  isTokenExpiringSoon(token: string): boolean {
    const parsed = this.parseToken(token)
    if (!parsed) return true

    const currentTime = Math.floor(Date.now() / 1000)
    const timeUntilExpiry = parsed.exp - currentTime
    
    // Refresh if token expires within 5 minutes (300 seconds)
    return timeUntilExpiry < 300
  }

  // Get time until token expires in seconds
  getTimeUntilExpiry(token: string): number {
    const parsed = this.parseToken(token)
    if (!parsed) return 0

    const currentTime = Math.floor(Date.now() / 1000)
    return Math.max(0, parsed.exp - currentTime)
  }

  // Schedule proactive token refresh
  scheduleTokenRefresh(accessToken: string): void {
    // Clear any existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
    }

    const timeUntilExpiry = this.getTimeUntilExpiry(accessToken)
    
    if (timeUntilExpiry === 0) {
      console.log('Token is already expired, will refresh on next API call')
      return
    }

    // Schedule refresh 5 minutes before expiry
    const refreshDelay = Math.max(0, (timeUntilExpiry - 300) * 1000)
    
    console.log(`Scheduling token refresh in ${Math.round(refreshDelay / 1000)} seconds`)
    
    this.refreshTimer = setTimeout(async () => {
      try {
        await this.proactiveRefresh()
      } catch (error) {
        console.error('Proactive token refresh failed:', error)
      }
    }, refreshDelay)
  }

  // Perform proactive token refresh
  async proactiveRefresh(): Promise<void> {
    if (typeof window === 'undefined') return

    const refreshToken = localStorage.getItem('refresh_token') || 
                       this.getCookie('refresh_token')
    
    if (!refreshToken) {
      console.log('No refresh token available for proactive refresh')
      return
    }

    try {
      console.log('Performing proactive token refresh...')
      const { refresh_token } = await import('@/src/api/auth.api')
      const response = await refresh_token({ refresh_token: refreshToken })
      
      // Reschedule next refresh if we got a new access token
      const newAccessToken = response?.tokens?.access_token || response?.access_token
      if (newAccessToken) {
        this.scheduleTokenRefresh(newAccessToken)
        console.log('Proactive token refresh completed successfully')
      } else {
        console.warn('Proactive refresh completed but no new access token received')
      }
    } catch (error) {
      console.error('Proactive token refresh failed:', error)
      // Don't logout here, let the interceptor handle it on next API call
      // But clear the timer to prevent repeated failed attempts
      this.clearRefreshTimer()
    }
  }

  // Initialize token refresh scheduling
  initializeTokenRefresh(): void {
    if (typeof window === 'undefined') return

    const accessToken = localStorage.getItem('auth_token') || 
                       this.getCookie('auth_token')
    
    if (accessToken) {
      if (this.isTokenExpiringSoon(accessToken)) {
        console.log('Token is expiring soon, attempting immediate refresh')
        this.proactiveRefresh().catch(error => {
          console.error('Immediate refresh failed:', error)
        })
      } else {
        this.scheduleTokenRefresh(accessToken)
      }
    } else {
      console.log('No access token found for initialization')
    }
  }

  // Clear refresh timer
  clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  // Simple cookie helper (client-side only)
  private getCookie(name: string): string | null {
    try {
      if (typeof window === 'undefined') return null
      const match = document.cookie.split('; ').find((row) => row.startsWith(name + '='))
      return match ? decodeURIComponent(match.split('=')[1]) : null
    } catch (e) {
      console.error('Error getting cookie:', e)
      return null
    }
  }
}

// Export singleton instance
export const tokenManager = TokenManager.getInstance()

// Hook for React components
export function useTokenManager() {
  return {
    scheduleTokenRefresh: (token: string) => tokenManager.scheduleTokenRefresh(token),
    initializeTokenRefresh: () => tokenManager.initializeTokenRefresh(),
    clearRefreshTimer: () => tokenManager.clearRefreshTimer(),
    isTokenExpiringSoon: (token: string) => tokenManager.isTokenExpiringSoon(token),
    getTimeUntilExpiry: (token: string) => tokenManager.getTimeUntilExpiry(token),
    proactiveRefresh: () => tokenManager.proactiveRefresh()
  }
}
