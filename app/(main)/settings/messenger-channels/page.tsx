"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Link2, Plus, RefreshCw, Trash2 } from "lucide-react"

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
import { getCurrentUser, getRoleCode } from "@/lib/auth"
import {
  getWazzupAccounts,
  getWazzupChannels,
  setupWazzup,
  setWazzupChannelBranch,
  getWazzupChannelConnectLink,
  deleteWazzupChannel,
  setWazzupChannelDepartment,
  getMessengerDepartments,
  type WazzupChannel,
  type MessengerDepartment,
  type WazzupAccount,
  type WazzupAccountInfo,
} from "@/src/api/integrations_wazzup.api"
import { listBranches, type Branch } from "@/src/api/branches.api"

const TRANSPORT_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
}

// Причины, по которым канал не работает. Приходят от провайдера вместе со
// статусом. Без расшифровки канал с неотсканированным QR выглядит в списке
// обычным, и непонятно, почему по нему не идут сообщения.
const STATUS_REASON_LABELS: Record<string, string> = {
  qridle: "Отсканируйте QR-код",
  qr: "Отсканируйте QR-код",
  unauthorized: "Требуется повторная авторизация",
  openelsewhere: "Номер подключён в другом аккаунте Wazzup",
  foreignphone: "QR отсканирован с другого номера",
  not_enough_money: "Канал не оплачен",
  wait_for_password: "Нужен пароль двухфакторной аутентификации",
  blocked: "Канал заблокирован Meta",
  rejected: "Канал отклонён",
}

type ChannelHealth = { label: string; hint: string; className: string }

