"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock, Pencil, Plus, Trash2, User, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { useMe } from "@/lib/use-role-code";
import * as leadsApi from "@/src/api/leads.api";
import { list_task_assignees } from "@/src/api/tasks.api";
import {
  type CalendarEvent,
  create_calendar_event,
  delete_calendar_event,
  list_calendar_events,
  update_calendar_event,
} from "@/src/api/calendar.api";

// Раздел «Календарь» (ТЗ «доработки CRM КУБ», п.6): даты и время встреч с
// клиентами в виде календаря. Заполняют обычно операторы и МОП. Руководство,
// админ и ОКК видят встречи всех сотрудников (фильтр по филиалу и сотруднику).

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeOf = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Сетка месяца: недели с понедельника, включая хвосты соседних месяцев.
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const shift = (first.getDay() + 6) % 7; // пн = 0
  const start = new Date(year, month, 1 - shift);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  // Последняя неделя целиком из следующего месяца — не показываем.
  return days[35].getMonth() !== month ? days.slice(0, 35) : days;
}

interface FormState {
  id?: number;
  title: string;
  date: string;
  start: string;
  end: string;
  description: string;
  leadId: number | null;
  leadTitle: string;
  ownerId: string;
}

const emptyForm = (date: string): FormState => ({
  title: "",
  date,
  start: "10:00",
  end: "11:00",
  description: "",
  leadId: null,
  leadTitle: "",
  ownerId: "",
});

