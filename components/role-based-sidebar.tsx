"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { hasPermission } from "@/lib/auth";
import { getMe } from "@/src/api/auth.api";
import * as RolesAPI from "@/src/api/roles.api";
import * as UserAPI from "@/src/api/users.api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AuthenticatedAvatarImage } from "@/components/authenticated-avatar-image";
import {
  LayoutDashboard,
  Users,
  Target,
  Handshake,
  Calendar,
  FileText,
  PenTool,
  MessageSquare,
  BarChart3,
  Bell,

  ChevronLeft,
  ChevronRight,
  Building2,
  UserCheck,
  Database,
  LogOut,
  Send,
  MessageCircle,
  User,
} from "lucide-react";
import type { Auth_Login_Response } from "@/src/models/Auth.model";

interface SidebarItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permissions: string[];
  badge?: string;
}

const sidebarItems: Record<string, SidebarItem[]> = {
  system_admin: [
    {
      title: "Лиды",
      href: "/leads",
      icon: Target,
      permissions: ["leads:read"],
    },
    {
      title: "Сделки",
      href: "/deals",
      icon: Handshake,
      permissions: ["deals:read"],
    },
    {
      title: "Клиенты",
      href: "/clients",
      icon: Users,
      permissions: ["clients:read"],
    },
    {
      title: "Задачи",
      href: "/tasks",
      icon: Calendar,
      permissions: ["tasks:read"],
    },
    {
      title: "Документы",
      href: "/documents",
      icon: FileText,
      permissions: ["documents:read"],
    },
    {
      title: "Пользователи",
      href: "/users",
      icon: UserCheck,
      permissions: ["users:read"],
    },
    {
      title: "Чат",
      href: "/chat",
      icon: MessageSquare,
      permissions: [],
    },
    {
      title: "Мессенджер",
      href: "/whatsapp",
      icon: MessageCircle,
      permissions: [],
    },
    {
      title: "Филиалы",
      href: "/branches",
      icon: Building2,
      permissions: ["settings:write"],
    },
  ],
  leadership: [
    {
      title: "Лиды",
      href: "/leads",
      icon: Target,
      permissions: ["leads:read"],
    },
    {
      title: "Сделки",
      href: "/deals",
      icon: Handshake,
      permissions: ["deals:read"],
    },
    {
      title: "Клиенты",
      href: "/clients",
      icon: Users,
      permissions: ["clients:read"],
    },
    {
      title: "Задачи",
      href: "/tasks",
      icon: Calendar,
      permissions: ["tasks:read"],
    },
    {
      title: "Документы",
      href: "/documents",
      icon: FileText,
      permissions: ["documents:read"],
    },
    {
      title: "Чат",
      href: "/chat",
      icon: MessageSquare,
      permissions: [],
    },
    {
      title: "Мессенджер",
      href: "/whatsapp",
      icon: MessageCircle,
      permissions: [],
    },
    {
      title: "Аналитика",
      href: "/analytics",
      icon: BarChart3,
      permissions: ["analytics:read"],
    },
  ],
  control: [
    {
      title: "Лиды",
      href: "/leads",
      icon: Target,
      permissions: ["leads:read"],
    },
    {
      title: "Сделки",
      href: "/deals",
      icon: Handshake,
      permissions: ["deals:read"],
    },
    {
      title: "Клиенты",
      href: "/clients",
      icon: Users,
      permissions: ["clients:read"],
    },
    {
      title: "Задачи",
      href: "/tasks",
      icon: Calendar,
      permissions: ["tasks:read"],
    },
    {
      title: "Документы",
      href: "/documents",
      icon: FileText,
      permissions: ["documents:read"],
    },
    {
      title: "Чат",
      href: "/chat",
      icon: MessageSquare,
      permissions: [],
    },
    {
      title: "Мессенджер",
      href: "/whatsapp",
      icon: MessageCircle,
      permissions: [],
    },
    {
      title: "Аналитика",
      href: "/analytics",
      icon: BarChart3,
      permissions: ["analytics:read"],
    },
  ],
  operations: [
    {
      title: "Лиды",
      href: "/leads",
      icon: Target,
      permissions: ["leads:read"],
    },
    {
      title: "Сделки",
      href: "/deals",
      icon: Handshake,
      permissions: ["deals:read"],
    },
    {
      title: "Клиенты",
      href: "/clients",
      icon: Users,
      permissions: ["clients:read"],
    },
    {
      title: "Задачи",
      href: "/tasks",
      icon: Calendar,
      permissions: ["tasks:read"],
    },
    {
      title: "Документы",
      href: "/documents",
      icon: FileText,
      permissions: ["documents:read"],
    },
    {
      title: "Чат",
      href: "/chat",
      icon: MessageSquare,
      permissions: [],
    },
    {
      title: "Мессенджер",
      href: "/whatsapp",
      icon: MessageCircle,
      permissions: [],
    },
  ],
  sales: [
    {
      title: "Лиды",
      href: "/leads",
      icon: Target,
      permissions: ["leads:read"],
    },
    {
      title: "Сделки",
      href: "/deals",
      icon: Handshake,
      permissions: ["deals:read"],
    },
    {
      title: "Клиенты",
      href: "/clients",
      icon: Users,
      permissions: ["clients:read"],
    },
    {
      title: "Задачи",
      href: "/tasks",
      icon: Calendar,
      permissions: ["tasks:read"],
    },
    {
      title: "Документы",
      href: "/documents",
      icon: FileText,
      permissions: ["documents:read"],
    },
    {
      title: "Чат",
      href: "/chat",
      icon: MessageSquare,
      permissions: [],
    },
    {
      title: "Мессенджер",
      href: "/whatsapp",
      icon: MessageCircle,
      permissions: [],
    },
  ],
};

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