// channelHealth переводит status/status_reason в человекопонятный бейдж.
function channelHealth(status: string, reason?: string): ChannelHealth {
  const s = (status || "").toLowerCase().trim()
  const hint = STATUS_REASON_LABELS[(reason || "").toLowerCase().trim()] || ""

  if (["active", "connected", "enabled", "ok", "online", "working"].includes(s)) {
    return { label: "Работает", hint: "", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" }
  }
  if (s === "init") {
    return {
      label: "Подключается",
      hint: hint || "Канал запускается",
      className: "bg-amber-50 text-amber-700 ring-amber-200",
    }
  }
  if (!s || s === "unknown") {
    return { label: "Статус неизвестен", hint: "", className: "bg-slate-100 text-slate-600 ring-slate-200" }
  }
  return {
    label: "Не работает",
    hint: hint || "Канал отключён в Wazzup",
    className: "bg-red-50 text-red-700 ring-red-200",
  }
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

// Адрес, на который Wazzup шлёт входящие; тот же, что в настройках мессенджера.
const WEBHOOKS_BASE_URL = "https://api.kubcrm.kz"

const channelAccount = (ch: WazzupChannel): WazzupAccount => ch.account || "main"

export default function MessengerChannelsPage() {
  // Подключают аккаунт к CRM админ и руководство — те же, кто привязывает
  // номера к филиалам.
  const roleCode = getRoleCode(getCurrentUser())
  const isAdmin = roleCode === "system_admin" || roleCode === "management"
  const [accounts, setAccounts] = useState<WazzupAccountInfo[]>([])
  const [connectingAccount, setConnectingAccount] = useState<WazzupAccount | null>(null)
  const [channels, setChannels] = useState<WazzupChannel[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [departments, setDepartments] = useState<MessengerDepartment[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  // Удаление канала: на партнёрском драйвере канал отключается в самом Wazzup,
  // на v3 — убирается только строка в CRM (у провайдера нет метода удаления).
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
      const [chRes, brRes, depRes, accRes] = await Promise.all([
        getWazzupChannels(),
        listBranches(),
        getMessengerDepartments().catch(() => ({ value: [], count: 0 })),
        getWazzupAccounts().catch(() => ({ items: [] as WazzupAccountInfo[] })),
      ])
      setChannels(chRes?.value || [])
      setAccounts(accRes?.items || [])
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

  // Подключить аккаунт к CRM: регистрирует у Wazzup адрес входящих. Для уже
  // подключённого — переподключение с тем же адресом (ничего не теряется).
  const handleConnect = async (account: WazzupAccount) => {
    setConnectingAccount(account)
    try {
      await setupWazzup({ webhooks_base_url: WEBHOOKS_BASE_URL, enabled: true, account })
      toast.success("Аккаунт подключён. Входящие с его номеров будут приходить в CRM.")
      await load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Не удалось подключить аккаунт")
    } finally {
      setConnectingAccount(null)
    }
  }

  // Номера группируются по аккаунтам. Если сервер не вернул список аккаунтов
  // (старый бэкенд), всё показывается одной группой без заголовка.
  const groups: { info?: WazzupAccountInfo; items: WazzupChannel[] }[] = accounts.length
    ? accounts.map((info) => ({
        info,
        items: channels.filter((ch) => channelAccount(ch) === info.account),
      }))
    : [{ items: channels }]
  const canAddAnywhere = accounts.some((a) => a.can_add_channels && a.connected)
  const deletingFromPartner =
    channelToDelete !== null &&
    Boolean(accounts.find((a) => a.account === channelAccount(channelToDelete))?.partner)

  const handleDelete = async () => {
    if (!channelToDelete) return
    setDeleting(true)
    try {
      const res = await deleteWazzupChannel(channelToDelete.id)
      setChannels((prev) => prev.filter((c) => c.id !== channelToDelete.id))
      // provider_deleted различает реальное удаление канала у провайдера и
      // простую уборку строки: во втором случае канал вернётся при обновлении,
      // и об этом честнее сказать сразу.
      if (res?.provider_deleted) {
        toast.success("Канал удалён из Wazzup")
      } else {
        toast.success("Канал убран из списка. В Wazzup он остался — отключите его там, иначе вернётся при обновлении")
      }
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
          {(canAddAnywhere || accounts.length === 0) && (
            <Button onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить канал
            </Button>
          )}
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
          ) : (
            <div className="space-y-6">
              {groups.map(({ info, items }) => (
                <section key={info?.account || "all"} className="space-y-3">
                  {info && (
                    <div className="flex flex-col gap-2 border-b border-slate-200 pb-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-slate-900">
                          {info.account === "child" ? "Дочерний аккаунт" : "Основной аккаунт"}
                        </h2>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                            info.connected && info.enabled
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-amber-50 text-amber-700 ring-amber-200"
                          }`}
                        >
                          {info.connected && info.enabled ? "Подключён к CRM" : "Не подключён"}
                        </span>
                        <span className="text-xs text-slate-500">Номеров: {items.length}</span>
                      </div>
                      {isAdmin && (
                        <Button
                          variant={info.connected ? "ghost" : "default"}
                          size="sm"
                          onClick={() => handleConnect(info.account)}
                          disabled={connectingAccount !== null}
                          title="Зарегистрировать у Wazzup адрес для входящих сообщений"
                        >
                          {connectingAccount === info.account ? (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Link2 className="mr-2 h-4 w-4" />
                          )}
                          {info.connected ? "Переподключить" : "Подключить"}
                        </Button>
                      )}
                    </div>
                  )}
                  {info && !info.connected ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      Аккаунт не подключён к CRM: входящие с его номеров не приходят,
                      а его мессенджер не открывается.
                      {isAdmin ? " Нажмите «Подключить»." : " Обратитесь к администратору."}
                    </p>
                  ) : items.length === 0 ? (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      {!info || info.can_add_channels
                        ? "Номеров нет. Нажмите «Добавить канал», чтобы подключить WhatsApp / Telegram, затем «Обновить»."
                        : "Номеров нет. Номера этого аккаунта подключаются в кабинете Wazzup, затем нажмите «Обновить»."}
                    </p>
                  ) : (
                    items.map((ch) => (
                      <div
                        key={ch.id}
                        className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-medium text-slate-900">
                              {ch.name || ch.phone || ch.channel_id}
                            </span>
                            {(() => {
                              const health = channelHealth(ch.status, ch.status_reason)
                              return (
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${health.className}`}
                                  title={health.hint || undefined}
                                >
                                  {health.label}
                                </span>
                              )
                            })()}
                          </div>
                          <div className="text-xs text-slate-500">
                            {TRANSPORT_LABELS[ch.transport] || ch.transport}
                            {ch.phone ? ` · ${ch.phone}` : ""}
                            {(() => {
                              const hint = channelHealth(ch.status, ch.status_reason).hint
                              return hint ? <span className="text-amber-700"> · {hint}</span> : null
                            })()}
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
                    ))
                  )}
                </section>
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
                {/* Канал подключается в тот аккаунт Wazzup, который настроен на
                    сервере для этой формы. Если он не совпадает с рабочим
                    аккаунтом CRM, канал не появится в списке и не будет
                    присылать входящие — см. docs/integrations/wazzup.md. */}
                <p className="max-w-md text-center text-xs text-slate-500">
                  Instagram здесь не подключается — его добавляют в кабинете Wazzup,
                  после чего он появится в списке по кнопке «Обновить». Если после
                  подключения канал не появился в списке, он ушёл в другой аккаунт
                  Wazzup — обратитесь к администратору сервера.
                </p>
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
              {channelToDelete && !deletingFromPartner
                ? `«${channelToDelete.name || channelToDelete.phone || channelToDelete.channel_id}» будет убран из списка каналов CRM, привязка к филиалу снимется. В основном аккаунте Wazzup номер останется — отключите его в кабинете Wazzup, иначе он вернётся при обновлении. Переписка и история сообщений останутся на месте.`
                : channelToDelete
                ? `«${channelToDelete.name || channelToDelete.phone || channelToDelete.channel_id}» будет отключён в Wazzup и убран из списка каналов и из выбора в «Написать первым», привязка к филиалу снимется. Переписка и история сообщений останутся на месте. Действие необратимо: чтобы вернуть канал, его придётся подключать заново — со сканированием QR-кода.`
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
