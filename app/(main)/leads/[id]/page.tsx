"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, PhoneIncoming, PhoneMissed,
  User, FileText, Activity, PlayCircle, RefreshCw, PhoneCall, MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { CustomSelect } from "@/components/ui/custom-select";
import * as leadsApi from "@/src/api/leads.api";
import { listFunnels } from "@/src/api/funnels.api";
import { getLeadCalls, initiateCall } from "@/src/api/telephony.api";
import type { TelephonyCall } from "@/src/models/telephony.model";
import { getCurrentUser, getRoleCode } from "@/lib/auth";

// Full lead type as returned by backend
interface Lead {
  id: number;
  title: string;
  description: string;
  phone?: string;
  source?: string;
  messenger_transport?: string;
  messenger_chat_id?: string;
  status: string;
  created_at?: string;
  owner_id: number;
  branch_id?: number;
  branch_name?: string;
  funnel_id?: number;
  is_archived?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  in_progress: "В работе",
  confirmed: "Подтверждён",
  converted: "Конвертирован",
  cancelled: "Отменён",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  converted: "bg-purple-100 text-purple-700",
  cancelled: "bg-slate-100 text-slate-600",
};

const SOURCE_LABELS: Record<string, string> = {
  binotel: "Binotel (звонок)",
  manual: "Вручную",
  website: "Сайт",
  referral: "Реферал",
};

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ru-KZ", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDuration(seconds?: number): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Call status helpers ─────────────────────────────────────────────────────

const CALL_STATUS_LABELS: Record<string, string> = {
  incoming: "Входящий",
  outgoing: "Исходящий",
  missed: "Пропущен",
  answered: "Отвечен",
  completed: "Завершён",
  failed: "Ошибка",
  unknown: "Неизвестно",
};

const CALL_STATUS_COLORS: Record<string, string> = {
  answered: "bg-emerald-100 text-emerald-700",
  completed: "bg-emerald-100 text-emerald-700",
  missed: "bg-rose-100 text-rose-700",
  failed: "bg-rose-100 text-rose-700",
};

// ─── Calls section ───────────────────────────────────────────────────────────

function CallsSection({ leadId }: { leadId: number }) {
  const [calls, setCalls] = useState<TelephonyCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await getLeadCalls(leadId, 50);
        setCalls(res.items || []);
      } catch (err: any) {
        setError(err.message || "Не удалось загрузить звонки");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [leadId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-4 h-4 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error) return <p className="text-sm text-destructive text-center py-8">{error}</p>;

  if (calls.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Phone className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Нет звонков по этому лиду</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {calls.map((call) => (
        <Card key={call.id} className="p-3">
          <div className="flex items-center gap-3">
            {call.direction === "inbound" ? (
              <PhoneIncoming className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <PhoneMissed className="w-4 h-4 text-blue-500 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium font-mono">
                  {call.phone || call.normalized_phone || "Неизвестный"}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    CALL_STATUS_COLORS[call.status] ?? "bg-slate-100 text-slate-600"
                  }`}
                >
                  {CALL_STATUS_LABELS[call.status] ?? call.status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground flex gap-3 mt-0.5">
                <span>{formatDateTime(call.started_at)}</span>
                {call.duration_seconds != null && (
                  <span>{formatDuration(call.duration_seconds)}</span>
                )}
                {call.manager_name && <span>{call.manager_name}</span>}
              </div>
            </div>
            {call.recording_url && (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                <a href={call.recording_url} target="_blank" rel="noopener noreferrer">
                  <PlayCircle className="w-4 h-4" />
                </a>
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Overview section ─────────────────────────────────────────────────────────

// Иконка мессенджера под тип источника: у WhatsApp / Instagram / Telegram —
// своя фирменная иконка и цвет; для прочих — универсальная (зелёный чат).
function MessengerIcon({ source, className = "w-3.5 h-3.5" }: { source?: string; className?: string }) {
  const s = (source || "").toLowerCase();
  if (s.includes("whatsapp")) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#25D366]`} aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .103 5.36.1 11.945c0 2.096.546 4.142 1.588 5.945L0 24l6.335-1.652a11.882 11.882 0 005.71 1.454h.006c6.585 0 11.946-5.36 11.949-11.945a11.9 11.9 0 00-3.48-8.418z" />
      </svg>
    );
  }
  if (s.includes("telegram")) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#229ED9]`} aria-hidden="true">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    );
  }
  if (s.includes("instagram")) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} text-[#E4405F]`} aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    );
  }
  return <MessageCircle className={`${className} text-green-600`} />;
}

