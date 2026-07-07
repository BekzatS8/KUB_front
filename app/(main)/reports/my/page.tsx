"use client";

/**
 * «Мой отчёт» (ТЗ 04.07.2026, п.3): личная редактируемая таблица сотрудника —
 * замена Excel-отчётов на Яндекс.Диске.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportTableEditor } from "@/components/report-table-editor";
import {
  getMyReportTable,
  saveMyReportTable,
  type ManagerReport,
  type ReportTableContent,
} from "@/src/api/reports-table.api";

export default function MyReportPage() {
  const [report, setReport] = useState<ManagerReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyReportTable()
      .then(setReport)
      .catch((err: any) => toast.error(err?.message || "Не удалось загрузить отчёт"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (content: ReportTableContent) => {
    setSaving(true);
    try {
      await saveMyReportTable(content);
      setReport((prev) => (prev ? { ...prev, content, updated_at: new Date().toISOString() } : prev));
      toast.success("Отчёт сохранён");
    } catch (err: any) {
      toast.error(err?.message || "Не удалось сохранить отчёт");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Мой отчёт</h1>
        <p className="text-sm text-slate-600">
          Ежедневный отчёт: дата, клиент, телефон, пометки. Руководитель видит этот отчёт.
          {report?.updated_at && (
            <> Обновлён: {format(new Date(report.updated_at), "d MMMM yyyy, HH:mm", { locale: ru })}</>
          )}
        </p>
      </div>
      {loading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : (
        <ReportTableEditor
          content={report?.content as ReportTableContent}
          saving={saving}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
