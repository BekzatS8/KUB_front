"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
import { CustomSelect } from "@/components/ui/custom-select"
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  Users,
  Handshake,
  UserCheck,
  Eye,
  TrendingUp,
  Building2,
} from "lucide-react"
import { getRoleCode } from "@/lib/auth"
import { getMe } from "@/src/api/auth.api"
import * as FeedAPI from "@/src/api/feed.api"
import * as UserRequestsAPI from "@/src/api/user-requests.api"
import type { UserApprovalRequest } from "@/src/api/user-requests.api"
import type { FeedEvent, FeedEventType } from "@/src/models/feed.model"
import { Toaster } from "@/components/ui/sonner"

const EVENT_TYPE_LABELS: Record<FeedEventType, string> = {
  pending_create_lead: "Создание лида",
  pending_edit_lead: "Редактирование лида",
  pending_delete_lead: "Удаление лида",
  pending_create_deal: "Создание сделки",
  pending_edit_deal: "Редактирование сделки",
  pending_delete_deal: "Удаление сделки",
  pending_create_client: "Создание клиента",
  pending_edit_client: "Редактирование клиента",
  pending_delete_client: "Удаление клиента",
  pending_create_document: "Создание документа",
  pending_edit_document: "Редактирование документа",
  pending_delete_document: "Удаление документа",
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает",
  approved: "Одобрено",
  rejected: "Отклонено",
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
}

const USER_ACTION_LABELS: Record<string, string> = {
  create: "Создание пользователя",
  delete: "Удаление пользователя",
  update: "Редактирование пользователя",
}

function formatPayloadPreview(type: FeedEventType, payload: Record<string, any>): string {
  switch (type) {
    case "pending_create_lead":
    case "pending_edit_lead":
    case "pending_delete_lead":
      return payload.title || "Без названия"
    case "pending_create_deal":
    case "pending_edit_deal":
    case "pending_delete_deal":
      return `${Number(payload.amount || 0).toLocaleString()} ${payload.currency || "KZT"}`
    case "pending_create_client":
    case "pending_edit_client":
    case "pending_delete_client": {
      const name = [payload.last_name, payload.first_name, payload.middle_name].filter(Boolean).join(" ")
      return name || payload.name || payload.legal_profile?.company_name || "Без имени"
    }
    case "pending_create_document":
    case "pending_edit_document":
    case "pending_delete_document":
      return payload.title || (payload.doc_type ? `Тип: ${payload.doc_type}` : "Документ")
    default:
      return ""
  }
}

// ─── Category definitions ─────────────────────────────────────────────────────

type CategoryId = "leads" | "deals" | "clients" | "documents" | "users"

const CATEGORY_META: Record<CategoryId, {
  label: string
  icon: React.ReactNode
  headerBg: string
  iconBg: string
  iconColor: string
}> = {
  leads: {
    label: "Лиды",
    icon: <TrendingUp className="h-4 w-4" />,
    headerBg: "bg-blue-50 border-blue-100",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-700",
  },
  deals: {
    label: "Сделки",
    icon: <Handshake className="h-4 w-4" />,
    headerBg: "bg-purple-50 border-purple-100",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-700",
  },
  clients: {
    label: "Клиенты",
    icon: <Building2 className="h-4 w-4" />,
    headerBg: "bg-teal-50 border-teal-100",
    iconBg: "bg-teal-100",
    iconColor: "text-teal-700",
  },
  documents: {
    label: "Документы",
    icon: <FileText className="h-4 w-4" />,
    headerBg: "bg-indigo-50 border-indigo-100",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-700",
  },
  users: {
    label: "Управление пользователями",
    icon: <UserCheck className="h-4 w-4" />,
    headerBg: "bg-orange-50 border-orange-100",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-700",
  },
}

// ─── Status icon helper ───────────────────────────────────────────────────────

