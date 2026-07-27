"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Phone, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing } from "lucide-react";
import { getCalls, syncCalls, initiateCall } from "@/src/api/telephony.api";
import type { TelephonyCall, TelephonyCallListFilter, CallStatus } from "@/src/models/telephony.model";

const STATUS_LABELS: Record<CallStatus | string, string> = {
  incoming: "Входящий",
  outgoing: "Исходящий",
  missed: "Пропущенный",
  answered: "Отвечен",
  completed: "Завершён",
  failed: "Ошибка",
  unknown: "Неизвестно",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  answered: "default",
  completed: "default",
  incoming: "secondary",
  outgoing: "secondary",
  missed: "destructive",
  failed: "destructive",
  unknown: "outline",
};

const DIRECTION_LABELS: Record<string, string> = {
  inbound: "⬇ Входящий",
  outbound: "⬆ Исходящий",
};

function formatDuration(seconds?: number): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ru-KZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function toDateInputValue(iso: string): string {
  // Convert ISO datetime string to YYYY-MM-DDTHH:mm for datetime-local input
  try {
    return new Date(iso).toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

interface Stats {
  total: number;
  missed: number;
  answered: number;
}

function StatsCards({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3">
              <Skeleton className="h-6 w-16 mb-1" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  if (!stats) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-4 pb-3 flex items-center gap-3">
          <Phone className="w-5 h-5 text-slate-400 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-xs text-slate-500">Всего звонков</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3 flex items-center gap-3">
          <PhoneMissed className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-rose-600">{stats.missed}</p>
            <p className="text-xs text-slate-500">Пропущено</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3 flex items-center gap-3">
          <PhoneIncoming className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-emerald-600">{stats.answered}</p>
            <p className="text-xs text-slate-500">Отвечено</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TableSkeleton() {
  return (
    <TableBody>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 10 }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}

export default function TelephonyPage() {
  const [calls, setCalls] = useState<TelephonyCall[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [callingId, setCallingId] = useState<number | null>(null);
  const [callMsg, setCallMsg] = useState<string | null>(null);

  const [filter, setFilter] = useState<TelephonyCallListFilter>({
    phone: "",
    status: "",
    date_from: "",
    date_to: "",
    limit: 50,
    offset: 0,
  });

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [all, missed, answered] = await Promise.all([
        getCalls({ limit: 1, offset: 0 }),
        getCalls({ status: "missed" as CallStatus, limit: 1, offset: 0 }),
        getCalls({ status: "answered" as CallStatus, limit: 1, offset: 0 }),
      ]);
      setStats({
        total: all.total ?? 0,
        missed: missed.total ?? 0,
        answered: answered.total ?? 0,
      });
    } catch {
      // stats are best-effort
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const f: TelephonyCallListFilter = { ...filter };
      // Convert datetime-local values to ISO 8601
      if (f.date_from) f.date_from = new Date(f.date_from).toISOString();
      if (f.date_to) f.date_to = new Date(f.date_to).toISOString();
      const data = await getCalls(f);
      setCalls(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e: any) {
      setError(e?.message ?? "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncMsg(null);
    setError(null);
    try {
      const res = await syncCalls();
      setSyncMsg(`Загружено из Binotel: ${res.processed}`);
      await Promise.all([load(), loadStats()]);
    } catch (e: any) {
      setError(
        e?.response?.data?.error ??
          e?.message ??
          "Не удалось синхронизировать с Binotel",
      );
    } finally {
      setSyncing(false);
    }
  }, [load, loadStats]);

  const handleCall = useCallback(async (call: TelephonyCall) => {
    const phone = call.phone || call.normalized_phone;
    if (!phone) return;
    setCallingId(call.id);
    setCallMsg(null);
    setError(null);
    try {
      await initiateCall(phone);
      setCallMsg(`Звоним на ${phone}… ответьте на своём телефоне.`);
    } catch (e: any) {
      setError(
        e?.response?.data?.error ??
          e?.message ??
          "Не удалось инициировать звонок",
      );
    } finally {
      setCallingId(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const page = Math.floor((filter.offset ?? 0) / (filter.limit ?? 50));
  const totalPages = Math.ceil(total / (filter.limit ?? 50));

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Телефония</h1>
          <p className="text-sm text-slate-500">История звонков Binotel</p>
        </div>
        <div className="flex items-center gap-3">
          {callMsg && <span className="text-sm text-emerald-600">{callMsg}</span>}
          {syncMsg && <span className="text-sm text-slate-500">{syncMsg}</span>}
          <Button onClick={handleSync} disabled={syncing}>
            <Phone className="w-4 h-4 mr-2" />
            {syncing ? "Синхронизация…" : "Обновить из Binotel"}
          </Button>
        </div>
      </div>

      <StatsCards stats={stats} loading={statsLoading} />

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Номер телефона</label>
              <Input
                placeholder="+7 700..."
                value={filter.phone ?? ""}
                onChange={(e) =>
                  setFilter((f) => ({ ...f, phone: e.target.value, offset: 0 }))
                }
                className="w-44"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Статус</label>
              <select
                value={filter.status ?? ""}
                onChange={(e) =>
                  setFilter((f) => ({
                    ...f,
                    status: e.target.value as CallStatus | "",
                    offset: 0,
                  }))
                }
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm h-9 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Все статусы</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Дата с</label>
              <input
                type="datetime-local"
                value={filter.date_from ?? ""}
                onChange={(e) =>
                  setFilter((f) => ({ ...f, date_from: e.target.value, offset: 0 }))
                }
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm h-9 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Дата по</label>
              <input
                type="datetime-local"
                value={filter.date_to ?? ""}
                onChange={(e) =>
                  setFilter((f) => ({ ...f, date_to: e.target.value, offset: 0 }))
                }
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm h-9 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setFilter((f) => ({ ...f, offset: 0 }));
                load();
              }}
              disabled={loading}
            >
              {loading ? "Загрузка…" : "Применить"}
            </Button>

            <Button
              variant="ghost"
              onClick={() =>
                setFilter({
                  phone: "",
                  status: "",
                  date_from: "",
                  date_to: "",
                  limit: 50,
                  offset: 0,
                })
              }
              disabled={loading}
            >
              Сбросить
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Звонки ({total})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="p-4 text-sm text-red-600">{error}</div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата / время</TableHead>
                <TableHead>Направление</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Номер</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead>Лид</TableHead>
                <TableHead>Менеджер</TableHead>
                <TableHead>Длительность</TableHead>
                <TableHead>Запись</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            {loading ? (
              <TableSkeleton />
            ) : (
              <TableBody>
                {calls.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="py-12 text-center text-slate-400"
                    >
                      <PhoneOff className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      Звонков не найдено
                    </TableCell>
                  </TableRow>
                )}
                {calls.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(call.started_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {DIRECTION_LABELS[call.direction] ?? call.direction}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[call.status] ?? "outline"}>
                        {STATUS_LABELS[call.status] ?? call.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {call.phone || call.normalized_phone || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {call.client_id ? (
                        <Link
                          href={`/clients/${call.client_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {call.client_name ?? `#${call.client_id}`}
                        </Link>
                      ) : call.binotel_customer_name ? (
                        <span
                          className="text-slate-700"
                          title="Имя из адресной книги Binotel"
                        >
                          {call.binotel_customer_name}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {call.lead_id ? (
                        <Link
                          href={`/leads/${call.lead_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {call.lead_title ?? `#${call.lead_id}`}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {call.manager_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDuration(call.duration_seconds)}
                    </TableCell>
                    <TableCell>
                      {call.recording_url ? (
                        <a
                          href={call.recording_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          ▶ Слушать
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          callingId === call.id ||
                          !(call.phone || call.normalized_phone)
                        }
                        onClick={() => handleCall(call)}
                        title="Позвонить на этот номер через Binotel"
                      >
                        <PhoneOutgoing className="w-4 h-4 mr-1" />
                        {callingId === call.id ? "Звоним…" : "Позвонить"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )}
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-sm text-slate-500">
                Страница {page + 1} из {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0 || loading}
                  onClick={() =>
                    setFilter((f) => ({
                      ...f,
                      offset: Math.max(0, (f.offset ?? 0) - (f.limit ?? 50)),
                    }))
                  }
                >
                  Назад
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1 || loading}
                  onClick={() =>
                    setFilter((f) => ({
                      ...f,
                      offset: (f.offset ?? 0) + (f.limit ?? 50),
                    }))
                  }
                >
                  Вперёд
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
