import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function useAuthErrorHandler() {
  const { logout } = useAuth();

  const handleAuthError = useCallback(async (error: any) => {
    const message = error?.message || '';
    
    // Check for specific authentication error patterns
    if (message.includes('Session expired') || 
        message.includes('Token expired') || 
        message.includes('Unauthorized') ||
        message.includes('401')) {
      await logout('Your session has expired. Please login again.');
      return true; // Indicates this was an auth error
    }
    
    if (message.includes('Access forbidden') || 
        message.includes('permission') ||
        message.includes('403')) {
      // Don't logout for 403 errors, just show the message
      return true; // Indicates this was an auth error
    }
    
    return false; // Not an auth error
  }, [logout]);

  return { handleAuthError };
}
