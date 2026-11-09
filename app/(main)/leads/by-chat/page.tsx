"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { find_lead_by_chat } from "@/src/api/leads.api";

// Кнопка «Профиль» в шапке чата мессенджера (ТЗ «доработки CRM КУБ», п.4).
// Wazzup ведёт сюда по ссылке контакта: находим последний открытый лид
// контакта и подменяем адрес на его карточку (вкладка «Обзор»), поэтому
// «Назад» в браузере возвращает в тот же чат. Лида нет — «Лид не найден».
function LeadByChatInner() {
  const router = useRouter();
  const params = useSearchParams();
  const transport = params.get("transport") || "whatsapp";
  const chatId = params.get("chat_id") || params.get("phone") || "";
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!chatId) {
      setNotFound(true);
      return;
    }
    let cancelled = false;
    find_lead_by_chat(transport, chatId)
      .then((id) => {
        if (cancelled) return;
        if (id) router.replace(`/leads/${id}`);
        else setNotFound(true);
      })
      .catch(() => !cancelled && setNotFound(true));
    return () => {
      cancelled = true;
    };
  }, [transport, chatId, router]);

  if (!notFound) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <UserX className="mb-3 h-12 w-12 text-slate-300" />
      <h1 className="text-lg font-semibold text-slate-800">Лид не найден</h1>
      <p className="mt-1 text-sm text-slate-500">У этого контакта нет открытого лида или он вам недоступен.</p>
      <Button variant="outline" className="mt-4 gap-2" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" />
        Назад к чату
      </Button>
    </div>
  );
}

export default function LeadByChatPage() {
  return (
    <Suspense fallback={null}>
      <LeadByChatInner />
    </Suspense>
  );
}
