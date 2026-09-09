"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Plus, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  getWazzupChannels,
  setWazzupChannelBranch,
  getWazzupChannelConnectLink,
  type WazzupChannel,
} from "@/src/api/integrations_wazzup.api"
import { listBranches, type Branch } from "@/src/api/branches.api"

// Кабинет Wazzup — фолбэк, если White Label не настроен (встроить нельзя).
const WAZZUP_CABINET_URL = "https://lk.wazzup24.com"

const TRANSPORT_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
}

// Типы каналов для встроенного подключения (значения transport — как требует
// Wazzup /v2/iframe-links/channels). Instagram/Viber через этот метод не идут —
// их подключают в кабинете Wazzup (кнопка «Открыть кабинет» в модалке).
const CHANNEL_TYPES: { transport: string; label: string }[] = [
  { transport: "whatsapp", label: "WhatsApp (по QR / номеру)" },
  { transport: "wapi", label: "WhatsApp Business (WABA)" },
  { transport: "tgapi", label: "Telegram" },
  { transport: "max", label: "MAX" },
  { transport: "vk", label: "ВКонтакте" },
  { transport: "cian", label: "Циан" },
]

export default function MessengerChannelsPage() {
  const [channels, setChannels] = useState<WazzupChannel[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)

  // Добавление канала: встроенный iframe Wazzup (White Label). Если WL не
  // настроен — открываем кабинет Wazzup в новой вкладке.
  const [addOpen, setAddOpen] = useState(false)
  const [connectLink, setConnectLink] = useState("")
  const [connectLoading, setConnectLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [chRes, brRes] = await Promise.all([getWazzupChannels(), listBranches()])
      setChannels(chRes?.value || [])
      setBranches(Array.isArray(brRes) ? brRes : brRes?.data || [])
    } catch {
      toast.error("Не удалось загрузить каналы")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Открыть модалку с выбором типа канала (iframe грузим уже после выбора).
  const openAdd = () => {
    setConnectLink("")
    setAddOpen(true)
  }

  // Получить ссылку на iframe для конкретного транспорта (обязателен для Wazzup).
  const fetchConnectLink = async (transport: string) => {
    setConnectLink("")
    setConnectLoading(true)
    try {
      const res = await getWazzupChannelConnectLink(transport)
      setConnectLink(res.link)
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 404) {
        // White Label не настроен → открываем кабинет Wazzup (fallback).
        setAddOpen(false)
        toast.info("Добавление канала открывается в кабинете Wazzup")
        window.open(WAZZUP_CABINET_URL, "_blank")
      } else {
        // White Label настроен, но флоу упал — показываем причину (OAUTH_* и т.п.).
        const detail = err?.response?.data?.detail || err?.message || "Неизвестная ошибка"
        toast.error(`Ошибка White Label: ${detail}`)
      }
    } finally {
      setConnectLoading(false)
    }
  }

  const handleChange = async (channelId: number, branchIdRaw: string) => {
    const branchId = branchIdRaw ? Number(branchIdRaw) : null
    setSavingId(channelId)
    try {
      await setWazzupChannelBranch(channelId, branchId)
      setChannels((prev) =>
        prev.map((c) => (c.id === channelId ? { ...c, branch_id: branchId } : c)),
      )
      toast.success("Филиал канала сохранён")
    } catch {
      toast.error("Не удалось сохранить филиал канала")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Каналы мессенджера</h1>
          <p className="text-sm text-slate-600">
            Привязка каналов WhatsApp / Telegram / Instagram к филиалам
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить канал
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Обновить
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Канал → филиал</CardTitle>
          <CardDescription>
            Входящий лид из канала попадает в выбранный филиал. Так менеджеры филиала
            видят только своих лидов и клиентов. Если филиал не выбран — лид получает
            филиал владельца интеграции.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Загрузка каналов...</p>
          ) : channels.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Каналы не найдены. Убедитесь, что интеграция Wazzup включена и каналы
              добавлены в личном кабинете сервиса, затем откройте раздел «Мессенджер»
              один раз для синхронизации и нажмите «Обновить».
            </p>
          ) : (
            <div className="space-y-3">
              {channels.map((ch) => (
                <div
                  key={ch.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900">
                      {ch.name || ch.phone || ch.channel_id}
                    </div>
                    <div className="text-xs text-slate-500">
                      {TRANSPORT_LABELS[ch.transport] || ch.transport}
                      {ch.phone ? ` · ${ch.phone}` : ""}
                    </div>
                  </div>
                  <select
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm sm:w-56"
                    value={ch.branch_id ? String(ch.branch_id) : ""}
                    disabled={savingId === ch.id}
                    onChange={(e) => handleChange(ch.id, e.target.value)}
                  >
                    <option value="">— без филиала —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Встроенный iframe Wazzup для подключения канала (QR/номер/аккаунт).
          После добавления закройте окно и нажмите «Обновить». */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) load() // подтянуть только что добавленный канал
        }}
      >
        <DialogContent className="flex h-[92vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:p-0">
          <DialogHeader className="shrink-0 border-b px-4 py-3">
            <DialogTitle className="flex items-center gap-3 text-base">
              Добавить канал
              {connectLink && (
                <button
                  type="button"
                  onClick={() => setConnectLink("")}
                  className="text-xs font-normal text-slate-500 underline hover:text-slate-700"
                >
                  ← выбрать другой тип
                </button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 w-full flex-1">
            {connectLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Загрузка…
              </div>
            ) : connectLink ? (
              <iframe
                src={connectLink}
                className="h-full w-full border-0"
                title="Добавление канала Wazzup"
                allow="camera; clipboard-write"
              />
            ) : (
              // Шаг 1: выбор типа канала (transport обязателен для Wazzup).
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
                <p className="text-sm text-slate-600">Выберите тип канала для подключения:</p>
                <div className="grid w-full max-w-md grid-cols-2 gap-2">
                  {CHANNEL_TYPES.map((t) => (
                    <Button
                      key={t.transport}
                      variant="outline"
                      className="h-auto py-3"
                      onClick={() => fetchConnectLink(t.transport)}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => window.open(WAZZUP_CABINET_URL, "_blank")}
                  className="mt-2 text-xs text-slate-500 underline hover:text-slate-700"
                >
                  Instagram, Viber и др. — подключить в кабинете Wazzup
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
