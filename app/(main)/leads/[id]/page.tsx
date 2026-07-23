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
import * as leadsApi from "@/src/api/leads.api";
import { getLeadCalls, initiateCall } from "@/src/api/telephony.api";
import type { TelephonyCall } from "@/src/models/telephony.model";

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

function OverviewSection({
  lead,
  onCall,
  calling,
  canCall,
}: {
  lead: Lead;
  onCall: () => void;
  calling: boolean;
  canCall: boolean;
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
                  <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                  Переписка
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
                <MessageCircle className="w-3.5 h-3.5 text-green-600" />
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
    </div>
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
            />
          )}
          {activeSection === "calls" && <CallsSection leadId={lead.id} />}
        </div>
      </div>
    </div>
  );
}
