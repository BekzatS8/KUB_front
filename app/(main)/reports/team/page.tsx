"use client";

/**
 * «Отчёты сотрудников» (ТЗ 04.07.2026, п.3): руководитель/админ/КК открывают
 * отчёт любого сотрудника в один клик — не нужно ждать пересылок в WhatsApp.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowLeft, FileSpreadsheet, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportTableEditor } from "@/components/report-table-editor";
import {
  getUserReportTable,
  listReportTables,
  type ManagerReport,
  type ReportTableContent,
} from "@/src/api/reports-table.api";

export default function TeamReportsPage() {
  const [reports, setReports] = useState<ManagerReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ManagerReport | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);

  const load = () => {
    setLoading(true);
    listReportTables()
      .then((res) => setReports(res.items || []))
      .catch((err: any) => toast.error(err?.message || "Не удалось загрузить список отчётов"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openReport = async (userId: number) => {
    setSelectedLoading(true);
    try {
      setSelected(await getUserReportTable(userId));
    } catch (err: any) {
      toast.error(err?.message || "Не удалось открыть отчёт");
    } finally {
      setSelectedLoading(false);
    }
  };

  if (selected || selectedLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            К списку
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Отчёт: {selected?.user_name || "..."}
            </h1>
            {selected?.updated_at && (
              <p className="text-xs text-slate-500">
                Обновлён {format(new Date(selected.updated_at), "d MMMM yyyy, HH:mm", { locale: ru })}
              </p>
            )}
          </div>
        </div>
        {selectedLoading ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : (
          <ReportTableEditor content={selected!.content as ReportTableContent} readOnly />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Отчёты сотрудников</h1>
          <p className="text-sm text-slate-600">
            Личные отчёты-таблицы менеджеров: нажмите, чтобы открыть
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 opacity-40" />
            Сотрудники ещё не вели отчёты
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <button
              key={r.user_id}
              type="button"
              onClick={() => openReport(r.user_id)}
              className="rounded-lg border bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-8 w-8 shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{r.user_name || `Сотрудник #${r.user_id}`}</p>
                  {r.updated_at && (
                    <p className="text-xs text-slate-500">
                      Обновлён {format(new Date(r.updated_at), "d MMM yyyy, HH:mm", { locale: ru })}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
