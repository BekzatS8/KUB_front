"use client";

import { RoleBasedSidebar } from "@/components/role-based-sidebar";
import { TaskNotifications } from "@/components/task-notifications";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <RoleBasedSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-gradient-to-br from-transparent to-white/50 relative">
          <div className="p-6 min-h-full">{children}</div>
        </main>
      </div>
      {/* Назойливые напоминания о задачах (ТЗ п.4.1) */}
      <TaskNotifications />
    </div>
  );
}
