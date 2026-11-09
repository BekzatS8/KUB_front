"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import * as leadsApi from "@/src/api/leads.api";
import type { LeadHistoryEntry } from "@/src/api/leads.api";

// История лида (ТЗ «доработки CRM КУБ», п.3): изменения краткой информации,
// передача в продажи, возврат с причиной, объединение, смена этапа.

const FIELD_LABELS: Record<string, string> = {
  brief_full_name: "ФИО клиента",
  brief_country: "Страна",
  brief_visa_type: "Тип визы",
  brief_city: "Город",
  brief_age: "Возраст",
  brief_comment: "Комментарий",
  stage: "Этап",
  owner: "Ответственный",
};

function describe(e: LeadHistoryEntry): string {
  switch (e.action) {
    case "brief_update":
      return `Изменено поле «${FIELD_LABELS[e.field || ""] || e.field}»`;
    case "handed_to_sales":
      return "Передан в отдел продаж";
    case "returned":
      return "Лид возвращён в общую очередь";
    case "merged":
      return `Объединён: влит лид ${e.new_value || ""}`;
    case "merged_into":
      return `Влит в лид ${e.new_value || ""}`;
    case "stage_moved":
      return "Смена этапа";
    default:
      return e.action;
  }
}

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ru-KZ", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function LeadHistorySection({ leadId, reloadKey }: { leadId: number; reloadKey?: number }) {
  const [items, setItems] = useState<LeadHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    leadsApi
      .get_lead_history(leadId)
      .then((list) => !cancelled && setItems(list))
      .catch((err) => !cancelled && setError(err?.message || "Не удалось загрузить историю"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [leadId, reloadKey]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }
  if (error) return <p className="py-8 text-center text-sm text-destructive">{error}</p>;
  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <History className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">Изменений пока нет</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((e) => (
        <Card key={e.id} className="p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium">{describe(e)}</span>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(e.created_at)}
              {e.user_name ? ` · ${e.user_name}` : ""}
            </span>
          </div>
          {(e.old_value || e.new_value) && e.action !== "merged" && e.action !== "merged_into" && (
            <div className="mt-1 text-sm text-muted-foreground">
              <span className="line-through decoration-slate-300">{e.old_value || "—"}</span>
              {" → "}
              <span className="text-foreground">{e.new_value || "—"}</span>
            </div>
          )}
          {e.comment && (
            <div className="mt-1 text-sm">
              <span className="text-muted-foreground">Причина: </span>
              {e.comment}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
