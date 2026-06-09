"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, getRoleCode } from "@/lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Retry logic to wait for user data to be available
    let retries = 0;
    const maxRetries = 10;
    const checkUser = () => {
      const user = getCurrentUser();
      console.log('Dashboard redirect - user data:', user);
      console.log('Dashboard redirect - user role:', user?.role);
      console.log('Dashboard redirect - user role_id:', user?.role_id);

      // Fallback: try to decode role_id from JWT token
      let tokenRoleId = null;
      if (!user) {
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
          if (token) {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const decoded = JSON.parse(jsonPayload);
            tokenRoleId = decoded.role_id;
            console.log('Decoded role_id from token:', tokenRoleId);
          }
        } catch (e) {
          console.log('Failed to decode token:', e);
        }
      }

      // Redirect based on role
      const adminRoleIds = [50];
      if (getRoleCode(user) === 'system_admin') {
        console.log('Redirecting to /users based on role');
        router.push("/users");
      } else if (tokenRoleId && adminRoleIds.includes(tokenRoleId)) {
        console.log('Redirecting to /users based on token role_id');
        router.push("/users");
      } else {
        console.log('Redirecting to /leads');
        router.push("/leads");
      }
      setIsLoading(false);
    };

    checkUser();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center animate-fade-in">
        <div className="relative mb-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
          <div className="absolute inset-0 animate-pulse rounded-full h-16 w-16 bg-blue-400/20 blur-xl"></div>
        </div>
        <p className="text-lg font-medium text-slate-700">Перенаправление...</p>
      </div>
    </div>
  );
}
