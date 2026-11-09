"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Ban, Download, Edit, Eye, FilePlus, FileText, Mail, MessageSquare, RotateCw, Send, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AuthenticatedAvatarImage } from "@/components/authenticated-avatar-image";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, formatMoney, initials } from "@/lib/employee-format";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import {
  type Employee, type EmployeeDocument, type HRTemplate,
  EMPLOYEE_DOC_STATUS_LABELS, EMPLOYEE_TYPE_LABELS, HR_TEMPLATE_KINDS,
  fetch_employee_blob, get_employee, issue_employee_documents, list_employee_documents,
  list_employee_positions, list_hr_templates, revoke_employee_document, send_employee_document,
} from "@/src/api/employees.api";

// Карточка сотрудника (ТЗ «доработки CRM КУБ», п.1) и вкладка «Документы»
// (п.2): документ создаётся по шаблону, проверяется в предпросмотре и
// отправляется на онлайн-подписание — сотрудник получает ссылку и
// подтверждает подпись кодом. Подписанный PDF хранится в карточке.

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent_for_signature: "bg-amber-100 text-amber-800",
  signed: "bg-emerald-100 text-emerald-800",
  revoked: "bg-rose-100 text-rose-700",
};

type Tab = "info" | "documents";

export default function EmployeeCardPage() {
  const { id } = useParams<{ id: string }>();
  const employeeId = Number(id);
  const router = useRouter();
  const { toast } = useToast();
  const [emp, setEmp] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("info");
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [templates, setTemplates] = useState<HRTemplate[]>([]);
  const [positions, setPositions] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ doc: EmployeeDocument; url: string } | null>(null);
  const [sendDoc, setSendDoc] = useState<EmployeeDocument | null>(null);

  const errText = (err: any) => err?.response?.data?.message ?? err?.message ?? "Ошибка";

  const loadEmployee = useCallback(() => {
    return get_employee(employeeId).then(setEmp).catch(() => setEmp(null));
  }, [employeeId]);
  const loadDocs = useCallback(() => {
    return list_employee_documents(employeeId).then(setDocs).catch(() => setDocs([]));
  }, [employeeId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadEmployee(), loadDocs()]).finally(() => setLoading(false));
    list_employee_positions().then(setPositions).catch(() => {});
  }, [loadEmployee, loadDocs]);

  const openIssue = async () => {
    try {
      setTemplates(await list_hr_templates());
    } catch {
      setTemplates([]);
    }
    setSelected([]);
    setIssueOpen(true);
  };

  const issue = async () => {
    setBusy(true);
    try {
      const created = await issue_employee_documents(employeeId, selected);
      toast({ title: created.length > 1 ? `Создано документов: ${created.length}` : "Документ создан", description: "Проверьте его в предпросмотре и отправьте на подписание" });
      setIssueOpen(false);
      await loadDocs();
      if (created[0]) openPreview(created[0]);
    } catch (err) {
      toast({ title: "Не удалось выписать документ", description: errText(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const openPreview = async (doc: EmployeeDocument, variant = "pdf") => {
    try {
      const blob = await fetch_employee_blob(`/employees/${employeeId}/documents/${doc.id}/file?variant=${variant}`);
      setPreview({ doc, url: URL.createObjectURL(blob) });
    } catch (err) {
      toast({ title: "Не удалось открыть документ", description: errText(err), variant: "destructive" });
    }
  };

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const download = async (doc: EmployeeDocument, variant: "signed" | "pdf" | "docx") => {
    try {
      const blob = await fetch_employee_blob(`/employees/${employeeId}/documents/${doc.id}/file?variant=${variant}&download=1`);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${doc.title} — ${emp?.full_name || ""}${variant === "signed" ? " (подписан)" : ""}.${variant === "docx" ? "docx" : "pdf"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (err) {
      toast({ title: "Не удалось скачать", description: errText(err), variant: "destructive" });
    }
  };

  const send = async (channel: "sms" | "email") => {
    if (!sendDoc) return;
    setBusy(true);
    try {
      await send_employee_document(employeeId, sendDoc.id, channel);
      toast({ title: "Отправлено на подписание", description: channel === "sms" ? `Ссылка и код — по SMS на ${emp?.phone}` : `Ссылка и код — на ${emp?.email}` });
      setSendDoc(null);
      closePreview();
      await loadDocs();
    } catch (err) {
      toast({ title: "Не удалось отправить", description: errText(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (doc: EmployeeDocument) => {
    if (!window.confirm(`Отозвать «${doc.title}»? Подписать по отправленной ссылке будет нельзя.`)) return;
    try {
      await revoke_employee_document(employeeId, doc.id);
      toast({ title: "Документ отозван" });
      await loadDocs();
    } catch (err) {
      toast({ title: "Не удалось отозвать", description: errText(err), variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  }
  if (!emp) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p className="mb-4">Сотрудник не найден</p>
        <Button variant="outline" onClick={() => router.push("/employees")}><ArrowLeft className="mr-2 h-4 w-4" />К списку</Button>
      </div>
    );
  }

  const row = (label: string, value?: string) => (
    <div className="flex flex-col gap-1 py-1 sm:grid sm:grid-cols-[200px_1fr] sm:gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  );

  return (
    <div className="max-w-5xl space-y-4 p-2 sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/employees")}><ArrowLeft className="h-4 w-4" /></Button>
        <Avatar className="h-12 w-12">
          {emp.has_photo && <AuthenticatedAvatarImage src={`/employees/${emp.id}/photo?v=${encodeURIComponent(emp.updated_at)}`} alt={emp.full_name} className="h-full w-full object-cover" />}
          <AvatarFallback>{initials(emp.full_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{emp.full_name}</h1>
          <p className="text-sm text-muted-foreground">{emp.position} · {EMPLOYEE_TYPE_LABELS[emp.employee_type]}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}><Edit className="h-4 w-4" />Редактировать</Button>
        <Button size="sm" className="gap-1.5" onClick={openIssue}><FilePlus className="h-4 w-4" />Выписать документ</Button>
      </div>

      <div className="inline-flex rounded-lg border p-0.5">
        {([["info", "Данные", User], ["documents", `Документы${docs.length ? ` (${docs.length})` : ""}`, FileText]] as const).map(([key, label, Icon]) => (
          <button key={key} type="button" onClick={() => setTab(key as Tab)}
            className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm", tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <Card className="p-4">
          {row("ФИО", emp.full_name)}
          {row("Дата рождения", formatDate(emp.birth_date))}
          {row("ИИН", emp.iin)}
          {row("Адрес проживания", emp.address)}
          {row("Телефон", emp.phone)}
          {row("Email", emp.email)}
          {row("Экстренный контакт", `${emp.emergency_name} (${emp.emergency_relation}), ${emp.emergency_phone}`)}
          {row("Должность", emp.position)}
          {row("Заработная плата", `${formatMoney(emp.salary)} в месяц`)}
          {row("Дата начала работы", formatDate(emp.hired_at))}
          {row("Дата увольнения", emp.fired_at ? formatDate(emp.fired_at) : "")}
          {row("Тип", EMPLOYEE_TYPE_LABELS[emp.employee_type])}
        </Card>
      )}

      {tab === "documents" && (
        <div className="space-y-2">
          {docs.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">
              <FileText className="mx-auto mb-2 h-10 w-10 opacity-40" />
              <p className="text-sm">Документов пока нет. Нажмите «Выписать документ».</p>
            </Card>
          ) : docs.map((d) => (
            <Card key={d.id} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{d.title}</span>
                    <Badge className={cn("px-1.5 py-0 text-xs font-medium", STATUS_BADGE[d.status])}>{EMPLOYEE_DOC_STATUS_LABELS[d.status]}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Создан {formatDateTime(d.created_at)}
                    {d.sent_at && ` · отправлен ${formatDateTime(d.sent_at)} (${d.sent_via === "email" ? "email" : "SMS"}: ${d.sent_to})`}
                    {d.signed_at && ` · подписан ${formatDateTime(d.signed_at)} — подтверждение кодом по ${d.sent_via === "email" ? "email" : "SMS"}`}
                    {d.revoked_at && d.status === "revoked" && ` · отозван ${formatDateTime(d.revoked_at)}`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {d.status === "signed" ? (
                    <>
                      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => openPreview(d, d.has_signed_pdf ? "signed" : "pdf")}><Eye className="h-3.5 w-3.5" />Открыть</Button>
                      {d.has_signed_pdf && <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => download(d, "signed")}><Download className="h-3.5 w-3.5" />Подписанный PDF</Button>}
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => openPreview(d)}><Eye className="h-3.5 w-3.5" />Предпросмотр</Button>
                      <Button size="sm" className="h-7 gap-1" onClick={() => setSendDoc(d)}>
                        {d.status === "draft" ? <Send className="h-3.5 w-3.5" /> : <RotateCw className="h-3.5 w-3.5" />}
                        {d.status === "draft" ? "Отправить на подписание" : "Отправить повторно"}
                      </Button>
                      {d.status !== "revoked" && <Button size="sm" variant="outline" className="h-7 gap-1 text-rose-600" onClick={() => revoke(d)}><Ban className="h-3.5 w-3.5" />Отозвать</Button>}
                    </>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 px-2" title="Скачать Word" onClick={() => download(d, "docx")}><Download className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <EmployeeFormDialog open={editOpen} employee={emp} positions={positions} onClose={() => setEditOpen(false)} onSaved={(e) => setEmp(e)} />

      <Dialog open={issueOpen} onOpenChange={(v) => !v && setIssueOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Выписать документ</DialogTitle>
            <DialogDescription>Выберите один или несколько шаблонов — данные сотрудника подставятся автоматически.</DialogDescription>
          </DialogHeader>
          {templates.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Шаблонов пока нет. Их загружают администратор и отдел кадров в разделе «Шаблоны документов».</p>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {templates.map((t) => (
                <label key={t.id} className="flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 hover:bg-muted">
                  <input type="checkbox" className="mt-1" checked={selected.includes(t.id)}
                    onChange={(e) => setSelected(e.target.checked ? [...selected, t.id] : selected.filter((x) => x !== t.id))} />
                  <span>
                    <span className="block text-sm font-medium">{t.name}</span>
                    <span className="block text-xs text-muted-foreground">{HR_TEMPLATE_KINDS[t.kind] || t.kind}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)} disabled={busy}>Отмена</Button>
            <Button onClick={issue} disabled={busy || selected.length === 0}>{busy ? "Формирование…" : "Сформировать"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(v) => !v && closePreview()}>
        <DialogContent className="flex h-[90vh] max-w-5xl flex-col">
          <DialogHeader>
            <DialogTitle>{preview?.doc.title}</DialogTitle>
            <DialogDescription>{emp.full_name} · {preview ? EMPLOYEE_DOC_STATUS_LABELS[preview.doc.status] : ""}</DialogDescription>
          </DialogHeader>
          {preview && <iframe src={preview.url} title="Предпросмотр" className="min-h-0 w-full flex-1 rounded border" />}
          {preview && preview.doc.status !== "signed" && (
            <DialogFooter>
              <Button onClick={() => setSendDoc(preview.doc)} className="gap-1.5"><Send className="h-4 w-4" />Отправить на подписание</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!sendDoc} onOpenChange={(v) => !v && setSendDoc(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Отправить на подписание</DialogTitle>
            <DialogDescription>Сотрудник получит ссылку на документ и подтвердит подпись кодом.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button variant="outline" className="h-auto justify-start gap-2 py-3" disabled={busy || !emp.phone} onClick={() => send("sms")}>
              <MessageSquare className="h-4 w-4" />
              <span className="text-left"><span className="block">По SMS</span><span className="block text-xs text-muted-foreground">{emp.phone || "телефон не указан"}</span></span>
            </Button>
            <Button variant="outline" className="h-auto justify-start gap-2 py-3" disabled={busy || !emp.email} onClick={() => send("email")}>
              <Mail className="h-4 w-4" />
              <span className="text-left"><span className="block">На email</span><span className="block text-xs text-muted-foreground">{emp.email || "email не указан в карточке"}</span></span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
