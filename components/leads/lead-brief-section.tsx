"use client";

import { useEffect, useState } from "react";
import { Send, Save, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import * as leadsApi from "@/src/api/leads.api";
import type { LeadBrief } from "@/src/api/leads.api";

// «Краткая информация» лида (ТЗ «доработки CRM КУБ», п.3.1). Заполняет оператор
// колл-центра, МОП и руководство видят и дополняют. Кнопка «Передать в отдел
// продаж» — у оператора (и у руководства/админа), активна после заполнения
// ФИО, страны и типа визы.

export interface LeadBriefSource extends Partial<LeadBrief> {
  id: number;
  read_only?: boolean;
  handed_to_sales_at?: string;
  handed_to_sales_by_name?: string;
}

const FIELDS: { key: keyof LeadBrief; label: string; required?: boolean; placeholder?: string }[] = [
  { key: "brief_full_name", label: "ФИО клиента", required: true },
  { key: "brief_country", label: "Страна", required: true, placeholder: "Например, Германия" },
  { key: "brief_visa_type", label: "Тип визы", required: true, placeholder: "Например, рабочая" },
  { key: "brief_city", label: "Город (место жительства)" },
  { key: "brief_age", label: "Возраст" },
];

function toBrief(lead: LeadBriefSource): LeadBrief {
  return {
    brief_full_name: lead.brief_full_name || "",
    brief_country: lead.brief_country || "",
    brief_visa_type: lead.brief_visa_type || "",
    brief_city: lead.brief_city || "",
    brief_age: lead.brief_age || "",
    brief_comment: lead.brief_comment || "",
  };
}

function formatDateTime(iso?: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("ru-KZ", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function LeadBriefSection({
  lead,
  canHandToSales,
  onChanged,
}: {
  lead: LeadBriefSource;
  canHandToSales: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<LeadBrief>(() => toBrief(lead));
  const [saving, setSaving] = useState(false);
  const [handing, setHanding] = useState(false);
  const readOnly = !!lead.read_only;
  const handed = !!lead.handed_to_sales_at;

  useEffect(() => {
    setForm(toBrief(lead));
  }, [lead]);

  const saved = toBrief(lead);
  const dirty = (Object.keys(form) as (keyof LeadBrief)[]).some((k) => form[k].trim() !== saved[k]);
  const requiredFilled = !!(form.brief_full_name.trim() && form.brief_country.trim() && form.brief_visa_type.trim());

  const errorText = (err: any, fallback: string) =>
    err?.response?.data?.message ?? err?.response?.data?.error ?? err?.message ?? fallback;

  const save = async (): Promise<boolean> => {
    setSaving(true);
    try {
      await leadsApi.update_lead_brief(lead.id, form);
      toast({ title: "Сохранено", description: "Краткая информация обновлена" });
      onChanged();
      return true;
    } catch (err: any) {
      toast({ title: "Не удалось сохранить", description: errorText(err, "Ошибка"), variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handToSales = async () => {
    if (dirty && !(await save())) return;
    setHanding(true);
    try {
      await leadsApi.hand_lead_to_sales(lead.id);
      toast({ title: "Лид передан в отдел продаж", description: "Лид на первом этапе воронки продаж" });
      onChanged();
    } catch (err: any) {
      toast({ title: "Не удалось передать", description: errorText(err, "Ошибка"), variant: "destructive" });
    } finally {
      setHanding(false);
    }
  };

  return (
    <Card className="p-4">
      {handed && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Передан в отдел продаж {formatDateTime(lead.handed_to_sales_at)}
            {lead.handed_to_sales_by_name ? ` · ${lead.handed_to_sales_by_name}` : ""}
            {readOnly ? ". Для вас — только просмотр." : ""}
          </span>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={f.key} className="text-xs text-muted-foreground">
              {f.label}
              {f.required && <span className="text-red-500"> *</span>}
            </Label>
            <Input
              id={f.key}
              value={form[f.key]}
              placeholder={f.placeholder}
              disabled={readOnly}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          </div>
        ))}
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="brief_comment" className="text-xs text-muted-foreground">Комментарий</Label>
          <Textarea
            id="brief_comment"
            rows={4}
            value={form.brief_comment}
            disabled={readOnly}
            onChange={(e) => setForm({ ...form, brief_comment: e.target.value })}
          />
        </div>
      </div>
      {!readOnly && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={!dirty || saving} variant="outline" className="gap-1.5">
            <Save className="h-4 w-4" />
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
          {canHandToSales && !handed && (
            <Button
              onClick={handToSales}
              disabled={!requiredFilled || handing || saving}
              className="gap-1.5"
              title={requiredFilled ? "Лид уйдёт на первый этап воронки отдела продаж" : "Заполните ФИО, страну и тип визы"}
            >
              <Send className="h-4 w-4" />
              {handing ? "Передача…" : "Передать в отдел продаж"}
            </Button>
          )}
          {canHandToSales && !handed && !requiredFilled && (
            <span className="text-xs text-muted-foreground">Для передачи заполните ФИО, страну и тип визы</span>
          )}
        </div>
      )}
    </Card>
  );
}

// BriefSummaryRows — заполненная краткая информация в блоке «Информация» на «Обзоре».
export function BriefSummaryRows({ lead }: { lead: Partial<LeadBrief> }) {
  const rows = [
    ...FIELDS.map((f) => ({ label: f.label, value: (lead[f.key] || "").trim() })),
    { label: "Комментарий", value: (lead.brief_comment || "").trim() },
  ].filter((r) => r.value);
  if (rows.length === 0) return null;
  return (
    <>
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] gap-1 sm:gap-2 py-1">
          <span className="text-sm text-muted-foreground">{r.label}</span>
          <span className="text-sm font-medium whitespace-pre-wrap">{r.value}</span>
        </div>
      ))}
    </>
  );
}
