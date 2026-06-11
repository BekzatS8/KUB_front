"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  GitBranch,
  Handshake,
  LogOut,
  MessageCircle,
  MessageSquare,
  Phone,
  Rss,
  Settings,
  Target,
  UserCheck,
  Users,
} from "lucide-react";

import { AuthenticatedAvatarImage } from "@/components/authenticated-avatar-image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getMe } from "@/src/api/auth.api";
import { getMyPermissions } from "@/src/api/permissions.api";
import type { Auth_Login_Response } from "@/src/models/Auth.model";
import type { PermissionsMe } from "@/src/models/permissions.model";

interface SidebarItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: string;
  adminOnly?: boolean;
}

const items: SidebarItem[] = [
  { title: "Лента", href: "/feed", icon: Rss, action: "feed.view" },
  { title: "Отчеты", href: "/analytics", icon: BarChart3, action: "reports.view" },
  { title: "Документы", href: "/documents", icon: FileText, action: "documents.view" },
  { title: "Задачи", href: "/tasks", icon: Calendar, action: "tasks.view" },
  { title: "Клиенты", href: "/clients", icon: Users, action: "clients.view" },
  { title: "Чат", href: "/chat", icon: MessageSquare, action: "chat.view" },
  { title: "Мессенджер", href: "/whatsapp", icon: MessageCircle, action: "messenger.view" },
  { title: "Телефония", href: "/telegram", icon: Phone, action: "telephony.view" },
  { title: "Лиды", href: "/leads", icon: Target, action: "leads.view" },
  { title: "Сделки", href: "/deals", icon: Handshake, action: "deals.view" },
  { title: "Воронки", href: "/settings/funnels", icon: GitBranch, action: "funnels.view", adminOnly: true },
  { title: "Пользователи", href: "/users", icon: UserCheck, action: "users.view", adminOnly: true },
  { title: "Филиалы", href: "/branches", icon: Building2, action: "branches.view", adminOnly: true },
];

const roleFallbackActions: Record<string, string[]> = {
  admin: items.map((item) => item.action).filter(Boolean) as string[],
  system_admin: items.map((item) => item.action).filter(Boolean) as string[],
  leadership: [
    "feed.view",
    "reports.view",
    "documents.view",
    "tasks.view",
    "clients.view",
    "chat.view",
    "messenger.view",
    "telephony.view",
    "leads.view",
    "deals.view",
  ],
  management: [
    "feed.view",
    "reports.view",
    "documents.view",
    "tasks.view",
    "clients.view",
    "chat.view",
    "messenger.view",
    "telephony.view",
    "leads.view",
    "deals.view",
  ],
  control: ["feed.view", "reports.view", "documents.view", "tasks.view", "clients.view", "chat.view", "messenger.view", "leads.view", "deals.view"],
  quality_control: ["feed.view", "reports.view", "documents.view", "tasks.view", "clients.view", "chat.view", "messenger.view", "leads.view", "deals.view"],
  sales: ["feed.view", "documents.view", "tasks.view", "clients.view", "chat.view", "messenger.view", "telephony.view", "leads.view", "deals.view"],
  visa: ["feed.view", "documents.view", "tasks.view", "clients.view", "chat.view", "messenger.view", "leads.view", "deals.view"],
  partner: ["feed.view", "documents.view", "tasks.view", "clients.view", "chat.view", "messenger.view", "leads.view", "deals.view"],
  hr: ["feed.view", "documents.view", "tasks.view", "chat.view"],
  legal: ["feed.view", "documents.view", "tasks.view", "chat.view"],
};

function normalizeRoleCode(code?: string) {
  const normalized = String(code || "").trim().toLowerCase();
  const mapping: Record<string, string> = {
    admin_staff: "admin",
    system_admin: "admin",
    leadership: "management",
    manager: "management",
    audit: "quality_control",
    control: "quality_control",
  };
  return mapping[normalized] || normalized;
}