function CalendarInner() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const { id: myId, roleCode } = useMe();
  const seesAll = ["system_admin", "management", "quality_control"].includes(roleCode);
  const canAssignOwner = ["system_admin", "management"].includes(roleCode);
  const readOnly = roleCode === "quality_control";

  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>(dayKey(today));
  const [ownerFilter, setOwnerFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [people, setPeople] = useState<{ id: number; name: string; branch_id?: number; branch_name?: string }[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(dayKey(today)));
  const [saving, setSaving] = useState(false);
  const [leadQuery, setLeadQuery] = useState("");
  const [leadOptions, setLeadOptions] = useState<{ id: number; title: string; phone?: string }[]>([]);

  const days = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date(days[0].getFullYear(), days[0].getMonth(), days[0].getDate());
      const last = days[days.length - 1];
      const to = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      const list = await list_calendar_events({
        from: from.toISOString(),
        to: to.toISOString(),
        owner_id: ownerFilter ? Number(ownerFilter) : undefined,
        branch_id: branchFilter ? Number(branchFilter) : undefined,
      });
      setEvents(list);
    } catch (err: any) {
      toast({ title: "Не удалось загрузить встречи", description: err?.message || "Ошибка", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [days, ownerFilter, branchFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Справочник сотрудников — для фильтра и выбора ответственного (руководство/админ).
  useEffect(() => {
    if (!seesAll) return;
    list_task_assignees()
      .then((res) => setPeople(res.items.map((u) => ({ id: u.id, name: u.name, branch_id: u.branch_id, branch_name: u.branch_name }))))
      .catch(() => setPeople([]));
  }, [seesAll]);

  // Переход из карточки лида: /calendar?lead_id=42&new=1 — сразу диалог встречи.
  useEffect(() => {
    const leadId = Number(params.get("lead_id") || 0);
    if (!leadId || params.get("new") !== "1") return;
    leadsApi
      .get_lead(undefined, { id: leadId })
      .then((lead: any) => {
        setForm({ ...emptyForm(dayKey(new Date())), leadId, leadTitle: lead?.title || `Лид #${leadId}`, title: `Встреча: ${lead?.brief_full_name || lead?.title || ""}`.trim() });
        setFormOpen(true);
      })
      .catch(() => {});
    router.replace("/calendar");
  }, [params, router]);

  // Поиск лида для встречи.
  useEffect(() => {
    if (!formOpen) return;
    const q = leadQuery.trim();
    if (q.length < 2) {
      setLeadOptions([]);
      return;
    }
    const t = setTimeout(() => {
      leadsApi
        .list_leads(undefined, { q, page: 1, size: 10 })
        .then((res: any) => setLeadOptions((res?.items || []).map((l: any) => ({ id: l.id, title: l.title, phone: l.phone }))))
        .catch(() => setLeadOptions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [leadQuery, formOpen]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const k = dayKey(new Date(e.starts_at));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return m;
  }, [events]);

  const openCreate = (date: string) => {
    setForm(emptyForm(date));
    setLeadQuery("");
    setFormOpen(true);
  };

  const openEdit = (e: CalendarEvent) => {
    const start = new Date(e.starts_at);
    setForm({
      id: e.id,
      title: e.title,
      date: dayKey(start),
      start: timeOf(e.starts_at),
      end: e.ends_at ? timeOf(e.ends_at) : "",
      description: e.description || "",
      leadId: e.lead_id ?? null,
      leadTitle: e.lead_title || "",
      ownerId: e.owner_id ? String(e.owner_id) : "",
    });
    setLeadQuery("");
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.date || !form.start) return;
    const startsAt = new Date(`${form.date}T${form.start}:00`);
    const endsAt = form.end ? new Date(`${form.date}T${form.end}:00`) : null;
    setSaving(true);
    try {
      const input = {
        title: form.title.trim(),
        description: form.description.trim(),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt ? endsAt.toISOString() : undefined,
        lead_id: form.leadId,
        owner_id: canAssignOwner && form.ownerId ? Number(form.ownerId) : null,
      };
      if (form.id) await update_calendar_event(form.id, input);
      else await create_calendar_event(input);
      toast({ title: form.id ? "Встреча изменена" : "Встреча назначена" });
      setFormOpen(false);
      setSelectedDay(form.date);
      const [y, m] = form.date.split("-").map(Number);
      setCursor({ year: y, month: m - 1 });
      load();
    } catch (err: any) {
      toast({
        title: "Не удалось сохранить",
        description: err?.response?.data?.message ?? err?.message ?? "Ошибка",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (e: CalendarEvent) => {
    if (!window.confirm(`Удалить встречу «${e.title}»?`)) return;
    try {
      await delete_calendar_event(e.id);
      toast({ title: "Встреча удалена" });
      load();
    } catch (err: any) {
      toast({ title: "Не удалось удалить", description: err?.message || "Ошибка", variant: "destructive" });
    }
  };

  const shiftMonth = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const branches = Array.from(
    new Map(people.filter((p) => p.branch_id).map((p) => [p.branch_id!, p.branch_name || `Филиал ${p.branch_id}`])).entries()
  );
  const dayEvents = byDay.get(selectedDay) || [];
  const todayKey = dayKey(today);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Календарь</h1>
          <p className="text-sm text-slate-600">Встречи с клиентами</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {seesAll && branches.length > 1 && (
            <div className="w-44">
              <CustomSelect
                value={branchFilter}
                onChange={setBranchFilter}
                placeholder="Все филиалы"
                options={[{ value: "", label: "Все филиалы" }, ...branches.map(([id, name]) => ({ value: String(id), label: name }))]}
              />
            </div>
          )}
          {seesAll && (
            <div className="w-52">
              <CustomSelect
                value={ownerFilter}
                onChange={setOwnerFilter}
                placeholder="Все сотрудники"
                options={[
                  { value: "", label: "Все сотрудники" },
                  ...people
                    .filter((p) => !branchFilter || String(p.branch_id) === branchFilter)
                    .map((p) => ({ value: String(p.id), label: p.name })),
                ]}
              />
            </div>
          )}
          {!readOnly && (
            <Button onClick={() => openCreate(selectedDay)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Назначить встречу
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card className="p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)} aria-label="Следующий месяц">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="ml-1 text-lg font-semibold">
                {MONTHS[cursor.month]} {cursor.year}
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCursor({ year: today.getFullYear(), month: today.getMonth() });
                setSelectedDay(todayKey);
              }}
            >
              Сегодня
            </Button>
          </div>
          <div className="grid grid-cols-7 border-l border-t text-sm">
            {WEEKDAYS.map((w) => (
              <div key={w} className="border-b border-r bg-slate-50 px-2 py-1.5 text-center text-xs font-semibold text-slate-600">
                {w}
              </div>
            ))}
            {days.map((d) => {
              const k = dayKey(d);
              const list = byDay.get(k) || [];
              const inMonth = d.getMonth() === cursor.month;
              return (
                <div
                  key={k}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDay(k)}
                  onDoubleClick={() => !readOnly && openCreate(k)}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedDay(k)}
                  className={cn(
                    "min-h-[96px] cursor-pointer border-b border-r p-1.5 text-left transition-colors hover:bg-blue-50/50",
                    !inMonth && "bg-slate-50/60 text-slate-400",
                    selectedDay === k && "bg-blue-50 ring-1 ring-inset ring-blue-400"
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                        k === todayKey && "bg-blue-600 font-semibold text-white"
                      )}
                    >
                      {d.getDate()}
                    </span>
                    {list.length > 0 && <span className="text-[10px] text-slate-400">{list.length}</span>}
                  </div>
                  <div className="space-y-0.5">
                    {list.slice(0, 3).map((e) => (
                      <div key={e.id} className="truncate rounded bg-blue-100 px-1 py-0.5 text-[11px] text-blue-900" title={`${timeOf(e.starts_at)} ${e.title}`}>
                        <span className="font-medium">{timeOf(e.starts_at)}</span> {e.title}
                      </div>
                    ))}
                    {list.length > 3 && <div className="px-1 text-[11px] text-slate-500">ещё {list.length - 3}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {loading && <p className="mt-2 text-xs text-muted-foreground">Загрузка…</p>}
        </Card>

        <Card className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">
              {new Date(`${selectedDay}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" })}
            </h3>
            {!readOnly && (
              <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => openCreate(selectedDay)}>
                <Plus className="h-3.5 w-3.5" /> Встреча
              </Button>
            )}
          </div>
          {dayEvents.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Встреч нет
            </div>
          ) : (
            <div className="space-y-2">
              {dayEvents.map((e) => (
                <div key={e.id} className="rounded-md border p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {timeOf(e.starts_at)}
                        {e.ends_at ? `–${timeOf(e.ends_at)}` : ""}
                      </div>
                      <div className="mt-0.5 font-medium">{e.title}</div>
                    </div>
                    {e.can_edit && (
                      <div className="flex shrink-0 gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Изменить" onClick={() => openEdit(e)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" title="Удалить" onClick={() => remove(e)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {e.lead_id && (
                    <Link href={`/leads/${e.lead_id}`} className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline">
                      <Target className="h-3.5 w-3.5" /> #{e.lead_id} {e.lead_title}
                    </Link>
                  )}
                  {e.owner_name && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3.5 w-3.5" /> {e.owner_name}
                      {e.creator_name && e.created_by !== e.owner_id ? ` · назначил(а) ${e.creator_name}` : ""}
                    </div>
                  )}
                  {e.description && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{e.description}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Изменить встречу" : "Назначить встречу"}</DialogTitle>
            <DialogDescription>Дата и время встречи с клиентом</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Название <span className="text-red-500">*</span></Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Например: консультация в офисе" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>Дата <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Начало <span className="text-red-500">*</span></Label>
                <Input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Окончание</Label>
                <Input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Лид</Label>
              {form.leadId ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="truncate">#{form.leadId} {form.leadTitle}</span>
                  <Button variant="ghost" size="sm" className="h-6" onClick={() => setForm({ ...form, leadId: null, leadTitle: "" })}>
                    Убрать
                  </Button>
                </div>
              ) : (
                <>
                  <Input value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} placeholder="Поиск: телефон, имя или номер лида" />
                  {leadOptions.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-md border">
                      {leadOptions.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          className="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            setForm({ ...form, leadId: l.id, leadTitle: l.title, title: form.title || `Встреча: ${l.title}` });
                            setLeadOptions([]);
                            setLeadQuery("");
                          }}
                        >
                          #{l.id} {l.title}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            {canAssignOwner && (
              <div className="space-y-1">
                <Label>Ответственный</Label>
                <CustomSelect
                  value={form.ownerId}
                  onChange={(v) => setForm({ ...form, ownerId: v })}
                  placeholder="Я"
                  options={[{ value: "", label: "Я" }, ...people.filter((p) => p.id !== myId).map((p) => ({ value: String(p.id), label: `${p.name}${p.branch_name ? ` · ${p.branch_name}` : ""}` }))]}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>Комментарий</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Отмена
            </Button>
            <Button onClick={save} disabled={saving || !form.title.trim() || !form.date || !form.start}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarInner />
    </Suspense>
  );
}
