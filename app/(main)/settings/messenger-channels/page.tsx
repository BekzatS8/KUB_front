"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Plus, RefreshCw, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  getWazzupChannels,
  setWazzupChannelBranch,
  getWazzupChannelConnectLink,
  deleteWazzupChannel,
  setWazzupChannelDepartment,
  getMessengerDepartments,
  type WazzupChannel,
  type MessengerDepartment,
} from "@/src/api/integrations_wazzup.api"
import { listBranches, type Branch } from "@/src/api/branches.api"

const TRANSPORT_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
}

// Типы каналов для встроенного подключения через iframe. Значения transport —
// строго допустимые провайдером для /v2/iframe-links/channels (подтверждено
// поддержкой 09.09.2026): whatsapp, wapi, tgapi, maxbot, max, vk, cian.
// Instagram здесь НЕ поддерживается — подключается отдельным методом создания
// канала (POST /v2/channels), не через iframe.
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
  const [departments, setDepartments] = useState<MessengerDepartment[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  // Удаление «мусорного» канала: строка остаётся в CRM после отключения канала
  // в Wazzup, потому что синхронизация только добавляет и обновляет записи.
  const [channelToDelete, setChannelToDelete] = useState<WazzupChannel | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Добавление канала: встроенный iframe провайдера (White Label). Выбор типа
  // канала → ссылка на iframe для этого транспорта.
  const [addOpen, setAddOpen] = useState(false)
  const [connectLink, setConnectLink] = useState("")
  const [connectLoading, setConnectLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [chRes, brRes, depRes] = await Promise.all([
        getWazzupChannels(),
        listBranches(),
        getMessengerDepartments().catch(() => ({ value: [], count: 0 })),
      ])
      setChannels(chRes?.value || [])
      setBranches(Array.isArray(brRes) ? brRes : brRes?.data || [])
      setDepartments(depRes?.value || [])
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
        toast.error("Подключение каналов пока недоступно. Обратитесь к администратору.")
        setAddOpen(false)
      } else {
        const detail = err?.response?.data?.detail || err?.message || "Не удалось открыть форму"
        toast.error(detail)
      }
    } finally {
      setConnectLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!channelToDelete) return
    setDeleting(true)
    try {
      await deleteWazzupChannel(channelToDelete.id)
      setChannels((prev) => prev.filter((c) => c.id !== channelToDelete.id))
      toast.success("Канал удалён из списка")
      setChannelToDelete(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Не удалось удалить канал")
    } finally {
      setDeleting(false)
    }
  }

  // Отдел-получатель: выделенная линия (напр. жалобы и претензии ОКК) уводит
  // входящие из общего пула филиалов в свой отдел.
  const handleDepartmentChange = async (channelId: number, departmentIdRaw: string) => {
    const departmentId = departmentIdRaw ? Number(departmentIdRaw) : null
    setSavingId(channelId)
    try {
      await setWazzupChannelDepartment(channelId, departmentId)
      setChannels((prev) =>
        prev.map((c) => (c.id === channelId ? { ...c, department_id: departmentId } : c)),
      )
      toast.success("Отдел канала сохранён")
    } catch (err: any) {
      toast.error(err?.message || "Не удалось сохранить отдел канала")
    } finally {
      setSavingId(null)
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
          <CardTitle>Канал → филиал и отдел</CardTitle>
          <CardDescription>
            Входящий лид из канала попадает в выбранный филиал. Так менеджеры филиала
            видят только своих лидов и клиентов. Если филиал не выбран — лид получает
            филиал владельца интеграции. Отдел нужен для выделенных линий: например
            номер жалоб и претензий отдела контроля качества — такие обращения не
            попадают в общий пул лидов филиалов, их видит только сам отдел,
            руководство и админ. Список подтягивается из Wazzup при открытии
            страницы и по кнопке «Обновить»; отключённые в Wazzup каналы удаляются
            автоматически, а корзиной можно убрать оставшиеся вручную.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Загрузка каналов...</p>
          ) : channels.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Каналы не найдены. Нажмите «Добавить канал», чтобы подключить
              WhatsApp / Telegram / Instagram, затем «Обновить».
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
                  <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                    <select
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm sm:w-48"
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
                    <select
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm sm:w-56"
                      value={ch.department_id ? String(ch.department_id) : ""}
                      disabled={savingId === ch.id}
                      onChange={(e) => handleDepartmentChange(ch.id, e.target.value)}
                      title="Отдел-получатель входящих с этого канала"
                    >
                      <option value="">— общий (без отдела) —</option>
                      {departments.map((d) => (
                        <option key={d.id} value={String(d.id)}>
                          {d.name}
                          {d.is_private ? " (закрытый)" : ""}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Удалить канал из списка"
                      onClick={() => setChannelToDelete(ch)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
          <div className="flex min-h-0 w-full flex-1 justify-center bg-white">
            {connectLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Загрузка…
              </div>
            ) : connectLink ? (
              // Ограничиваем ширину и центрируем — форма подключения не «прилипает»
              // к левому краю в широкой модалке.
              <iframe
                src={connectLink}
                className="h-full w-full max-w-[900px] border-0"
                title="Добавление канала"
                allow="camera; clipboard-write"
              />
            ) : (
              // Шаг 1: выбор типа канала (transport обязателен).
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
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={channelToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setChannelToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить канал из списка?</AlertDialogTitle>
            <AlertDialogDescription>
              {channelToDelete
                ? `«${channelToDelete.name || channelToDelete.phone || channelToDelete.channel_id}» будет убран из списка каналов и из выбора в «Написать первым», привязка к филиалу снимется. Переписка и история сообщений останутся на месте. Если канал ещё подключён в Wazzup, он вернётся при следующем обновлении — уже без филиала.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Удаление…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
