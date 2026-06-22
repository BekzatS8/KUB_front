"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  Clock,
  RefreshCw,
  FileText,
  Users,
  Handshake,
  UserCheck,
  Eye,
} from "lucide-react"
import { getRoleCode } from "@/lib/auth"
import { getMe } from "@/src/api/auth.api"
import * as FeedAPI from "@/src/api/feed.api"
import type { FeedEvent, FeedEventType } from "@/src/models/feed.model"
import { Toaster } from "@/components/ui/sonner"

const EVENT_TYPE_LABELS: Record<FeedEventType, string> = {
  pending_create_lead: "Создание лида",
  pending_edit_lead: "Редактирование лида",
  pending_create_deal: "Создание сделки",
  pending_edit_deal: "Редактирование сделки",
  pending_create_client: "Создание клиента",
  pending_edit_client: "Редактирование клиента",
}

const EVENT_TYPE_ICONS: Record<FeedEventType, React.ReactNode> = {
  pending_create_lead: <Users className="h-4 w-4" />,
  pending_edit_lead: <Users className="h-4 w-4" />,
  pending_create_deal: <Handshake className="h-4 w-4" />,
  pending_edit_deal: <Handshake className="h-4 w-4" />,
  pending_create_client: <UserCheck className="h-4 w-4" />,
  pending_edit_client: <UserCheck className="h-4 w-4" />,
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

function formatPayloadPreview(type: FeedEventType, payload: Record<string, any>): string {
  switch (type) {
    case "pending_create_lead":
    case "pending_edit_lead":
      return payload.title || "Без названия"
    case "pending_create_deal":
    case "pending_edit_deal":
      return `${Number(payload.amount || 0).toLocaleString()} ${payload.currency || "KZT"}`
    case "pending_create_client":
    case "pending_edit_client": {
      const name = [payload.last_name, payload.first_name, payload.middle_name]
        .filter(Boolean)
        .join(" ")
      return name || payload.name || payload.legal_profile?.company_name || "Без имени"
    }
    default:
      return ""
  }
}

export default function FeedPage() {
  const [user, setUser] = useState<any>(null)
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("pending")
  const [selectedEvent, setSelectedEvent] = useState<FeedEvent | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [eventToReject, setEventToReject] = useState<FeedEvent | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const isAdmin = getRoleCode(user) === "system_admin"
  const isElevated =
    isAdmin ||
    getRoleCode(user) === "management" ||
    getRoleCode(user) === "quality_control"

  const fetchEvents = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: any = { page: 1, size: 50 }
      if (statusFilter !== "all") params.status = statusFilter
      const res = await FeedAPI.listFeedEvents(params)
      const items = Array.isArray(res) ? res : res?.items || []
      setEvents(items)
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.message?.includes("404")) {
        // Backend endpoint not yet deployed — show empty state gracefully
        setEvents([])
      } else {
        toast.error("Ошибка загрузки ленты событий")
      }
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await getMe()
        setUser(userData)
      } catch {
        // fallback
      }
    }
    loadUser()
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleApprove = async (event: FeedEvent) => {
    setIsProcessing(true)
    try {
      await FeedAPI.approveFeedEvent(event.id)
      toast.success("Запрос одобрен и выполнен")
      fetchEvents()
      if (isDetailOpen) setIsDetailOpen(false)
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

  const pendingCount = events.filter((e) => e.status === "pending").length

  return (
    <>
      <div className="space-y-6 m-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Лента событий</h1>
            <p className="text-slate-600">
              {isElevated
                ? "Запросы от сотрудников на создание и редактирование записей"
                : "Ваши запросы на подтверждение"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800 text-sm px-3 py-1">
                {pendingCount} ожидает
              </Badge>
            )}
            <Button variant="outline" size="icon" onClick={fetchEvents} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Filter */}
        <div className="w-48">
          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Фильтр по статусу"
            options={[
              { value: "all", label: "Все события" },
              { value: "pending", label: "Ожидают подтверждения" },
              { value: "approved", label: "Одобренные" },
              { value: "rejected", label: "Отклонённые" },
            ]}
          />
        </div>

        {/* Events list */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 text-lg font-medium">Нет событий</p>
              <p className="text-slate-400 text-sm mt-1">
                {statusFilter === "pending"
                  ? "Нет запросов, ожидающих подтверждения"
                  : "По выбранному фильтру событий не найдено"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <Card
                key={event.id}
                className={`transition-shadow hover:shadow-md ${
                  event.status === "pending" ? "border-yellow-200" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          event.status === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : event.status === "approved"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {EVENT_TYPE_ICONS[event.type]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-slate-900 text-sm">
                            {EVENT_TYPE_LABELS[event.type]}
                          </span>
                          <Badge className={`${STATUS_BADGE_CLASS[event.status]} text-xs`}>
                            {STATUS_LABELS[event.status]}
                          </Badge>
                          {event.resource_id && (
                            <Badge variant="outline" className="text-xs">
                              ID: {event.resource_id}
                            </Badge>
                          )}
                        </div>
                        <p className="text-slate-700 text-sm font-medium truncate">
                          {formatPayloadPreview(event.type, event.payload)}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                          <span>От: {event.requestor_name || `Пользователь #${event.requestor_id}`}</span>
                          <span>{new Date(event.created_at).toLocaleString("ru-RU")}</span>
                          {event.reject_reason && (
                            <span className="text-red-500">
                              Причина отказа: {event.reject_reason}
                            </span>
                          )}
                          {event.admin_name && event.status !== "pending" && (
                            <span className="text-slate-400">
                              {event.status === "approved" ? "Одобрил" : "Отклонил"}: {event.admin_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedEvent(event)
                          setIsDetailOpen(true)
                        }}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        Детали
                      </Button>
                      {isElevated && event.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleApprove(event)}
                            disabled={isProcessing}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                            Одобрить
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openRejectDialog(event)}
                            disabled={isProcessing}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1.5" />
                            Отклонить
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEvent && EVENT_TYPE_LABELS[selectedEvent.type]}
            </DialogTitle>
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
                  <p className="font-medium">
                    {selectedEvent.requestor_name || `#${selectedEvent.requestor_id}`}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Дата создания</p>
                  <p className="font-medium">
                    {new Date(selectedEvent.created_at).toLocaleString("ru-RU")}
                  </p>
                </div>
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
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отклонить запрос?</AlertDialogTitle>
            <AlertDialogDescription>
              Действие не может быть выполнено. Укажите причину отказа (необязательно).
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
            <AlertDialogAction
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700"
              disabled={isProcessing}
            >
              Отклонить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </>
  )
}
