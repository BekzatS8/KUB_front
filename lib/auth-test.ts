// Authentication flow test utilities
// This file contains helper functions to test authentication scenarios

import { getStoredTokens, isAuthenticated } from './auth';
import { tokenManager } from './token-manager';

export interface AuthTestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

export class AuthTester {
  static async runTests(): Promise<AuthTestResult[]> {
    const results: AuthTestResult[] = [];

    // Test 1: Check token storage
    results.push(this.testTokenStorage());

    // Test 2: Check authentication status
    results.push(this.testAuthenticationStatus());

    // Test 3: Check token parsing
    results.push(this.testTokenParsing());

    // Test 4: Check token expiry detection
    results.push(this.testTokenExpiry());

    return results;
  }

  private static testTokenStorage(): AuthTestResult {
    try {
      const tokens = getStoredTokens();
      
      return {
        testName: 'Token Storage',
        passed: typeof tokens === 'object' && 'accessToken' in tokens && 'refreshToken' in tokens,
        message: tokens.accessToken ? 'Access token found' : 'No access token',
        details: {
          hasAccessToken: !!tokens.accessToken,
          hasRefreshToken: !!tokens.refreshToken
        }
      };
    } catch (error) {
      return {
        testName: 'Token Storage',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private static testAuthenticationStatus(): AuthTestResult {
    try {
      const authStatus = isAuthenticated();
      
      return {
        testName: 'Authentication Status',
        passed: typeof authStatus === 'boolean',
        message: authStatus ? 'User is authenticated' : 'User is not authenticated',
        details: { authStatus }
      };
    } catch (error) {
      return {
        testName: 'Authentication Status',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private static testTokenParsing(): AuthTestResult {
    try {
      const tokens = getStoredTokens();
      
      if (!tokens.accessToken) {
        return {
          testName: 'Token Parsing',
          passed: true,
          message: 'No token to parse (expected for unauthenticated state)'
        };
      }

      const parsed = tokenManager.parseToken(tokens.accessToken);
      
      return {
        testName: 'Token Parsing',
        passed: !!parsed,
        message: parsed ? 'Token parsed successfully' : 'Failed to parse token',
        details: {
          hasExp: !!parsed?.exp,
          hasIat: !!parsed?.iat,
          exp: parsed?.exp
        }
      };
    } catch (error) {
      return {
        testName: 'Token Parsing',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private static testTokenExpiry(): AuthTestResult {
    try {
      const tokens = getStoredTokens();
      
      if (!tokens.accessToken) {
        return {
          testName: 'Token Expiry Detection',
          passed: true,
          message: 'No token to check (expected for unauthenticated state)'
        };
      }

      const isExpiring = tokenManager.isTokenExpiringSoon(tokens.accessToken);
      const timeUntilExpiry = tokenManager.getTimeUntilExpiry(tokens.accessToken);
      
      return {
        testName: 'Token Expiry Detection',
        passed: typeof isExpiring === 'boolean' && typeof timeUntilExpiry === 'number',
        message: isExpiring ? 'Token is expiring soon' : `Token valid for ${timeUntilExpiry} seconds`,
        details: {
          isExpiring,
          timeUntilExpiry,
          timeUntilExpiryMinutes: Math.round(timeUntilExpiry / 60)
        }
      };
    } catch (error) {
      return {
        testName: 'Token Expiry Detection',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  static printResults(results: AuthTestResult[]): void {
    console.group('🔐 Authentication Test Results');
    
    results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.testName}: ${result.message}`);
      
      if (result.details) {
        console.log('   Details:', result.details);
      }
    });
    
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    
    console.log(`\n📊 Summary: ${passedCount}/${totalCount} tests passed`);
    console.groupEnd();
  }
}

// Run tests in browser console
if (typeof window !== 'undefined') {
  (window as any).testAuth = async () => {
    const results = await AuthTester.runTests();
    AuthTester.printResults(results);
    return results;
  };
}
