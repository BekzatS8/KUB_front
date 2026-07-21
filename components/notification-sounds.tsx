"use client";

/**
 * Глобальные звуковые уведомления: проигрывают сигнал при появлении
 * НОВЫХ лидов, сообщений в мессенджере (Wazzup), сообщений в чате и новых
 * задач. Опрашивает счётчики раз в 15с и сравнивает с предыдущим значением;
 * задачи берём из уже существующего события TASK_COUNT_EVENT (без лишнего
 * опроса). Первый цикл только фиксирует базу — на нём не звучит.
 *
 * Звук по политике браузеров можно проигрывать только после жеста
 * пользователя, поэтому «разблокируем» аудио на первом клике/нажатии.
 */

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { getChats } from "@/src/api/chat.api";
import { getWazzupDialogs } from "@/src/api/integrations_wazzup.api";
import { list_leads, list_my_leads } from "@/src/api/leads.api";
import { TASK_COUNT_EVENT } from "@/components/task-notifications";
import {
  playNotificationSound,
  unlockNotificationSound,
  type NotificationSoundType,
} from "@/lib/notification-sound";

const POLL_MS = 15000;
const TRANSPORTS = ["whatsapp", "telegram", "instagram"];
const MUTE_KEY = "kub:notify-sound";

export function NotificationSounds() {
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  // Базовые значения счётчиков. null = ещё не инициализировано (на первом
  // опросе просто запоминаем, звук не играем).
  const chatUnread = useRef<number | null>(null);
  const msgUnread = useRef<number | null>(null);
  const leadTotal = useRef<number | null>(null);
  const taskCount = useRef<number | null>(null);

  const beep = (type: NotificationSoundType) => {
    if (!mutedRef.current) playNotificationSound(type);
  };

  // Читаем сохранённую настройку «выключен ли звук».
  useEffect(() => {
    setMuted(localStorage.getItem(MUTE_KEY) === "off");
  }, []);

  // Разблокировка аудио на первом жесте пользователя.
  useEffect(() => {
    const unlock = () => unlockNotificationSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Новые задачи — из существующего события (TaskNotifications уже опрашивает
  // /tasks/notifications и рассылает open_count).
  useEffect(() => {
    const onTask = (e: Event) => {
      const count = (e as CustomEvent)?.detail?.count ?? 0;
      if (taskCount.current !== null && count > taskCount.current) beep("task");
      taskCount.current = count;
    };
    window.addEventListener(TASK_COUNT_EVENT, onTask as EventListener);
    return () => window.removeEventListener(TASK_COUNT_EVENT, onTask as EventListener);
  }, []);

  // Опрос чата, мессенджера и лидов.
  useEffect(() => {
    let stopped = false;

    const readLeadsTotal = async (): Promise<number | null> => {
      const params = { page: 1, size: 1, status_group: "active" };
      try {
        const res: any = await list_leads(undefined, params);
        return res?.pagination?.total ?? res?.total ?? null;
      } catch (e: any) {
        if (e?.response?.status === 403) {
          try {
            const res: any = await list_my_leads(undefined, params);
            return res?.pagination?.total ?? res?.total ?? null;
          } catch {
            return null;
          }
        }
        return null;
      }
    };

    const poll = async () => {
      // Чат
      try {
        const chats: any[] = await getChats();
        const total = (chats || []).reduce((s, c) => s + (c?.unread_count || 0), 0);
        if (chatUnread.current !== null && total > chatUnread.current) beep("chat");
        chatUnread.current = total;
      } catch {
        /* нет доступа/сеть — пропускаем */
      }

      // Мессенджер (Wazzup): суммируем непрочитанные по всем транспортам.
      try {
        let total = 0;
        for (const tr of TRANSPORTS) {
          try {
            const res: any = await getWazzupDialogs(tr);
            const items: any[] = res?.value ?? [];
            total += items.reduce((s, d) => s + (d?.unread_count || 0), 0);
          } catch {
            /* транспорт не настроен — пропускаем */
          }
        }
        if (msgUnread.current !== null && total > msgUnread.current) beep("messenger");
        msgUnread.current = total;
      } catch {
        /* пропускаем */
      }

      // Новые лиды (рост числа активных лидов).
      const total = await readLeadsTotal();
      if (total !== null) {
        if (leadTotal.current !== null && total > leadTotal.current) beep("lead");
        leadTotal.current = total;
      }
    };

    poll();
    const timer = setInterval(() => {
      if (!stopped) poll();
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem(MUTE_KEY, next ? "off" : "on");
    if (!next) unlockNotificationSound();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={muted ? "Звук уведомлений выключен" : "Звук уведомлений включён"}
      className="fixed bottom-4 right-4 z-40 flex h-9 w-9 items-center justify-center rounded-full border bg-white/90 text-gray-500 shadow-sm backdrop-blur hover:bg-white hover:text-gray-800"
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}