function normalizeRoleCode(roleCode: string): string {
  roleCode = String(roleCode || '').trim().toLowerCase()
  // Map backend role codes to sidebar keys
  const codeMapping: Record<string, string> = {
    'admin': 'system_admin',
    'admin_staff': 'system_admin',
    'system_admin': 'system_admin',
    'leadership': 'leadership',
    'management': 'leadership', // legacy_name mapping
    'control': 'control',
    'operations': 'operations',
    'sales': 'sales',
  }
  return codeMapping[roleCode] || roleCode
}

function getRoleDisplayName(roleKey: string): string {
  const roleDisplayNames: Record<string, string> = {
    'system_admin': 'Системный администратор',
    'leadership': 'Руководство',
    'operations': 'Операционный отдел',
    'control': 'Отдел контроля',
    'sales': 'Отдел продаж',
    'user': 'Пользователь'
  }
  return roleDisplayNames[roleKey] || roleKey
}

function getUserInitials(user: Auth_Login_Response['user'] | null) {
  const source = user?.full_name || user?.legacy?.company_name || user?.email || "U";
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "U") + (parts[1]?.[0] || "");
}

export function RoleBasedSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const [user, setUser] = useState<Auth_Login_Response['user'] | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [availableRoles, setAvailableRoles] = useState<{ id: number, name: string }[]>([]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Force fresh data by clearing any cached user data
        localStorage.removeItem('current_user');
        
        // Fetch user data first
        const userDataResult = await getMe();
        setUser(userDataResult);
        
        console.log('User data from API:', userDataResult);
        
        // Only fetch roles if user is system_admin (to avoid 403 errors for other roles)
        let roles: { id: number, name: string }[] = [];
        if (userDataResult.role.id === 50) { // system_admin
          try {
            const rolesData = await RolesAPI.listRoles({ limit: 100 });
            roles = Array.isArray(rolesData) ? rolesData : rolesData.data || [];
            console.log('Roles data from API:', roles);
          } catch (err) {
            console.warn('Failed to fetch roles:', err);
          }
        }
        setAvailableRoles(roles);
        
        const userValue = userDataResult;
        console.log('=== ROLE DEBUG ===');
        console.log('Raw userData:', userValue);
        console.log('User role.id (type):', userValue.role.id, typeof userValue.role.id);
        console.log('Available roles from API:', roles);
        console.log('Role IDs in available roles:', roles.map(r => ({ id: r.id, name: r.name })));
        
        const role = roles.find(r => r.id === userValue.role.id);
        console.log('Found role in API roles:', role);
        
        // Show what admin panel would display
        const adminPanelRoleName = role ? role.name : "Неизвестная роль";
        console.log('Admin panel would show:', adminPanelRoleName);
        
        // Use API role code to match admin panel, fallback to hardcoded mapping
        const roleKey = normalizeRoleCode(userValue.role.code) || (role ? role.name.toLowerCase().replace(' ', '_') : getRoleFromId(userValue.role.id));
        setUserRole(roleKey);
        console.log('Using role key:', roleKey);
        console.log('Display name will be:', adminPanelRoleName || getRoleDisplayName(roleKey));
        
        // Test all possible mappings
        console.log('Testing all role mappings:');
        console.log('10 ->', getRoleFromId(10), '->', getRoleDisplayName(getRoleFromId(10)));
        console.log('15 ->', getRoleFromId(15), '->', getRoleDisplayName(getRoleFromId(15)));
        console.log('20 ->', getRoleFromId(20), '->', getRoleDisplayName(getRoleFromId(20)));
        console.log('30 ->', getRoleFromId(30), '->', getRoleDisplayName(getRoleFromId(30)));
        console.log('40 ->', getRoleFromId(40), '->', getRoleDisplayName(getRoleFromId(40)));
        console.log('50 ->', getRoleFromId(50), '->', getRoleDisplayName(getRoleFromId(50)));
        console.log('=== END ROLE DEBUG ===');
      } catch (error) {
        console.error("Failed to fetch user data", error);
      }
    };

    fetchUserData();
  }, []);

  if (!user) return null;

  // Get role key for permissions (fallback to hardcoded mapping for permissions)
  const userRoleKey = normalizeRoleCode(user.role.code) || getRoleFromId(user.role.id);
  
  // Get display name from API to match admin panel, fallback to hardcoded mapping
  const apiRoleName = availableRoles.find(r => r.id === user.role.id)?.name;
  const displayRole = apiRoleName || user.role.legacy_name || getRoleDisplayName(userRoleKey);
  
  console.log('Final role display:', {
    roleId: user.role.id,
    roleCode: user.role.code,
    apiRoleName,
    fallbackName: getRoleDisplayName(userRoleKey),
    finalDisplay: displayRole
  });
  
  // Get sidebar items for the user's role
  const roleSidebarItems = sidebarItems[userRoleKey] || sidebarItems['sales'];
  
  // Filter by permissions (though role-specific items should already have correct permissions)
  const filteredItems = roleSidebarItems.filter(
    (item: SidebarItem) =>
      item.permissions.length === 0 ||
      hasPermission(userRoleKey, item.permissions)
  );

  const handleLogout = () => {
    try {
      window.localStorage.removeItem("auth_token");
      window.localStorage.removeItem("refresh_token");
      window.localStorage.removeItem("current_user");
      window.localStorage.removeItem("current_company");
    } catch (e) { }
    window.location.href = "/auth/login";
  };

  return (
    <div
      className={cn(
        "bg-gradient-to-b from-slate-50 to-white border-r border-slate-200/60 transition-all duration-300 flex flex-col h-screen sticky top-0 z-30 shadow-soft",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="p-4 border-b border-slate-200/60">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 gradient-primary rounded-lg flex items-center justify-center shadow-md">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">CRM</span>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-all duration-200"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-slate-600" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-slate-600" />
            )}
          </button>
        </div>
      </div>

      {/* User Info */}
      {!isCollapsed && (
        <div className="p-4 border-b border-slate-200/60">
          <Link href="/profile" className="block">
            <div className="flex items-center space-x-3 mb-3 hover:bg-slate-50 rounded-lg p-2 transition-all duration-200 cursor-pointer">
              <Avatar className="w-10 h-10 shadow-md">
                <AuthenticatedAvatarImage src={(user as any).avatar_url || (user as any).avatar?.url} alt={user.full_name || user.email} className="h-full w-full object-cover" />
                <AvatarFallback className="gradient-primary text-white text-sm font-bold">{getUserInitials(user)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {user?.full_name || user?.legacy?.company_name}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {user?.email}
                </p>
                {user?.branch && (
                  <p className="text-xs text-slate-500 truncate">
                    🏢 {user.branch.name}
                  </p>
                )}
                <p className="text-xs font-semibold text-blue-600 truncate mt-0.5">
                  {displayRole}
                </p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto custom-scrollbar">
        {filteredItems.map((item, index) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 animate-fade-in",
                isActive
                  ? "gradient-primary text-white shadow-md hover:shadow-lg"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                isCollapsed && "justify-center px-2"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
              title={isCollapsed ? item.title : undefined}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 flex-shrink-0 transition-transform duration-200",
                  isActive ? "text-white" : "text-slate-500 group-hover:text-slate-700",
                  "group-hover:scale-110"
                )}
              />
              {!isCollapsed && (
                <span className="flex-1">{item.title}</span>
              )}
              {!isCollapsed && item.badge && (
                <span
                  className={cn(
                    "text-xs rounded-full px-2 py-0.5 font-medium",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-blue-100 text-blue-700"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200/60">
        {!isCollapsed ? (
          <div className="space-y-2">
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-2 px-3 py-2.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all duration-200"
            >
              <LogOut className="h-4 w-4" />
              <span>Выйти</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all duration-200"
            title="Выйти"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
