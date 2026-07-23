"use client";

/**
 * «Отчёты сотрудников» (ТЗ 04.07.2026, п.3): руководитель/админ/КК открывают
 * отчёты любого сотрудника — не нужно ждать пересылок в WhatsApp.
 * У сотрудника может быть несколько именованных отчётов, поэтому путь такой:
 * сотрудник → его отчёты → выбранный отчёт.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArchiveRestore, ArrowLeft, FileSpreadsheet, RefreshCw, User, Download, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ReportTableEditor } from "@/components/report-table-editor";
import { getCurrentUser, getRoleCode } from "@/lib/auth";
import { getMe } from "@/src/api/auth.api";
import {
  getReportTable,
  listReportTableOwners,
  listUserReportTables,
  saveReportTable,
  deleteReportTable,
  exportReportTable,
  listReportTrash,
  restoreReportTable,
  purgeReportTable,
  type ManagerReport,
  type ManagerReportOwner,
  type ReportTableContent,
} from "@/src/api/reports-table.api";

export default function TeamReportsPage() {
  // isAdmin реактивен: сразу берём роль из кэша (сразу после логина она может
  // быть ещё не проставлена в current_user), затем подтягиваем свежего
  // пользователя с сервера. Раньше isAdmin вычислялся синхронно ОДИН раз и на
  // первом заходе был false → кнопки «Редактировать/Удалить» не показывались,
  // пока не сходишь на другую страницу (которая обновляла current_user).
  const [isAdmin, setIsAdmin] = useState(
    () => getRoleCode(getCurrentUser()) === "system_admin"
  );

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((me) => {
        if (!cancelled) setIsAdmin(getRoleCode(me) === "system_admin");
      })
      .catch(() => {
        /* оставляем значение из кэша */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [owners, setOwners] = useState<ManagerReportOwner[]>([]);
  const [loading, setLoading] = useState(true);

  const [owner, setOwner] = useState<ManagerReportOwner | null>(null);
  const [ownerReports, setOwnerReports] = useState<ManagerReport[]>([]);
  const [ownerLoading, setOwnerLoading] = useState(false);

  const [report, setReport] = useState<ManagerReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Корзина админа: все удалённые отчёты сотрудников.
  const [showTrash, setShowTrash] = useState(false);
  const [trashItems, setTrashItems] = useState<ManagerReport[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<ManagerReport | null>(null);

  const loadTrash = () => {
    setTrashLoading(true);
    listReportTrash()
      .then((res) => setTrashItems(res.items || []))
      .catch((err: any) => toast.error(err?.message || "Не удалось загрузить корзину"))
      .finally(() => setTrashLoading(false));
  };

  const openTrash = () => {
    setShowTrash(true);
    loadTrash();
  };

  const handleRestoreTrash = async (r: ManagerReport) => {
    try {
      await restoreReportTable(r.id);
      setTrashItems((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Отчёт восстановлен из корзины");
    } catch (err: any) {
      toast.error(err?.message || "Не удалось восстановить отчёт");
    }
  };

  const confirmPurgeTrash = async () => {
    if (!purgeTarget) return;
    try {
      await purgeReportTable(purgeTarget.id);
      setTrashItems((prev) => prev.filter((x) => x.id !== purgeTarget.id));
      toast.success("Отчёт удалён окончательно");
    } catch (err: any) {
      toast.error(err?.message || "Не удалось удалить отчёт");
    } finally {
      setPurgeTarget(null);
    }
  };

  const load = () => {
    setLoading(true);
    listReportTableOwners()
      .then((res) => setOwners(res.items || []))
      .catch((err: any) => toast.error(err?.message || "Не удалось загрузить список отчётов"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openOwner = async (o: ManagerReportOwner) => {
    setOwner(o);
    setOwnerLoading(true);
    try {
      const res = await listUserReportTables(o.user_id);
      setOwnerReports(res.items || []);
    } catch (err: any) {
      toast.error(err?.message || "Не удалось загрузить отчёты сотрудника");
      setOwner(null);
    } finally {
      setOwnerLoading(false);
    }
  };

  const openReport = async (id: number) => {
    setReportLoading(true);
    setEditing(false);
    try {
      setReport(await getReportTable(id));
    } catch (err: any) {
      toast.error(err?.message || "Не удалось открыть отчёт");
    } finally {
      setReportLoading(false);
    }
  };

  // Админ правит чужой отчёт
  const handleSaveReport = async (content: ReportTableContent) => {
    if (!report) return;
    setSaving(true);
    try {
      await saveReportTable(report.id, content, report.title);
      setReport({ ...report, content, updated_at: new Date().toISOString() });
      setEditing(false);
      toast.success("Отчёт сохранён");
    } catch (err: any) {
      toast.error(err?.message || "Не удалось сохранить отчёт");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!report) return;
    try {
      await deleteReportTable(report.id);
      toast.success("Отчёт удалён");
      setDeleteOpen(false);
      // возврат к списку отчётов сотрудника + обновление
      setReport(null);
      if (owner) openOwner(owner);
    } catch (err: any) {
      toast.error(err?.message || "Не удалось удалить отчёт");
    }
  };

  const handleExport = async () => {
    if (!report) return;
    try {
      const blob = await exportReportTable(report.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.title || "report"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.message || "Не удалось скачать отчёт");
    }
  };

  // Уровень 3: сам отчёт
  if (report || reportLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => { setEditing(false); setReport(null); }}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              К отчётам сотрудника
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{report?.title || "..."}</h1>
              <p className="text-xs text-slate-500">
                {report?.user_name}
                {report?.updated_at && (
                  <> · обновлён {format(new Date(report.updated_at), "d MMMM yyyy, HH:mm", { locale: ru })}</>
                )}
              </p>
            </div>
          </div>
          {report && !reportLoading && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-1.5 h-4 w-4" />
                Excel
              </Button>
              {isAdmin && (editing ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                  <X className="mr-1.5 h-4 w-4" />
                  Отменить правку
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Редактировать
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Удалить
                  </Button>
                </>
              ))}
            </div>
          )}
        </div>
        {reportLoading || !report ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : (
          <ReportTableEditor
            key={`${report.id}-${editing}`}
            content={report.content as ReportTableContent}
            readOnly={!editing}
            saving={saving}
            onSave={editing ? handleSaveReport : undefined}
          />
        )}

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить отчёт «{report?.title}»?</AlertDialogTitle>
              <AlertDialogDescription>
                Отчёт сотрудника {report?.user_name} переместится в корзину. Его можно будет
                восстановить или удалить окончательно.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteReport} className="bg-red-600 text-white hover:bg-red-700">
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Уровень 2: список отчётов выбранного сотрудника
  if (owner) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setOwner(null)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            К сотрудникам
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Отчёты: {owner.user_name}</h1>
            <p className="text-xs text-slate-500">Выберите отчёт, чтобы открыть</p>
          </div>
        </div>

        {ownerLoading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : ownerReports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 opacity-40" />
              У сотрудника нет отчётов
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {ownerReports.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => openReport(r.id)}
                className="rounded-lg border bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{r.title}</p>
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

  // Уровень 1: сотрудники, которые ведут отчёты
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {showTrash ? "Корзина отчётов" : "Отчёты сотрудников"}
          </h1>
          <p className="text-sm text-slate-600">
            {showTrash
              ? "Удалённые отчёты сотрудников — восстановите или удалите окончательно"
              : "Личные отчёты-таблицы менеджеров: выберите сотрудника, затем отчёт"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant={showTrash ? "default" : "outline"}
              onClick={() => (showTrash ? setShowTrash(false) : openTrash())}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              {showTrash ? "К сотрудникам" : "Корзина"}
            </Button>
          )}
          <Button variant="outline" onClick={showTrash ? loadTrash : load} disabled={showTrash ? trashLoading : loading}>
            <RefreshCw className={(showTrash ? trashLoading : loading) ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>
      </div>

      {showTrash ? (
        trashLoading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : trashItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 opacity-40" />
              Корзина пуста
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {trashItems.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg border bg-white p-3">
                <FileSpreadsheet className="h-5 w-5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{r.title}</p>
                  <p className="text-xs text-slate-500">
                    {r.user_name || `Сотрудник #${r.user_id}`}
                    {r.updated_at && (
                      <> · {format(new Date(r.updated_at), "d MMM yyyy, HH:mm", { locale: ru })}</>
                    )}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="text-green-600 hover:bg-green-50 hover:text-green-700" onClick={() => handleRestoreTrash(r)}>
                  <ArchiveRestore className="mr-1 h-4 w-4" />
                  <span className="hidden sm:inline text-xs">Восстановить</span>
                </Button>
                <Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-50 hover:text-red-700" title="Удалить навсегда" onClick={() => setPurgeTarget(r)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )
      ) : loading ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : owners.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 opacity-40" />
            Сотрудники ещё не вели отчёты
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {owners.map((o) => (
            <button
              key={o.user_id}
              type="button"
              onClick={() => openOwner(o)}
              className="rounded-lg border bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <User className="h-8 w-8 shrink-0 text-blue-600" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {o.user_name || `Сотрудник #${o.user_id}`}
                  </p>
                  <p className="text-xs text-slate-500">
                    {o.report_count} {plural(o.report_count, "отчёт", "отчёта", "отчётов")}
                    {o.updated_at && (
                      <> · {format(new Date(o.updated_at), "d MMM yyyy, HH:mm", { locale: ru })}</>
                    )}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

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
            <AlertDialogAction onClick={confirmPurgeTrash} className="bg-red-600 text-white hover:bg-red-700">
              Удалить навсегда
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
