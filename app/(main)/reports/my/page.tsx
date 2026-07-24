"use client";

/**
 * «Мои отчёты» (ТЗ 04.07.2026, п.3): личные редактируемые таблицы сотрудника —
 * замена Excel-отчётов на Яндекс.Диске. Сотрудник заводит сколько угодно
 * отчётов и даёт каждому имя; руководитель выбирает, какой открыть.
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArchiveRestore, FileSpreadsheet, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ReportTableEditor } from "@/components/report-table-editor";
import {
  createMyReportTable,
  deleteMyReportTable,
  getMyReportTable,
  listMyReportTables,
  listMyReportTrash,
  purgeMyReportTable,
  restoreMyReportTable,
  saveMyReportTable,
  type ManagerReport,
  type ReportTableContent,
} from "@/src/api/reports-table.api";

export default function MyReportsPage() {
  const [reports, setReports] = useState<ManagerReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [active, setActive] = useState<ManagerReport | null>(null);
  const [activeLoading, setActiveLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // диалог создания/переименования: reportId === null → создаём новый
  const [nameDialog, setNameDialog] = useState<{ reportId: number | null; value: string } | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManagerReport | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<ManagerReport | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = showTrash ? await listMyReportTrash() : await listMyReportTables();
      const items = res.items || [];
      setReports(items);
      // открываем первый отчёт, если ни один ещё не выбран (только для активных)
      if (!showTrash) setActiveId((prev) => prev ?? items[0]?.id ?? null);
    } catch (err: any) {
      toast.error(err?.message || "Не удалось загрузить список отчётов");
    } finally {
      setLoading(false);
    }
  }, [showTrash]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (activeId === null) {
      setActive(null);
      return;
    }
    let cancelled = false;
    setActiveLoading(true);
    getMyReportTable(activeId)
      .then((rep) => {
        if (!cancelled) setActive(rep);
      })
      .catch((err: any) => {
        if (!cancelled) toast.error(err?.message || "Не удалось загрузить отчёт");
      })
      .finally(() => {
        if (!cancelled) setActiveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const handleSave = async (content: ReportTableContent) => {
    if (!active) return;
    setSaving(true);
    try {
      await saveMyReportTable(active.id, content);
      const updatedAt = new Date().toISOString();
      setActive({ ...active, content, updated_at: updatedAt });
      setReports((prev) => prev.map((r) => (r.id === active.id ? { ...r, updated_at: updatedAt } : r)));
      toast.success("Отчёт сохранён");
    } catch (err: any) {
      toast.error(err?.message || "Не удалось сохранить отчёт");
    } finally {
      setSaving(false);
    }
  };

  const submitName = async () => {
    if (!nameDialog) return;
    const title = nameDialog.value.trim();
    if (!title) {
      toast.error("Введите название отчёта");
      return;
    }
    setNameSaving(true);
    try {
      if (nameDialog.reportId === null) {
        const created = await createMyReportTable(title);
        setReports((prev) => [created, ...prev]);
        setActiveId(created.id);
        toast.success("Отчёт создан");
      } else {
        const target = reports.find((r) => r.id === nameDialog.reportId);
        // переименование идёт тем же PUT — шлём текущее содержимое обратно
        const content =
          (active?.id === nameDialog.reportId ? active?.content : undefined) ??
          (await getMyReportTable(nameDialog.reportId)).content;
        await saveMyReportTable(nameDialog.reportId, content as ReportTableContent, title);
        setReports((prev) => prev.map((r) => (r.id === nameDialog.reportId ? { ...r, title } : r)));
        setActive((prev) => (prev && prev.id === nameDialog.reportId ? { ...prev, title } : prev));
        toast.success(`Отчёт «${target?.title ?? title}» переименован`);
      }
      setNameDialog(null);
    } catch (err: any) {
      toast.error(err?.message || "Не удалось сохранить название");
    } finally {
      setNameSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMyReportTable(deleteTarget.id);
      const rest = reports.filter((r) => r.id !== deleteTarget.id);
      setReports(rest);
      if (activeId === deleteTarget.id) setActiveId(rest[0]?.id ?? null);
      toast.success("Отчёт перемещён в корзину");
    } catch (err: any) {
      toast.error(err?.message || "Не удалось удалить отчёт");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleRestore = async (r: ManagerReport) => {
    try {
      await restoreMyReportTable(r.id);
      setReports((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Отчёт восстановлен из корзины");
    } catch (err: any) {
      toast.error(err?.message || "Не удалось восстановить отчёт");
    }
  };

  const confirmPurge = async () => {
    if (!purgeTarget) return;
    try {
      await purgeMyReportTable(purgeTarget.id);
      setReports((prev) => prev.filter((x) => x.id !== purgeTarget.id));
      toast.success("Отчёт удалён окончательно");
    } catch (err: any) {
      toast.error(err?.message || "Не удалось удалить отчёт");
    } finally {
      setPurgeTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Мои отчёты</h1>
          <p className="text-sm text-slate-600">
            Ежедневные отчёты: дата, клиент, телефон, пометки. Можно вести несколько отчётов —
            руководитель выбирает, какой открыть.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showTrash ? "default" : "outline"}
            onClick={() => { setActiveId(null); setShowTrash((v) => !v); }}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {showTrash ? "К отчётам" : "Корзина"}
          </Button>
          {!showTrash && (
            <Button onClick={() => setNameDialog({ reportId: null, value: "" })}>
              <Plus className="mr-1.5 h-4 w-4" />
              Новый отчёт
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 opacity-40" />
            {showTrash ? (
              <p>Корзина пуста</p>
            ) : (
              <>
                <p className="mb-4">У вас пока нет отчётов</p>
                <Button variant="outline" onClick={() => setNameDialog({ reportId: null, value: "" })}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Создать первый отчёт
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : showTrash ? (
        /* Корзина — вертикальный список с восстановлением/удалением */
        <div className="space-y-2">
          {reports.map((r) => (
            <div
              key={r.id}
              className="group flex items-center gap-1 rounded-lg border bg-white p-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{r.title}</p>
                {r.updated_at && (
                  <p className="text-xs text-slate-500">
                    {format(new Date(r.updated_at), "d MMM yyyy, HH:mm", { locale: ru })}
                  </p>
                )}
              </div>
              <button
                type="button"
                title="Восстановить"
                onClick={() => handleRestore(r)}
                className="rounded p-1.5 text-slate-400 hover:bg-green-50 hover:text-green-600"
              >
                <ArchiveRestore className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Удалить навсегда"
                onClick={() => setPurgeTarget(r)}
                className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Активные отчёты: вкладки-отчёты сверху, таблица — на всю ширину страницы */
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {reports.map((r) => (
              <div
                key={r.id}
                className={`group flex items-center gap-0.5 rounded-lg border px-2 py-1.5 transition-colors ${
                  r.id === activeId ? "border-blue-300 bg-blue-50" : "bg-white hover:bg-slate-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveId(r.id)}
                  className="max-w-[220px] truncate text-left text-sm font-medium text-slate-900"
                  title={r.title}
                >
                  {r.title}
                </button>
                <button
                  type="button"
                  title="Переименовать"
                  onClick={() => setNameDialog({ reportId: r.id, value: r.title })}
                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Удалить отчёт"
                  onClick={() => setDeleteTarget(r)}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="min-w-0">
            {activeLoading || !active ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : (
              <ReportTableEditor
                key={active.id}
                content={active.content as ReportTableContent}
                saving={saving}
                onSave={handleSave}
              />
            )}
          </div>
        </div>
      )}

      <Dialog open={!!nameDialog} onOpenChange={(open) => !open && setNameDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {nameDialog?.reportId === null ? "Новый отчёт" : "Переименовать отчёт"}
            </DialogTitle>
            <DialogDescription>
              Название видно вам и руководителю в списке отчётов.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="report-title">Название</Label>
            <Input
              id="report-title"
              autoFocus
              value={nameDialog?.value ?? ""}
              placeholder="Например: Отчёт за июль"
              onChange={(e) =>
                setNameDialog((prev) => (prev ? { ...prev, value: e.target.value } : prev))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && !nameSaving) submitName();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameDialog(null)} disabled={nameSaving}>
              Отмена
            </Button>
            <Button onClick={submitName} disabled={nameSaving}>
              {nameSaving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить отчёт «{deleteTarget?.title}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Отчёт переместится в корзину. Его можно будет восстановить или удалить окончательно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!purgeTarget} onOpenChange={(open) => !open && setPurgeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить отчёт «{purgeTarget?.title}» навсегда?</AlertDialogTitle>
            <AlertDialogDescription>
              Таблица и все её строки будут удалены безвозвратно. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPurge}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Удалить навсегда
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
