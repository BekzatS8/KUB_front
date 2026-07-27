"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { RoleBasedSidebar } from "@/components/role-based-sidebar";
import { TaskNotifications } from "@/components/task-notifications";
import { NotificationSounds } from "@/components/notification-sounds";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Закрываем мобильное меню при переходе на другую страницу.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <RoleBasedSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      {/* Затемнение под drawer на мобильном/планшете */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Мобильная/планшетная верхняя панель с кнопкой-гамбургером (<lg) */}
        <header className="flex items-center gap-3 border-b border-slate-200/60 bg-white/80 px-3 py-2 backdrop-blur lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-700 transition-colors hover:bg-slate-100"
            aria-label="Открыть меню"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img
            src="/ziperion-logo.png"
            alt="Ziperion Business Platform"
            className="h-7 w-auto max-w-[150px] object-contain"
          />
        </header>

        <main className="custom-scrollbar relative flex-1 overflow-y-auto bg-gradient-to-br from-transparent to-white/50">
          <div className="min-h-full p-3 sm:p-4 lg:p-6">{children}</div>
        </main>
      </div>

      {/* Назойливые напоминания о задачах (ТЗ п.4.1) */}
      <TaskNotifications />
      {/* Звуковые сигналы: новые лиды, сообщения мессенджера/чата, задачи */}
      <NotificationSounds />
    </div>
  );
}