function OverviewSection({
  lead,
  onCall,
  calling,
  canCall,
  onChanged,
}: {
  lead: Lead;
  onCall: () => void;
  calling: boolean;
  canCall: boolean;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Title + status */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold">{lead.title}</h2>
            {lead.description && (
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                {lead.description}
              </p>
            )}
          </div>
          <Badge
            className={`shrink-0 ${STATUS_COLORS[lead.status] ?? "bg-slate-100 text-slate-600"}`}
          >
            {STATUS_LABELS[lead.status] ?? lead.status}
          </Badge>
        </div>
      </Card>

      {/* Details */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" /> Информация
        </h3>
        <div className="space-y-2">
          {lead.phone && (
            <div className="flex items-center justify-between">
              <div className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] gap-1 sm:gap-2 py-1 flex-1">
                <span className="text-sm text-muted-foreground">Телефон</span>
                <span className="text-sm font-medium font-mono">{lead.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Открыть переписку с лидом сразу в нашем мессенджере (Wazzup),
                    без ручного поиска (обратная связь заказчика 21.07.2026). */}
                <a
                  href={`/whatsapp?transport=${lead.source || "whatsapp"}&phone=${(lead.phone || "").replace(/\D/g, "")}`}
                  className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-sm text-foreground hover:bg-muted"
                  title="Открыть переписку в мессенджере"
                >
                  <MessengerIcon source={lead.source} />
                  Открыть в мессенджере
                </a>
                {canCall && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1"
                    onClick={onCall}
                    disabled={calling}
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    {calling ? "Звонок…" : "Позвонить"}
                  </Button>
                )}
              </div>
            </div>
          )}
          {/* Лиды из Telegram/Instagram приходят без телефона — переписку
              открываем по external_chat_id, так же как WhatsApp по номеру
              (обратная связь заказчика 23.07.2026). */}
          {!lead.phone && lead.messenger_chat_id && (
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Переписка</span>
              <a
                href={`/whatsapp?transport=${lead.messenger_transport || lead.source || "whatsapp"}&chat_id=${encodeURIComponent(lead.messenger_chat_id)}`}
                className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-sm text-foreground hover:bg-muted"
                title="Открыть переписку в мессенджере"
              >
                <MessengerIcon source={lead.messenger_transport || lead.source} />
                Открыть в мессенджере
              </a>
            </div>
          )}
          {lead.source && (
            <div className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] gap-1 sm:gap-2 py-1">
              <span className="text-sm text-muted-foreground">Источник</span>
              <span className="text-sm font-medium">
                {SOURCE_LABELS[lead.source] ?? lead.source}
              </span>
            </div>
          )}
          {lead.branch_name && (
            <div className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] gap-1 sm:gap-2 py-1">
              <span className="text-sm text-muted-foreground">Филиал</span>
              <span className="text-sm font-medium">{lead.branch_name}</span>
            </div>
          )}
          <div className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] gap-1 sm:gap-2 py-1">
            <span className="text-sm text-muted-foreground">Создан</span>
            <span className="text-sm font-medium">{formatDateTime(lead.created_at)}</span>
          </div>
        </div>
      </Card>

      {/* Перемещение лида в другую воронку (напр. вернуть ошибочно переданный
          лид) — обратная связь заказчика 26.07.2026. */}
      <LeadFunnelMove lead={lead} onMoved={onChanged} />
    </div>
  );
}