function roleCodeFromUser(user: Auth_Login_Response["user"] | null) {
  const byCode = normalizeRoleCode(user?.role?.code);
  if (byCode) return byCode;
  const byID: Record<number, string> = {
    10: "sales",
    30: "quality_control",
    40: "management",
    50: "admin",
    60: "visa",
    70: "partner",
    80: "hr",
    90: "legal",
  };
  return byID[user?.role?.id || 0] || "";
}

function roleDisplayName(roleCode: string, user: Auth_Login_Response["user"] | null) {
  if (user?.role?.legacy_name) return user.role.legacy_name;
  const labels: Record<string, string> = {
    admin: "Администратор",
    management: "Руководство",
    quality_control: "Контроль качества",
    sales: "Отдел продаж",
    visa: "Визовый отдел",
    partner: "Партнерский отдел",
    hr: "Отдел кадров",
    legal: "Юридический отдел",
  };
  return labels[roleCode] || "Пользователь";
}

function getUserInitials(user: Auth_Login_Response["user"] | null) {
  const source = user?.full_name || user?.legacy?.company_name || user?.email || "U";
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "U") + (parts[1]?.[0] || "");
}

export function RoleBasedSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [user, setUser] = useState<Auth_Login_Response["user"] | null>(null);
  const [permissions, setPermissions] = useState<PermissionsMe | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [userData, permissionData] = await Promise.all([
          getMe(),
          getMyPermissions().catch(() => null),
        ]);
        if (cancelled) return;
        setUser(userData);
        setPermissions(permissionData);
      } catch (error) {
        console.error("Failed to load sidebar data", error);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const roleCode = roleCodeFromUser(user);
  const permissionSet = useMemo(() => {
    if (permissions?.permissions?.length) {
      return new Set(permissions.permissions.map((permission) => permission.action));
    }
    return new Set(roleFallbackActions[roleCode] || []);
  }, [permissions, roleCode]);

  const visibleItems = items.filter((item) => {
    if (item.adminOnly && roleCode !== "admin") return false;
    return !item.action || permissionSet.has(item.action);
  });

  const handleLogout = () => {
    window.localStorage.removeItem("auth_token");
    window.localStorage.removeItem("refresh_token");
    window.localStorage.removeItem("current_user");
    window.localStorage.removeItem("current_company");
    window.location.href = "/auth/login";
  };

  if (!user) return null;

  return (
    <div
      className={cn(
        "sticky top-0 z-30 flex h-screen flex-col border-r border-slate-200/60 bg-white shadow-soft transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="border-b border-slate-200/60 p-4">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-md">
                <Settings className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">KUB CRM</span>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="rounded-lg p-2 transition-colors hover:bg-slate-100"
            aria-label={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-600" /> : <ChevronLeft className="h-4 w-4 text-slate-600" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="border-b border-slate-200/60 p-4">
          <Link href="/profile" className="block rounded-lg p-2 transition-colors hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 shadow-md">
                <AuthenticatedAvatarImage src={(user as any).avatar_url || (user as any).avatar?.url} alt={user.full_name || user.email} className="h-full w-full object-cover" />
                <AvatarFallback className="bg-blue-600 text-sm font-bold text-white">{getUserInitials(user)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{user.full_name || user.legacy?.company_name || user.email}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-blue-600">{roleDisplayName(roleCode, user)}</p>
              </div>
            </div>
          </Link>
        </div>
      )}

      <nav className="custom-scrollbar flex-1 space-y-1.5 overflow-y-auto p-3">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-blue-600 text-white shadow-md" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                isCollapsed && "justify-center px-2"
              )}
              title={isCollapsed ? item.title : undefined}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "text-slate-500")} />
              {!isCollapsed && <span className="min-w-0 truncate">{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200/60 p-3">
        <button
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-700",
            isCollapsed && "justify-center px-2"
          )}
          title="Выйти"
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span>Выйти</span>}
        </button>
      </div>
    </div>
  );
}
