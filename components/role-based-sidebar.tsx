"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRightLeft,
  BarChart3,
  Building2,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  GitBranch,
  Globe,
  Handshake,
  LogOut,
  MessageCircle,
  MessageSquare,
  Phone,
  Rss,
  Scale,
  Settings,
  ShieldCheck,
  Target,
  UserCheck,
  Users,
} from "lucide-react";

import { AuthenticatedAvatarImage } from "@/components/authenticated-avatar-image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getMe } from "@/src/api/auth.api";
import { getMyPermissions } from "@/src/api/permissions.api";
import { getChats } from "@/src/api/chat.api";
import { getMyNewTaskCount } from "@/src/api/tasks.api";
import type { Auth_Login_Response } from "@/src/models/Auth.model";
import type { PermissionsMe } from "@/src/models/permissions.model";
import { getRoleName } from "@/src/models/roles.enum";

// ── Types ──────────────────────────────────────────────────────────────────

interface NavItem {
  type: "item";
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  /** Only show for these role codes. Omit = show to all roles with permission. */
  roles?: string[];
  /** Show as greyed-out non-clickable placeholder */
  disabled?: boolean;
}

interface NavGroup {
  type: "group";
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Only show for these role codes */
  roles?: string[];
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

// ── Master menu config ─────────────────────────────────────────────────────
//
// Role codes: admin | sales | visa | partner | hr | legal | quality_control | management

const MENU: NavEntry[] = [
  // ── Flat items ────────────────────────────────────────────────────────────
  {
    // Лента — инструмент админа/руководства: заявки на подтверждение и события.
    // У менеджеров скрыта (ТЗ п.6.1)
    type: "item", title: "Лента", href: "/feed", icon: Rss,
    permission: "feed.view",
    roles: ["admin", "management"],
  },
  {
    type: "item", title: "Отчеты", href: "/analytics", icon: BarChart3,
    permission: "reports.view",
  },
  {
    // Личные отчёты-таблицы сотрудника (ТЗ п.3) — замена Excel на Яндекс.Диске
    type: "item", title: "Мои отчёты", href: "/reports/my", icon: ClipboardList,
    roles: ["sales", "visa", "partner", "quality_control", "hr", "legal"],
  },
  {
    // Отчёты всех сотрудников — руководству/админу/КК (ТЗ п.3)
    type: "item", title: "Отчёты сотрудников", href: "/reports/team", icon: ClipboardList,
    roles: ["admin", "management", "quality_control"],
  },
  {
    // Воронка лидов (ранее называлась «Сделки»). Все профильные отделы —
    // отдел продаж, визовый, партнёрский, а также КК/руководство — работают
    // со своими лидами карточками в канбане на /deals. Бэкенд сам отдаёт только
    // воронки отдела (funnel_service.List), поэтому каждый видит свой канбан
    // (обратная связь 10.07.2026, п.2). Право funnels.view есть у всех этих ролей
    // (у visa/partner нет deals.view — но канбан работает через лиды).
    type: "item", title: "Лиды", href: "/deals", icon: Target,
    permission: "funnels.view",
    roles: ["sales", "visa", "partner", "quality_control", "management"],
  },
  {
    type: "item", title: "Клиенты", href: "/clients", icon: Users,
    permission: "clients.view",
  },
  {
    type: "item", title: "Документы", href: "/documents", icon: FileText,
    permission: "documents.view",
  },
  {
    type: "item", title: "Задачи", href: "/tasks", icon: Calendar,
    permission: "tasks.view",
  },
  // HR-specific items (shown instead of generic Пользователи)
  {
    type: "item", title: "Сотрудники", href: "/users", icon: UserCheck,
    permission: "users.view",
    roles: ["hr"],
  },
  {
    type: "item", title: "Табель сотрудников", href: "/hr/timesheet", icon: ClipboardList,
    permission: "users.view",
    roles: ["hr"],
    disabled: true,
  },
  // Пользователи for management / legal (not admin — in Settings group; not hr — uses Сотрудники)
  {
    type: "item", title: "Пользователи", href: "/users", icon: UserCheck,
    permission: "users.view",
    roles: ["management", "legal"],
  },
  {
    type: "item", title: "Чат", href: "/chat", icon: MessageSquare,
    permission: "chat.view",
  },
  {
    type: "item", title: "Мессенджер", href: "/whatsapp", icon: MessageCircle,
    permission: "messenger.view",
  },
  {
    type: "item", title: "Телефония", href: "/telephony", icon: Phone,
    permission: "telephony.view",
  },

  // ── Department groups ─────────────────────────────────────────────────────
  {
    type: "group", title: "Отдел продаж", icon: Target,
    roles: ["admin", "quality_control", "management"],
    children: [
      { type: "item", title: "Лиды", href: "/deals?department=sales", icon: Target, permission: "deals.view" },
      {
        type: "item", title: "Документы", href: "/documents?department=sales", icon: FileText,
        permission: "documents.view",
        roles: ["admin", "management"],
      },
    ],
  },
  {
    type: "group", title: "Визовый отдел", icon: Globe,
    roles: ["admin", "quality_control", "management"],
    children: [
      { type: "item", title: "Лиды", href: "/leads?department=visa", icon: Target, permission: "leads.view" },
      {
        type: "item", title: "Документы", href: "/documents?department=visa", icon: FileText,
        permission: "documents.view",
        roles: ["admin", "management"],
      },
    ],
  },
  {
    type: "group", title: "Партнёрский отдел", icon: Handshake,
    roles: ["admin", "quality_control", "management"],
    children: [
      { type: "item", title: "Лиды", href: "/leads?department=partner", icon: Target, permission: "leads.view" },
      {
        type: "item", title: "Документы", href: "/documents?department=partner", icon: FileText,
        permission: "documents.view",
        roles: ["admin", "management"],
      },
    ],
  },
  {
    type: "group", title: "Отдел кадров", icon: Users,
    roles: ["admin"],
    children: [
      { type: "item", title: "Сотрудники", href: "/users?department=hr", icon: UserCheck, permission: "users.view" },
      {
        type: "item", title: "Табель сотрудников", href: "/hr/timesheet", icon: ClipboardList,
        permission: "users.view", disabled: true,
      },
      { type: "item", title: "Документы", href: "/documents?department=hr", icon: FileText, permission: "documents.view" },
    ],
  },
  {
    type: "group", title: "Юридический отдел", icon: Scale,
    roles: ["admin"],
    children: [
      { type: "item", title: "Клиенты", href: "/clients?department=legal", icon: Users, permission: "clients.view" },
      { type: "item", title: "Документы", href: "/documents?department=legal", icon: FileText, permission: "documents.view" },
      { type: "item", title: "Пользователи", href: "/users?department=legal", icon: UserCheck, permission: "users.view" },
    ],
  },
  {
    type: "group", title: "Контроль качества", icon: ShieldCheck,
    roles: ["admin"],
    children: [
      { type: "item", title: "Лиды", href: "/deals?department=quality_control", icon: Target, permission: "deals.view" },
      { type: "item", title: "Документы", href: "/documents?department=quality_control", icon: FileText, permission: "documents.view" },
    ],
  },
  {
    type: "group", title: "Руководство", icon: Building2,
    roles: ["admin", "management"],
    children: [
      { type: "item", title: "Документы", href: "/documents?department=management", icon: FileText, permission: "documents.view" },
      { type: "item", title: "Пользователи", href: "/users?department=management", icon: UserCheck, permission: "users.view" },
      { type: "item", title: "Отчеты", href: "/analytics", icon: BarChart3, permission: "reports.view" },
    ],
  },
  {
    type: "group", title: "Настройки", icon: Settings,
    roles: ["admin"],
    children: [
      { type: "item", title: "Организация", href: "/settings/organization", icon: Settings, permission: "branches.view" },
      { type: "item", title: "Филиалы", href: "/branches", icon: Building2, permission: "branches.view" },
      { type: "item", title: "Воронки", href: "/settings/funnels", icon: GitBranch, permission: "funnels.view" },
      { type: "item", title: "Переходы между воронками", href: "/settings/funnel-transitions", icon: ArrowRightLeft, permission: "funnels.update" },
      { type: "item", title: "Пользователи", href: "/users", icon: UserCheck, permission: "users.view" },
    ],
  },
];

// ── Fallback permissions derived from MENU (used when /permissions/me fails) ─

function deriveFallbackActions(roleCode: string): string[] {
  const actions = new Set<string>();
  for (const entry of MENU) {
    if (entry.roles && !entry.roles.includes(roleCode)) continue;
    if (entry.type === "item") {
      if (entry.permission) actions.add(entry.permission);
    } else {
      for (const child of entry.children) {
        if (child.roles && !child.roles.includes(roleCode)) continue;
        if (child.permission) actions.add(child.permission);
      }
    }
  }
  return Array.from(actions);
}

// ── Role helpers ─────────────────────────────────────────────────────────────

function normalizeRoleCode(code?: string): string {
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

function roleCodeFromUser(user: Auth_Login_Response["user"] | null): string {
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


function getUserInitials(user: Auth_Login_Response["user"] | null): string {
  const source = user?.full_name || user?.legacy?.company_name || user?.email || "U";
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "U") + (parts[1]?.[0] || "");
}

// ── Active state helpers ──────────────────────────────────────────────────────

function parseHref(href: string): { path: string; dept: string | null } {
  try {
    const url = new URL(href, "http://x");
    return { path: url.pathname, dept: url.searchParams.get("department") };
  } catch {
    return { path: href, dept: null };
  }
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function RoleBasedSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [user, setUser] = useState<Auth_Login_Response["user"] | null>(null);
  const [permissions, setPermissions] = useState<PermissionsMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [currentDept, setCurrentDept] = useState<string | null>(null);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [taskNewCount, setTaskNewCount] = useState(0);
  const pathname = usePathname();

  // Track department query param reactively
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setCurrentDept(params.get("department"));
    }
  }, [pathname]);

  // Load user + permissions
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const [userData, permData] = await Promise.all([
          getMe(),
          getMyPermissions().catch(() => null),
        ]);
        if (cancelled) return;
        setUser(userData);
        setPermissions(permData);
      } catch {
        // handled below with isLoading fallback
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Fetch total unread chat count once user is loaded
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getChats()
      .then((chats) => {
        if (cancelled) return;
        const total = (Array.isArray(chats) ? chats : []).reduce(
          (sum, c) => sum + (c.unread_count || 0),
          0
        );
        setChatUnreadCount(total);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  // Fetch new task count assigned to current user
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    getMyNewTaskCount(user.id)
      .then((count) => { if (!cancelled) setTaskNewCount(count); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  // Live-обновление бейджа «Задачи» от поллера уведомлений (ТЗ п.4.1)
  useEffect(() => {
    const onCount = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail?.count === "number") setTaskNewCount(detail.count);
    };
    window.addEventListener("kub:task-open-count", onCount);
    return () => window.removeEventListener("kub:task-open-count", onCount);
  }, []);

  const roleCode = roleCodeFromUser(user);

  const permissionSet = useMemo<Set<string>>(() => {
    if (permissions?.permissions?.length) {
      return new Set(permissions.permissions.map((p) => p.action));
    }
    return new Set(deriveFallbackActions(roleCode));
  }, [permissions, roleCode]);

  // ── Visibility helpers ───────────────────────────────────────────────────

  function canSeeItem(item: NavItem): boolean {
    if (item.roles && !item.roles.includes(roleCode)) return false;
    if (item.permission && !permissionSet.has(item.permission)) return false;
    return true;
  }

  function visibleChildrenOf(group: NavGroup): NavItem[] {
    return group.children.filter((child) =>
      (!child.roles || child.roles.includes(roleCode)) &&
      (!child.permission || permissionSet.has(child.permission))
    );
  }

  function canSeeGroup(group: NavGroup): boolean {
    if (group.roles && !group.roles.includes(roleCode)) return false;
    return visibleChildrenOf(group).length > 0;
  }

  // ── Active state ─────────────────────────────────────────────────────────

  function isItemActive(href: string): boolean {
    const { path, dept } = parseHref(href);
    if (dept) {
      return pathname === path && currentDept === dept;
    }
    return pathname === path || pathname.startsWith(path + "/");
  }

  // ── Auto-expand groups containing the current route ──────────────────────

  useEffect(() => {
    if (!user) return;
    const toOpen: string[] = [];
    for (const entry of MENU) {
      if (entry.type !== "group") continue;
      const hasActive = entry.children.some((child) => {
        const { path, dept } = parseHref(child.href);
        if (dept) return pathname === path && currentDept === dept;
        return pathname === path || pathname.startsWith(path + "/");
      });
      if (hasActive) toOpen.push(entry.title);
    }
    if (toOpen.length > 0) {
      setOpenGroups((prev) => new Set([...prev, ...toOpen]));
    }
  }, [pathname, currentDept, user]);

  function toggleGroup(title: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  const handleLogout = () => {
    window.localStorage.removeItem("auth_token");
    window.localStorage.removeItem("refresh_token");
    window.localStorage.removeItem("current_user");
    window.localStorage.removeItem("current_company");
    window.location.href = "/auth/login";
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="sticky top-0 z-30 flex h-screen w-64 flex-col border-r border-slate-200/60 bg-white shadow-soft">
        <div className="border-b border-slate-200/60 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
        <div className="border-b border-slate-200/60 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1.5 p-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </nav>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div
      className={cn(
        "sticky top-0 z-30 flex h-screen flex-col border-r border-slate-200/60 bg-white shadow-soft transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* ── Header ── */}
      <div className="border-b border-slate-200/60 p-4">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              {/* Логотип без шестерёнки: сотрудники принимали её за кнопку
                  настроек и постоянно нажимали (ТЗ п.7.4) */}
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-md">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">KUB CRM</span>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="rounded-lg p-2 transition-colors hover:bg-slate-100"
            aria-label={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
          >
            {isCollapsed
              ? <ChevronRight className="h-4 w-4 text-slate-600" />
              : <ChevronLeft className="h-4 w-4 text-slate-600" />}
          </button>
        </div>
      </div>

      {/* ── User profile ── */}
      {!isCollapsed && (
        <div className="border-b border-slate-200/60 p-4">
          <Link href="/profile" className="block rounded-lg p-2 transition-colors hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 shadow-md">
                <AuthenticatedAvatarImage
                  src={(user as any).avatar_url || (user as any).avatar?.url}
                  alt={user.full_name || user.email}
                  className="h-full w-full object-cover"
                />
                <AvatarFallback className="bg-blue-600 text-sm font-bold text-white">
                  {getUserInitials(user)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {user.full_name || user.legacy?.company_name || user.email}
                </p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-blue-600">
                  {getRoleName(user.role.id)}
                </p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="custom-scrollbar flex-1 space-y-0.5 overflow-y-auto p-3">
        {MENU.map((entry) => {
          // ── Flat item ──
          if (entry.type === "item") {
            if (!canSeeItem(entry)) return null;
            const active = isItemActive(entry.href);

            if (entry.disabled) {
              return (
                <div
                  key={`item-${entry.href}-${entry.title}`}
                  title={isCollapsed ? `${entry.title} (в разработке)` : undefined}
                  className={cn(
                    "flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium opacity-40",
                    isCollapsed && "justify-center px-2"
                  )}
                >
                  <entry.icon className="h-5 w-5 shrink-0 text-slate-400" />
                  {!isCollapsed && (
                    <span className="min-w-0 flex-1 truncate text-slate-400">{entry.title}</span>
                  )}
                  {!isCollapsed && (
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">
                      скоро
                    </span>
                  )}
                </div>
              );
            }

            const isChatItem = entry.href === "/chat";
            const isTaskItem = entry.href === "/tasks";
            const unread = isChatItem ? chatUnreadCount : isTaskItem ? taskNewCount : 0;

            return (
              <Link
                key={`item-${entry.href}-${entry.title}`}
                href={entry.href}
                title={isCollapsed ? entry.title : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                  isCollapsed && "justify-center px-2"
                )}
              >
                <span className="relative shrink-0">
                  <entry.icon className={cn("h-5 w-5", active ? "text-white" : "text-slate-500")} />
                  {isCollapsed && unread > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-red-500" />
                  )}
                </span>
                {!isCollapsed && <span className="min-w-0 flex-1 truncate">{entry.title}</span>}
                {!isCollapsed && unread > 0 && (
                  <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            );
          }

          // ── Group ──
          if (!canSeeGroup(entry)) return null;
          const children = visibleChildrenOf(entry);
          const isOpen = openGroups.has(entry.title);
          const groupHasActive = children.some((c) => isItemActive(c.href));

          // Collapsed: show only the group icon as a passive indicator
          if (isCollapsed) {
            return (
              <div
                key={`group-${entry.title}`}
                title={entry.title}
                className={cn(
                  "flex justify-center rounded-lg px-2 py-2.5",
                  groupHasActive ? "bg-blue-50" : "hover:bg-slate-100"
                )}
              >
                <entry.icon
                  className={cn("h-5 w-5 shrink-0", groupHasActive ? "text-blue-600" : "text-slate-500")}
                />
              </div>
            );
          }

          return (
            <div key={`group-${entry.title}`}>
              {/* Group header button */}
              <button
                onClick={() => toggleGroup(entry.title)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  groupHasActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <entry.icon
                    className={cn("h-5 w-5 shrink-0", groupHasActive ? "text-blue-600" : "text-slate-500")}
                  />
                  <span className="min-w-0 truncate">{entry.title}</span>
                </div>
                <ChevronDown
                  className={cn(
                    "ml-1 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </button>

              {/* Group children */}
              {isOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-200 pl-3">
                  {children.map((child) => {
                    const childActive = isItemActive(child.href);

                    if (child.disabled) {
                      return (
                        <div
                          key={`child-${child.href}-${child.title}`}
                          title="В разработке"
                          className="flex cursor-not-allowed items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium opacity-40"
                        >
                          <child.icon className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1 truncate text-slate-400">{child.title}</span>
                          <span className="shrink-0 rounded bg-slate-100 px-1 text-[10px] text-slate-400">
                            скоро
                          </span>
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={`child-${child.href}-${child.title}`}
                        href={child.href}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                          childActive
                            ? "bg-blue-600 text-white"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        )}
                      >
                        <child.icon
                          className={cn("h-4 w-4 shrink-0", childActive ? "text-white" : "text-slate-400")}
                        />
                        <span className="truncate">{child.title}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Logout ── */}
      <div className="border-t border-slate-200/60 p-3">
        <button
          onClick={handleLogout}
          title="Выйти"
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-700",
            isCollapsed && "justify-center px-2"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span>Выйти</span>}
        </button>
      </div>
    </div>
  );
}