function statusIconBg(status: string) {
  if (status === "pending") return "bg-yellow-100 text-yellow-700"
  if (status === "approved") return "bg-green-100 text-green-700"
  return "bg-red-100 text-red-700"
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FeedPage() {
  const [user, setUser] = useState<any>(null)
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")

  const [selectedEvent, setSelectedEvent] = useState<FeedEvent | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [eventToReject, setEventToReject] = useState<FeedEvent | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const [userRequests, setUserRequests] = useState<UserApprovalRequest[]>([])
  const [userRequestsLoading, setUserRequestsLoading] = useState(false)
  const [selectedUserRequest, setSelectedUserRequest] = useState<UserApprovalRequest | null>(null)
  const [isUserRequestDetailOpen, setIsUserRequestDetailOpen] = useState(false)
  const [isUserRejectDialogOpen, setIsUserRejectDialogOpen] = useState(false)
  const [userRequestToReject, setUserRequestToReject] = useState<UserApprovalRequest | null>(null)
  const [userRejectReason, setUserRejectReason] = useState("")

  const roleCode = getRoleCode(user)
  const isAdmin = roleCode === "system_admin"
  const isHROrLegal = roleCode === "hr" || roleCode === "legal"
  // Только администратор одобряет/отклоняет заявки ленты (бэкенд тоже это требует).
  // Остальные роли видят лишь свои собственные заявки (без кнопок согласования).
  const isElevated = isAdmin

  // ── Fetch feed events ────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setFeedLoading(true)
    try {
      const params: any = { page: 1, size: 50 }
      if (statusFilter !== "all") params.status = statusFilter
      const res = await FeedAPI.listFeedEvents(params)
      setEvents(Array.isArray(res) ? res : res?.items || [])
    } catch (err: any) {
      if (!err?.response?.status || err.response.status === 404) {
        setEvents([])
      } else {
        toast.error("Ошибка загрузки событий")
      }
    } finally {
      setFeedLoading(false)
    }
  }, [statusFilter])

  // ── Fetch user approval requests ─────────────────────────────────────────────
  const fetchUserRequests = useCallback(async (currentUser: any) => {
    const rc = getRoleCode(currentUser)
    if (rc !== "system_admin" && rc !== "hr" && rc !== "legal" && rc !== "management") return
    setUserRequestsLoading(true)
    try {
      const res = rc === "system_admin"
        ? await UserRequestsAPI.listUserRequests({ status: "all", size: 100 })
        : await UserRequestsAPI.listMyUserRequests({ size: 100 })
      setUserRequests(res?.data || [])
    } catch {
      setUserRequests([])
    } finally {
      setUserRequestsLoading(false)
    }
  }, [])

  useEffect(() => {
    getMe().then(setUser).catch(() => {})
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  useEffect(() => {
    if (user) fetchUserRequests(user)
  }, [user, fetchUserRequests])

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleApprove = async (event: FeedEvent) => {
    setIsProcessing(true)
    try {
      await FeedAPI.approveFeedEvent(event.id)
      toast.success("Запрос одобрен и выполнен")
      fetchEvents()
      setIsDetailOpen(false)
    } catch (err: any) {
      toast.error(err?.message || "Ошибка при одобрении")
    } finally {
      setIsProcessing(false)
    }
  }

  const openRejectDialog = (event: FeedEvent) => {
    setEventToReject(event)
    setRejectReason("")
    setIsRejectDialogOpen(true)
  }

  const handleReject = async () => {
    if (!eventToReject) return
    setIsProcessing(true)
    try {
      await FeedAPI.rejectFeedEvent(eventToReject.id, rejectReason || undefined)
      toast.success("Запрос отклонён")
      fetchEvents()
      setIsDetailOpen(false)
    } catch (err: any) {
      toast.error(err?.message || "Ошибка при отклонении")
    } finally {
      setIsProcessing(false)
      setIsRejectDialogOpen(false)
      setEventToReject(null)
    }
  }

  const handleApproveUserRequest = async (req: UserApprovalRequest) => {
    setIsProcessing(true)
    try {
      await UserRequestsAPI.approveUserRequest(req.id)
      toast.success("Заявка одобрена и выполнена")
      fetchUserRequests(user)
      setIsUserRequestDetailOpen(false)
    } catch (err: any) {
      toast.error(err?.message || "Ошибка при одобрении")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRejectUserRequest = async () => {
    if (!userRequestToReject) return
    setIsProcessing(true)
    try {
      await UserRequestsAPI.rejectUserRequest(userRequestToReject.id, userRejectReason || undefined)
      toast.success("Заявка отклонена")
      fetchUserRequests(user)
      setIsUserRequestDetailOpen(false)
    } catch (err: any) {
      toast.error(err?.message || "Ошибка при отклонении")
    } finally {
      setIsProcessing(false)
      setIsUserRejectDialogOpen(false)
      setUserRequestToReject(null)
      setUserRejectReason("")
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────────
  const leadEvents = events.filter((e) => e.type.includes("lead"))
  const dealEvents = events.filter((e) => e.type.includes("deal"))
  const clientEvents = events.filter((e) => e.type.includes("client"))
  const documentEvents = events.filter((e) => e.type.includes("document"))

  // Apply statusFilter client-side to user requests (API returns all)
  const filteredUserRequests = statusFilter === "all"
    ? userRequests
    : userRequests.filter((r) => r.status === statusFilter)

  const allPending =
    events.filter((e) => e.status === "pending").length +
    userRequests.filter((r) => r.status === "pending").length

  const isLoading = feedLoading || userRequestsLoading

  // Categories shown only when they have items
  type CategoryEntry = { id: CategoryId; items: FeedEvent[] | UserApprovalRequest[]; kind: "feed" | "user" }
  const activeCategories: CategoryEntry[] = [
    ...(leadEvents.length ? [{ id: "leads" as CategoryId, items: leadEvents, kind: "feed" as const }] : []),
    ...(dealEvents.length ? [{ id: "deals" as CategoryId, items: dealEvents, kind: "feed" as const }] : []),
    ...(clientEvents.length ? [{ id: "clients" as CategoryId, items: clientEvents, kind: "feed" as const }] : []),
    ...(documentEvents.length ? [{ id: "documents" as CategoryId, items: documentEvents, kind: "feed" as const }] : []),
    ...((isAdmin || isHROrLegal || roleCode === "management") && filteredUserRequests.length
      ? [{ id: "users" as CategoryId, items: filteredUserRequests, kind: "user" as const }]
      : []),
  ]

  const hasContent = activeCategories.length > 0

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-6 m-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Лента событий</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {isElevated
                ? "Запросы от сотрудников на создание и редактирование записей"
                : "Ваши запросы на подтверждение"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {allPending > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-200 text-sm px-3 py-1">
                {allPending} ожидает
              </Badge>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => { fetchEvents(); if (user) fetchUserRequests(user) }}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Status filter */}
        <div className="w-52">
          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Фильтр по статусу"
            options={[
              { value: "all", label: "Все заявки" },
              { value: "pending", label: "Ожидают подтверждения" },
              { value: "approved", label: "Одобренные" },
              { value: "rejected", label: "Отклонённые" },
            ]}
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-8 w-40 rounded-lg" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : !hasContent ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <FileText className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 text-base font-medium">Нет заявок</p>
              <p className="text-slate-400 text-sm mt-1">
                {statusFilter === "pending"
                  ? "Нет запросов, ожидающих подтверждения"
                  : "По выбранному фильтру заявок не найдено"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {activeCategories.map(({ id, items, kind }) => {
              const meta = CATEGORY_META[id]
              return (
                <section key={id}>
                  {/* Category header */}
                  <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border mb-3 ${meta.headerBg}`}>
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.iconBg} ${meta.iconColor}`}>
                      {meta.icon}
                    </div>
                    <span className={`font-semibold text-sm ${meta.iconColor}`}>{meta.label}</span>
                    <Badge className={`ml-auto text-xs ${meta.iconBg} ${meta.iconColor} border-0`}>
                      {items.length}
                    </Badge>
                  </div>

                  {/* Items */}
                  <div className="space-y-2">
                    {kind === "feed"
                      ? (items as FeedEvent[]).map((event) => (
                          <FeedEventCard
                            key={event.id}
                            event={event}
                            isElevated={isElevated}
                            isProcessing={isProcessing}
                            onDetail={() => { setSelectedEvent(event); setIsDetailOpen(true) }}
                            onApprove={() => handleApprove(event)}
                            onReject={() => openRejectDialog(event)}
                          />
                        ))
                      : (items as UserApprovalRequest[]).map((req) => (
                          <UserRequestCard
                            key={req.id}
                            req={req}
                            isAdmin={isAdmin}
                            isProcessing={isProcessing}
                            onDetail={() => { setSelectedUserRequest(req); setIsUserRequestDetailOpen(true) }}
                            onApprove={() => handleApproveUserRequest(req)}
                            onReject={() => {
                              setUserRequestToReject(req)
                              setUserRejectReason("")
                              setIsUserRejectDialogOpen(true)
                            }}
                          />
                        ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Feed event detail dialog ─────────────────────────────────────────── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedEvent && EVENT_TYPE_LABELS[selectedEvent.type]}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className={STATUS_BADGE_CLASS[selectedEvent.status]}>
                  {STATUS_LABELS[selectedEvent.status]}
                </Badge>
                {selectedEvent.resource_id && (
                  <Badge variant="outline">ID записи: {selectedEvent.resource_id}</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Автор запроса</p>
                  <p className="font-medium">{selectedEvent.requestor_name || `#${selectedEvent.requestor_id}`}</p>
                </div>
                <div>
                  <p className="text-slate-500">Дата создания</p>
                  <p className="font-medium">{new Date(selectedEvent.created_at).toLocaleString("ru-RU")}</p>
                </div>
                {selectedEvent.admin_name && selectedEvent.status !== "pending" && (
                  <div>
                    <p className="text-slate-500">{selectedEvent.status === "approved" ? "Одобрил" : "Отклонил"}</p>
                    <p className="font-medium">{selectedEvent.admin_name}</p>
                  </div>
                )}
                {selectedEvent.reject_reason && (
                  <div className="col-span-2">
                    <p className="text-red-500">Причина отказа</p>
                    <p className="font-medium">{selectedEvent.reject_reason}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Данные запроса</p>
                <div className="bg-slate-50 rounded-lg p-3 text-xs font-mono overflow-auto max-h-64">
                  {Object.entries(selectedEvent.payload).map(([key, value]) => {
                    if (value === null || value === undefined || value === "") return null
                    if (typeof value === "object") return null
                    return (
                      <div key={key} className="flex gap-2 py-0.5">
                        <span className="text-slate-500 shrink-0">{key}:</span>
                        <span className="text-slate-900 break-all">{String(value)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              {isElevated && selectedEvent.status === "pending" && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleApprove(selectedEvent)}
                    disabled={isProcessing}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Одобрить и выполнить
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => openRejectDialog(selectedEvent)}
                    disabled={isProcessing}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Отклонить
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Feed event reject dialog ─────────────────────────────────────────── */}
      <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отклонить запрос?</AlertDialogTitle>
            <AlertDialogDescription>
              Укажите причину отклонения (необязательно).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="reject-reason">Причина отказа</Label>
            <Textarea
              id="reject-reason"
              placeholder="Укажите причину отклонения..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-red-600 hover:bg-red-700" disabled={isProcessing}>
              Отклонить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── User request detail dialog ───────────────────────────────────────── */}
      <Dialog open={isUserRequestDetailOpen} onOpenChange={setIsUserRequestDetailOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedUserRequest && (USER_ACTION_LABELS[selectedUserRequest.action] || selectedUserRequest.action)}
            </DialogTitle>
          </DialogHeader>
          {selectedUserRequest && (
            <div className="space-y-4">
              <Badge className={STATUS_BADGE_CLASS[selectedUserRequest.status]}>
                {STATUS_LABELS[selectedUserRequest.status]}
              </Badge>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {isAdmin && (
                  <div>
                    <p className="text-slate-500">Автор запроса</p>
                    <p className="font-medium">{selectedUserRequest.requester_name || `#${selectedUserRequest.requester_id}`}</p>
                  </div>
                )}
                <div>
                  <p className="text-slate-500">Дата создания</p>
                  <p className="font-medium">{new Date(selectedUserRequest.created_at).toLocaleString("ru-RU")}</p>
                </div>
                {selectedUserRequest.target_user_name && (
                  <div>
                    <p className="text-slate-500">Пользователь</p>
                    <p className="font-medium">{selectedUserRequest.target_user_name}</p>
                  </div>
                )}
                {selectedUserRequest.reviewer_name && selectedUserRequest.status !== "pending" && (
                  <div>
                    <p className="text-slate-500">{selectedUserRequest.status === "approved" ? "Одобрил" : "Отклонил"}</p>
                    <p className="font-medium">{selectedUserRequest.reviewer_name}</p>
                  </div>
                )}
                {selectedUserRequest.reject_reason && (
                  <div className="col-span-2">
                    <p className="text-red-500">Причина отказа</p>
                    <p className="font-medium">{selectedUserRequest.reject_reason}</p>
                  </div>
                )}
              </div>
              {selectedUserRequest.request_data && (
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">Данные запроса</p>
                  {selectedUserRequest.action === "update" && (selectedUserRequest.request_data as any).before
                    ? (() => {
                        const after = selectedUserRequest.request_data as Record<string, any>
                        const before = after.before as Record<string, any>
                        const FIELD_LABELS: Record<string, string> = {
                          first_name: "Имя",
                          last_name: "Фамилия",
                          middle_name: "Отчество",
                          phone: "Телефон",
                          address: "Адрес",
                          extra_info: "Доп. информация",
                          bin_iin: "ИИН/БИН",
                        }
                        const changedRows = Object.entries(FIELD_LABELS).filter(([key]) => {
                          const oldVal = before[key] || ""
                          const newVal = after[key] || ""
                          return newVal !== "" && oldVal !== newVal
                        })
                        if (changedRows.length === 0) return (
                          <p className="text-xs text-slate-400">Нет изменений</p>
                        )
                        return (
                          <div className="rounded-lg border overflow-hidden text-sm">
                            <div className="grid grid-cols-3 bg-slate-100 px-3 py-2 font-medium text-slate-600 text-xs">
                              <div>Поле</div>
                              <div>Было</div>
                              <div>Стало</div>
                            </div>
                            {changedRows.map(([key, label]) => (
                              <div key={key} className="grid grid-cols-3 border-t px-3 py-2 text-xs">
                                <div className="text-slate-500 font-medium">{label}</div>
                                <div className="text-red-500">{before[key] || <span className="text-slate-300 italic">пусто</span>}</div>
                                <div className="text-green-700 font-medium">{after[key]}</div>
                              </div>
                            ))}
                          </div>
                        )
                      })()
                    : (
                      <div className="bg-slate-50 rounded-lg p-3 text-xs font-mono overflow-auto max-h-48">
                        {Object.entries(selectedUserRequest.request_data).map(([key, value]) => {
                          if (key === "password_hash" || key === "before" || value === null || value === undefined || value === "") return null
                          if (typeof value === "object") return null
                          return (
                            <div key={key} className="flex gap-2 py-0.5">
                              <span className="text-slate-500 shrink-0">{key}:</span>
                              <span className="text-slate-900 break-all">{String(value)}</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  }
                </div>
              )}
              {isAdmin && selectedUserRequest.status === "pending" && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleApproveUserRequest(selectedUserRequest)}
                    disabled={isProcessing}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Одобрить и выполнить
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      setUserRequestToReject(selectedUserRequest)
                      setUserRejectReason("")
                      setIsUserRejectDialogOpen(true)
                    }}
                    disabled={isProcessing}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Отклонить
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserRequestDetailOpen(false)}>Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── User request reject dialog ───────────────────────────────────────── */}
      <AlertDialog open={isUserRejectDialogOpen} onOpenChange={setIsUserRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отклонить заявку?</AlertDialogTitle>
            <AlertDialogDescription>Укажите причину отклонения (необязательно).</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="user-reject-reason">Причина отказа</Label>
            <Textarea
              id="user-reject-reason"
              placeholder="Укажите причину отклонения..."
              value={userRejectReason}
              onChange={(e) => setUserRejectReason(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleRejectUserRequest} className="bg-red-600 hover:bg-red-700" disabled={isProcessing}>
              Отклонить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FeedEventCard({
  event,
  isElevated,
  isProcessing,
  onDetail,
  onApprove,
  onReject,
}: {
  event: FeedEvent
  isElevated: boolean
  isProcessing: boolean
  onDetail: () => void
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <Card className={`transition-shadow hover:shadow-sm ${event.status === "pending" ? "border-yellow-200" : ""}`}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${statusIconBg(event.status)}`}>
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span className="font-semibold text-slate-900 text-sm">{EVENT_TYPE_LABELS[event.type]}</span>
              <Badge className={`text-xs ${STATUS_BADGE_CLASS[event.status]}`}>
                {STATUS_LABELS[event.status]}
              </Badge>
              {event.resource_id && (
                <Badge variant="outline" className="text-xs">ID: {event.resource_id}</Badge>
              )}
            </div>
            <p className="text-slate-700 text-sm font-medium truncate">
              {formatPayloadPreview(event.type, event.payload)}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs text-slate-500">
              <span>От: {event.requestor_name || `#${event.requestor_id}`}</span>
              <span>{new Date(event.created_at).toLocaleString("ru-RU")}</span>
              {event.admin_name && event.status !== "pending" && (
                <span>{event.status === "approved" ? "Одобрил" : "Отклонил"}: {event.admin_name}</span>
              )}
              {event.reject_reason && (
                <span className="text-red-500">Причина: {event.reject_reason}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={onDetail}>
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Детали
            </Button>
            {isElevated && event.status === "pending" && (
              <>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={onApprove}
                  disabled={isProcessing}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  Одобрить
                </Button>
                <Button size="sm" variant="destructive" onClick={onReject} disabled={isProcessing}>
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Отклонить
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function UserRequestCard({
  req,
  isAdmin,
  isProcessing,
  onDetail,
  onApprove,
  onReject,
}: {
  req: UserApprovalRequest
  isAdmin: boolean
  isProcessing: boolean
  onDetail: () => void
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <Card className={`transition-shadow hover:shadow-sm ${req.status === "pending" ? "border-yellow-200" : ""}`}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${statusIconBg(req.status)}`}>
            <UserCheck className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span className="font-semibold text-slate-900 text-sm">
                {USER_ACTION_LABELS[req.action] || req.action}
              </span>
              <Badge className={`text-xs ${STATUS_BADGE_CLASS[req.status]}`}>
                {STATUS_LABELS[req.status]}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {isAdmin && req.requester_name && <span>От: {req.requester_name}</span>}
              {req.target_user_name && <span>Пользователь: {req.target_user_name}</span>}
              {(req.request_data as any)?.email && (
                <span>Email: {(req.request_data as any).email}</span>
              )}
              <span>{new Date(req.created_at).toLocaleString("ru-RU")}</span>
              {req.reviewer_name && req.status !== "pending" && (
                <span>{req.status === "approved" ? "Одобрил" : "Отклонил"}: {req.reviewer_name}</span>
              )}
              {req.reject_reason && (
                <span className="text-red-500">Причина: {req.reject_reason}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={onDetail}>
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Детали
            </Button>
            {isAdmin && req.status === "pending" && (
              <>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={onApprove}
                  disabled={isProcessing}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  Одобрить
                </Button>
                <Button size="sm" variant="destructive" onClick={onReject} disabled={isProcessing}>
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Отклонить
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
