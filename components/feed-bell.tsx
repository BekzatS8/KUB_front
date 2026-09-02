"use client";

/**
 * Плавающий колокольчик Ленты заявок. Показывает число «ожидающих» событий:
 *  - у ревьюеров (админ/руководство/контроль) — заявки на одобрение;
 *  - у остальных — их собственные заявки в ожидании (напр. документ на проверке).
 * Опрашивает Ленту раз в 15с; при появлении новых заявок у ревьюера играет звук.
 * Клик — переход в Ленту. Прячется, если нет доступа к Ленте.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { listFeedEvents } from "@/src/api/feed.api";
import { getCurrentUser, getRoleCode } from "@/lib/auth";
import { playNotificationSound } from "@/lib/notification-sound";

const POLL_MS = 15000;

export function FeedBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const prev = useRef<number | null>(null);

  const roleCode = getRoleCode(getCurrentUser());
  const isReviewer =
    roleCode === "system_admin" ||
    roleCode === "management" ||
    roleCode === "quality_control";

  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      try {
        const res: any = await listFeedEvents({ status: "pending", size: 100 });
        const items = res?.items ?? (Array.isArray(res) ? res : []);
        const total = typeof res?.total === "number" ? res.total : items.length;
        if (stopped) return;
        setVisible(true);
        setCount(total);
        // Звук только ревьюеру и только при РОСТЕ числа заявок (новое на одобрение).
        if (prev.current !== null && total > prev.current && isReviewer) {
          playNotificationSound("feed");
        }
        prev.current = total;
      } catch {
        if (!stopped) setVisible(false); // нет доступа к Ленте — прячем
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [isReviewer]);

  if (!visible) return null;

  return (
    <button
      onClick={() => router.push("/feed")}
      className="fixed bottom-16 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border bg-white/90 text-slate-600 shadow-sm backdrop-blur hover:bg-white hover:text-slate-900"
      title="Лента заявок"
      aria-label="Лента заявок"
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-none text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