// LeadFunnelMove — выбор воронки и перенос лида в неё. Доступно ролям с правом
// leads.move_between_funnels (админ/руководство).
function LeadFunnelMove({ lead, onMoved }: { lead: Lead; onMoved: () => void }) {
  const { toast } = useToast();
  const [funnels, setFunnels] = useState<{ id: number; name: string }[]>([]);
  const [target, setTarget] = useState<string>("");
  const [moving, setMoving] = useState(false);
  // Право leads.move_between_funnels на бэке — у админа и руководства.
  const roleCode = getRoleCode(getCurrentUser()) || "";
  const canMove = ["system_admin", "admin", "management", "leadership"].includes(roleCode);

  useEffect(() => {
    if (!canMove) return;
    listFunnels()
      .then((list) => setFunnels((list || []).map((f: any) => ({ id: f.id, name: f.name }))))
      .catch(() => setFunnels([]));
  }, [canMove]);

  if (!canMove) return null;

  const currentFunnel = funnels.find((f) => f.id === lead.funnel_id);
  const options = funnels
    .filter((f) => f.id !== lead.funnel_id)
    .map((f) => ({ value: String(f.id), label: f.name }));

  const handleMove = async () => {
    const funnelId = Number(target);
    if (!funnelId) return;
    setMoving(true);
    try {
      await leadsApi.move_lead_to_funnel(lead.id, funnelId);
      toast({ title: "Лид перемещён", description: "Лид перенесён в выбранную воронку" });
      setTarget("");
      onMoved();
    } catch (err: any) {
      toast({
        title: "Не удалось переместить",
        description: err?.response?.data?.message ?? err?.message ?? "Ошибка",
        variant: "destructive",
      });
    } finally {
      setMoving(false);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <RefreshCw className="w-4 h-4 text-muted-foreground" /> Воронка
      </h3>
      <div className="space-y-2">
        <div className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] gap-1 sm:gap-2 py-1">
          <span className="text-sm text-muted-foreground">Текущая</span>
          <span className="text-sm font-medium">{currentFunnel?.name ?? "—"}</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <CustomSelect
              value={target}
              onChange={setTarget}
              options={options}
              placeholder="Выберите воронку для переноса"
            />
          </div>
          <Button onClick={handleMove} disabled={!target || moving} className="shrink-0">
            {moving ? "Перемещение…" : "Переместить"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type SectionKey = "overview" | "calls";

const NAV_ITEMS: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Обзор", icon: <FileText className="w-4 h-4" /> },
  { key: "calls", label: "Звонки", icon: <Phone className="w-4 h-4" /> },
];

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");
  const [calling, setCalling] = useState(false);

  const reloadLead = useCallback(() => {
    if (!id) return;
    leadsApi
      .get_lead(undefined, { id })
      .then((data) => setLead(data))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    leadsApi
      .get_lead(undefined, { id })
      .then((data) => setLead(data))
      .catch(() => setLead(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCall = useCallback(async () => {
    if (!lead?.phone) return;
    setCalling(true);
    try {
      await initiateCall(lead.phone);
      toast({ title: "Звонок инициирован", description: `Набираем ${lead.phone}` });
    } catch (err: any) {
      toast({
        title: "Ошибка звонка",
        description: err?.response?.data?.error ?? err?.message ?? "Неизвестная ошибка",
        variant: "destructive",
      });
    } finally {
      setCalling(false);
    }
  }, [lead?.phone, toast]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p className="mb-4">Лид не найден</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Назад
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{lead.title}</h1>
          <p className="text-sm text-muted-foreground">Лид #{lead.id}</p>
        </div>
        {lead.is_archived && (
          <Badge variant="outline" className="text-slate-500">Архив</Badge>
        )}
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="w-44 shrink-0">
          <Card className="p-3">
            <div className="flex items-center gap-2 mb-3 px-1">
              <User className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium truncate">#{lead.id}</span>
            </div>
            <Badge
              className={`w-full justify-center mb-3 ${STATUS_COLORS[lead.status] ?? "bg-slate-100 text-slate-600"}`}
            >
              {STATUS_LABELS[lead.status] ?? lead.status}
            </Badge>
            {lead.phone && (
              <p className="text-xs text-muted-foreground truncate px-1 mb-2 font-mono">
                {lead.phone}
              </p>
            )}
            <Separator className="my-2" />
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveSection(item.key)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                    activeSection === item.key
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>
          </Card>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold mb-4">
            {activeSection === "overview" ? "Обзор" : "Звонки"}
          </h2>

          {activeSection === "overview" && (
            <OverviewSection
              lead={lead}
              onCall={handleCall}
              calling={calling}
              canCall={!!lead.phone}
              onChanged={reloadLead}
            />
          )}
          {activeSection === "calls" && <CallsSection leadId={lead.id} />}
        </div>
      </div>
    </div>
  );
}
