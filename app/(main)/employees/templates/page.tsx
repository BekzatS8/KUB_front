"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import { useToast } from "@/components/ui/use-toast";
import { useMe } from "@/lib/use-role-code";
import { formatDateTime } from "@/lib/employee-format";
import {
  type HRTemplate, HR_TEMPLATE_KINDS, delete_hr_template, fetch_employee_blob, list_hr_templates, upload_hr_template,
} from "@/src/api/employees.api";

// Шаблоны кадровых документов (ТЗ «доработки CRM КУБ», п.2). Загружают
// администратор и отдел кадров в формате Word (.docx). В шаблон при выписке
// подставляются данные сотрудника — коды ниже.

const PLACEHOLDERS: [string, string][] = [
  ["{{FULL_NAME}}", "ФИО"],
  ["{{IIN}}", "ИИН"],
  ["{{BIRTH_DATE}}", "дата рождения (дд.мм.гггг)"],
  ["{{ADDRESS}}", "адрес проживания"],
  ["{{PHONE}}", "телефон"],
  ["{{EMAIL}}", "email"],
  ["{{POSITION}}", "должность"],
  ["{{SALARY}}", "заработная плата (350 000)"],
  ["{{SALARY_WORDS}}", "заработная плата прописью"],
  ["{{HIRE_DATE}}", "дата начала работы"],
  ["{{DOC_DATE}}", "дата документа (дд.мм.гггг)"],
  ["{{DOC_DATE_TEXT}}", "дата документа текстом («09» ноября 2026 г.)"],
];

export default function HRTemplatesPage() {
  const { toast } = useToast();
  const { roleCode } = useMe();
  const canManage = roleCode === "system_admin" || roleCode === "hr";
  const [items, setItems] = useState<HRTemplate[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("labor_contract");
  const [busy, setBusy] = useState(false);
  const [fileKey, setFileKey] = useState(0);

  const load = () => list_hr_templates().then(setItems).catch(() => setItems([]));
  useEffect(() => {
    load();
  }, []);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      await upload_hr_template(file, name.trim(), kind);
      toast({ title: "Шаблон загружен" });
      setFile(null);
      setName("");
      setFileKey((k) => k + 1);
      load();
    } catch (err: any) {
      toast({ title: "Не удалось загрузить", description: err?.response?.data?.message ?? err?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: HRTemplate) => {
    if (!window.confirm(`Удалить шаблон «${t.name}»? Уже выписанные документы останутся.`)) return;
    try {
      await delete_hr_template(t.id);
      load();
    } catch (err: any) {
      toast({ title: "Не удалось удалить", description: err?.response?.data?.message ?? err?.message, variant: "destructive" });
    }
  };

  const download = async (t: HRTemplate) => {
    const blob = await fetch_employee_blob(`/employees/templates/${t.id}/file`);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = t.original_name || `${t.name}.docx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className="max-w-5xl space-y-4 p-2 sm:p-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon"><Link href="/employees"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-xl font-bold">Шаблоны кадровых документов</h1>
          <p className="text-sm text-muted-foreground">Трудовой договор, соглашения, должностные инструкции, регламенты</p>
        </div>
      </div>

      {canManage && (
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Загрузить шаблон (Word, .docx)</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Файл</Label>
              <Input key={fileKey} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Название</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="По имени файла" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Вид</Label>
              <CustomSelect value={kind} onChange={setKind} options={Object.entries(HR_TEMPLATE_KINDS).map(([value, label]) => ({ value, label }))} />
            </div>
            <Button onClick={upload} disabled={!file || busy} className="gap-1.5"><Upload className="h-4 w-4" />{busy ? "Загрузка…" : "Загрузить"}</Button>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="mb-3 font-semibold">Шаблоны</h2>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Шаблонов пока нет</p>
        ) : (
          <div className="divide-y">
            {items.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{HR_TEMPLATE_KINDS[t.kind] || t.kind} · загружен {formatDateTime(t.created_at)}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Скачать исходный шаблон" onClick={() => download(t)}><Download className="h-4 w-4" /></Button>
                  {canManage && <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" title="Удалить" onClick={() => remove(t)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="mb-1 font-semibold">Подстановки в шаблоне</h2>
        <p className="mb-3 text-sm text-muted-foreground">Впишите код в нужное место Word-документа — при выписке он заменится данными сотрудника.</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {PLACEHOLDERS.map(([code, label]) => (
            <div key={code} className="flex items-center gap-2 text-sm">
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{code}</code>
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
