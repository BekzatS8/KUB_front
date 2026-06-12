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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCalls } from "@/src/api/telephony.api";
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

export default function TelephonyPage() {
  const [calls, setCalls] = useState<TelephonyCall[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<TelephonyCallListFilter>({
    phone: "",
    status: "",
    limit: 50,
    offset: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCalls(filter);
      setCalls(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e: any) {
      setError(e?.message ?? "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePhoneChange = (v: string) =>
    setFilter((f) => ({ ...f, phone: v, offset: 0 }));

  const handleStatusChange = (v: string) =>
    setFilter((f) => ({ ...f, status: v as CallStatus | "", offset: 0 }));

  const page = Math.floor((filter.offset ?? 0) / (filter.limit ?? 50));
  const totalPages = Math.ceil(total / (filter.limit ?? 50));

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Телефония</h1>
          <p className="text-sm text-slate-500">История звонков Binotel</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Поиск по номеру"
              value={filter.phone ?? ""}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className="w-52"
            />
            <select
              value={filter.status ?? ""}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Все статусы</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <Button variant="outline" onClick={load} disabled={loading}>
              {loading ? "Загрузка…" : "Обновить"}
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-slate-400">
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
                </TableRow>
              ))}
            </TableBody>
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
                  disabled={page === 0}
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
                  disabled={page >= totalPages - 1}
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
