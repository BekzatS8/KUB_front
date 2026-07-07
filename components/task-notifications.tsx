"use client";

/**
 * Назойливые уведомления о задачах (ТЗ 04.07.2026, п.4.1).
 *
 * Каждую минуту опрашивает /tasks/notifications. Если у пользователя есть
 * открытые задачи, по которым пора напомнить (ни разу не показывали, либо
 * показывали больше часа назад, либо сработало «Напоминание» задачи) —
 * показывает модальное окно по центру экрана со звуковым сигналом.
 * Закрытие окна ставит отметку показа: пока задача не выполнена, окно
 * вернётся через час. Счётчик открытых задач транслируется в сайдбар
 * (бейдж у пункта «Задачи») через CustomEvent.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BellRing, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { get_task_notifications, ack_task_notifications } from "@/src/api/tasks.api";

const POLL_INTERVAL_MS = 60_000;
export const TASK_COUNT_EVENT = "kub:task-open-count";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий",
  urgent: "Срочный",
};

const PRIORITY_CLASSNAMES: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  normal: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

interface DueTask {
  id: number;
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  due_date?: string | null;
  reminder_at?: string | null;
}

function playAlertSound() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    // two short beeps
    [0, 0.35].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.32);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {
    // autoplay policy may block sound before first user gesture — ignore
  }
}

export function TaskNotifications() {
  const router = useRouter();
  const [dueTasks, setDueTasks] = useState<DueTask[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const baseTitleRef = useRef<string | null>(null);
  const openRef = useRef(false);
  openRef.current = isOpen;

  const broadcastCount = (count: number) => {
    window.dispatchEvent(new CustomEvent(TASK_COUNT_EVENT, { detail: { count } }));
    if (baseTitleRef.current === null) baseTitleRef.current = document.title;
    const base = baseTitleRef.current.replace(/^\(\d+\)\s*/, "");
    document.title = count > 0 ? `(${count}) ${base}` : base;
  };

  const poll = useCallback(async () => {
    try {
      const data = await get_task_notifications();
      broadcastCount(data?.open_count ?? 0);
      const due = (data?.due ?? []) as DueTask[];
      // не подменяем список, пока пользователь смотрит на открытое окно
      if (due.length > 0 && !openRef.current) {
        setDueTasks(due);
        setIsOpen(true);
        playAlertSound();
      }
    } catch {
      // сеть/авторизация — молча ждём следующего цикла
    }
  }, []);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  const acknowledge = async () => {
    const ids = dueTasks.map((t) => t.id);
    setIsOpen(false);
    try {
      if (ids.length > 0) await ack_task_notifications({ task_ids: ids });
    } catch {
      // при ошибке ack окно просто появится снова на следующем опросе
    }
  };

  const goToTasks = async () => {
    await acknowledge();
    router.push("/tasks");
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) acknowledge();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 animate-pulse text-red-500" />
            Напоминание о задачах ({dueTasks.length})
          </DialogTitle>
          <DialogDescription>
            У вас есть невыполненные задачи. Окно будет напоминать каждый час,
            пока задача не будет выполнена.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {dueTasks.map((task) => (
            <div key={task.id} className="rounded-lg border bg-amber-50/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-gray-900">{task.title}</span>
                {task.priority && (
                  <Badge className={`shrink-0 text-xs ${PRIORITY_CLASSNAMES[task.priority] || ""}`}>
                    {PRIORITY_LABELS[task.priority] || task.priority}
                  </Badge>
                )}
              </div>
              {task.description && (
                <p className="mt-1 line-clamp-2 text-xs text-gray-600">{task.description}</p>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                {task.due_date && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    до {format(new Date(task.due_date), "d MMM yyyy HH:mm", { locale: ru })}
                  </span>
                )}
                {task.reminder_at && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    напоминание {format(new Date(task.reminder_at), "d MMM HH:mm", { locale: ru })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={acknowledge}>
            Скрыть (напомнит через час)
          </Button>
          <Button onClick={goToTasks}>Перейти к задачам</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
