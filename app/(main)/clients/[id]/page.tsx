"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, User, FileText, Phone, Activity, Building2, MapPin,
  CreditCard, Briefcase, Heart,
  Edit, MoreHorizontal, Eye, Send,
  Download, RefreshCw, Upload, AlertCircle, History, RotateCcw, Camera, X,
  Search, PlayCircle, TrendingUp, PhoneCall, ShieldCheck, XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { SendForSignatureModal } from "@/components/send-for-signature-modal"
import { PdfViewer } from "@/components/ui/pdf-viewer-simple"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"

import * as ClientAPI from "@/src/api/clients.api"
import { getClientCalls, initiateCall } from "@/src/api/telephony.api"
import { sendWazzupMessage } from "@/src/api/integrations_wazzup.api"
import * as DocAPI from "@/src/api/documents.api"
import { list_deals } from "@/src/api/deals.api"
import type { Deal } from "@/src/models/deals.model"
import {
  getDocumentVersions, uploadDocumentVersion, downloadDocumentVersion,
  restoreDocumentVersion, type DocumentVersion,
} from "@/src/api/document-versions.api"
import { getCurrentUser, hasPermission, getRoleCode } from "@/lib/auth"
import { getMyPermissions } from "@/src/api/permissions.api"
import { ClientAttachments } from "@/components/client-attachments"
import type { Client } from "@/src/models/clients.model"
import type { Document, DocType, DocStatus } from "@/src/models/documents.model"
import type { TelephonyCall } from "@/src/models/telephony.model"

// ─── Helpers ────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<DocType, string> = {
  contract_paid_full_ru: "Договор (100% оплата)",
  contract_paid_50_50_ru: "Договор (50/50)",
  contract_free_ru: "Договор (бесплатный)",
  refund_application: "Заявление на возврат",
  pause_application: "Заявление на паузу",
  avr_kub_group: "АВР (KUB Group)",
  receipt_refund_full: "Чек возврата (полный)",
  receipt_refund_partial: "Чек возврата (частичный)",
  cancel_appointment: "Отмена записи",
  documents_handover_act: "Акт передачи документов",
  visa_questionnaire: "Визовая анкета",
  termination_transfer: "Расторжение (перевод)",
  termination_waiver: "Расторжение (отказ)",
  contract_language_courses: "Договор (языковые курсы)",
  addendum_korea: "Доп. соглашение (Корея)",
  contract_ukaby_visa: "Договор UKABY (визовые услуги)",
}

const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  draft: "Черновик",
  under_review: "На проверке",
  approved: "Одобрен",
  returned: "Возвращён",
  signed: "Подписан",
}

const DOC_STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  under_review: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  returned: "bg-rose-100 text-rose-700",
  signed: "bg-blue-100 text-blue-700",
}

const SIGN_STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает подписи",
  approved: "Подписан",
  expired: "Просрочен",
}

const COUNTRY_LABELS: Record<string, string> = {
  kazakhstan: "Казахстан",
  south_korea: "Южная Корея",
  japan: "Япония",
  usa: "США",
  uk: "Великобритания",
  australia: "Австралия",
  canada: "Канада",
  poland: "Польша",
  estonia: "Эстония",
  lithuania: "Литва",
  slovakia: "Словакия",
  germany: "Германия",
  italy: "Италия",
  spain: "Испания",
  czech_republic: "Чехия",
  norway: "Норвегия",
  sweden: "Швеция",
  france: "Франция",
  other: "Другая страна",
}

const TRIP_PURPOSE_LABELS: Record<string, string> = {
  tourism: "Туризм",
  business: "Бизнес",
  study: "Учеба",
  work: "Работа",
  family_visit: "Посещение семьи/друзей",
  medical: "Лечение",
  residence_permit: "ВНЖ",
  permanent_residence: "ПМЖ",
  transit: "Транзит",
  other: "Другая цель",
}

const SEX_LABELS: Record<string, string> = {
  male: "Мужской",
  female: "Женский",
}

const MARITAL_STATUS_LABELS: Record<string, string> = {
  married: "В браке",
  not_married: "Не в браке",
  divorced: "В разводе",
  widowed: "Вдова/Вдовец",
  civil_marriage: "Гражданский брак",
}

const EDUCATION_LEVEL_LABELS: Record<string, string> = {
  higher: "Высшее",
  secondary_special: "Средне-специальное",
  secondary: "Среднее",
  primary: "Начальное",
  incomplete_higher: "Неоконченное высшее",
}

function translateValue(value: string | null | undefined, labels: Record<string, string>): string | undefined {
  if (!value) return undefined
  return labels[value] || value
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-rose-500",
  "bg-amber-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500",
]

function getInitials(client: Client): string {
  const name = client.display_name || client.name || ""
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name[0].toUpperCase()
}

function getAvatarColor(id: string | number): string {
  const numId = typeof id === "string" ? parseInt(id, 10) || 0 : id
  return AVATAR_COLORS[numId % AVATAR_COLORS.length]
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—"
  try {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric",
    })
  } catch {
    return dateStr
  }
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return "—"
  try {
    return new Date(dateStr).toLocaleString("ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  } catch {
    return dateStr
  }
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

type SectionKey = "overview" | "documents" | "deals" | "calls"

const NAV_ITEMS: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Обзор", icon: <User className="w-4 h-4" /> },
  { key: "deals", label: "Сделки", icon: <TrendingUp className="w-4 h-4" /> },
  { key: "documents", label: "Документы", icon: <FileText className="w-4 h-4" /> },
  { key: "calls", label: "Звонки", icon: <Phone className="w-4 h-4" /> },
]

// ─── Detail Item ────────────────────────────────────────────────────

function DetailItem({ label, value, className }: { label: string; value?: React.ReactNode; className?: string }) {
  if (!value || value === "—") return null
  return (
    <div className={`flex flex-col sm:grid sm:grid-cols-[140px_1fr] gap-1 sm:gap-2 py-1.5 min-w-0 ${className || ""}`}>
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium break-all min-w-0">{value}</span>
    </div>
  )
}

// ─── Client Avatar Component ────────────────────────────────────────

// В обзоре аватар только просматривают и увеличивают: загрузка/удаление фото
// перенесены в форму редактирования клиента (обратная связь 20.07.2026).
function ClientAvatar({
  client, avatarUrl,
}: {
  client: Client
  avatarUrl: string | null
}) {
  const [error, setError] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)
  const initials = getInitials(client)
  const color = getAvatarColor(client.id)
  const isLegal = client.client_type === "legal"
  const hasImage = !!avatarUrl && !error

  useEffect(() => { setError(false) }, [avatarUrl])

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative group">
        <div
          className={`w-24 h-24 rounded-full overflow-hidden border-2 border-border bg-muted ${hasImage ? "cursor-zoom-in" : ""}`}
          onClick={() => { if (hasImage) setZoomOpen(true) }}
          title={hasImage ? "Нажмите, чтобы увеличить" : undefined}
        >
          {hasImage ? (
            <img
              key={avatarUrl!}
              src={avatarUrl!}
              alt={client.display_name || client.name || ""}
              className="w-full h-full object-cover"
              onError={() => setError(true)}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-white text-xl font-bold ${color}`}>
              {isLegal ? <Building2 className="w-8 h-8" /> : initials}
            </div>
          )}
        </div>
        {hasImage && (
          <div className="pointer-events-none absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Search className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      {/* Лайтбокс: увеличенное фото */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{client.display_name || client.name || "Фото"}</DialogTitle>
          </DialogHeader>
          {hasImage && (
            <img src={avatarUrl!} alt="" className="max-h-[70vh] w-full rounded-lg object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Overview Section ───────────────────────────────────────────────

function OverviewSection({ client, profile }: { client: Client; profile: any }) {
  const isIndividual = client.client_type === "individual"
  const p = client.individual_profile || client
  const lp = client.legal_profile

  if (isIndividual) {
    return (
      <div className="space-y-6">
        {/* Country & Trip */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" /> Поездка
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 min-w-0">
            <DetailItem label="Страна" value={p.country === "other" ? (client.country_other || "Другая страна") : translateValue(p.country, COUNTRY_LABELS)} />
            <DetailItem label="Цель" value={p.trip_purpose === "other" ? (client.trip_purpose_other || "Другая цель") : translateValue(p.trip_purpose, TRIP_PURPOSE_LABELS)} />
          </div>
        </Card>

        {/* Personal */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" /> Личные данные
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 min-w-0">
            <DetailItem label="ФИО" value={[p.last_name, p.first_name, p.middle_name].filter(Boolean).join(" ") || "—"} />
            <DetailItem label="ИИН" value={p.iin} />
            <DetailItem label="Удостоверение" value={p.id_number} />
            <DetailItem label="Паспорт" value={p.passport_identity} />
            <DetailItem label="Дата рожд." value={p.birth_date ? formatDate(p.birth_date) : undefined} />
            <DetailItem label="Место рожд." value={p.birth_place} />
            <DetailItem label="Гражданство" value={p.citizenship} />
            <DetailItem label="Пол" value={translateValue(p.sex, SEX_LABELS)} />
          </div>
        </Card>

        {/* Contacts */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground" /> Контакты и адрес
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 min-w-0">
            <DetailItem label="Телефон" value={client.primary_phone || client.phone} />
            <DetailItem label="Email" value={client.primary_email || client.email} />
            <DetailItem label="Рег. адрес" value={p.registration_address} />
            <DetailItem label="Факт. адрес" value={p.actual_address || client.actual_address} />
          </div>
        </Card>

        {/* Passport dates */}
        {(p.passport_issue_date || p.passport_expire_date) && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" /> Паспорт
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 min-w-0">
              <DetailItem label="Выдан" value={p.passport_issue_date ? formatDate(p.passport_issue_date) : undefined} />
              <DetailItem label="Действует до" value={p.passport_expire_date ? formatDate(p.passport_expire_date) : undefined} />
            </div>
          </Card>
        )}

        {/* Work & Education */}
        {(p.job || p.education || p.education_level || p.specialty) && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-muted-foreground" /> Работа и образование
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 min-w-0">
              <DetailItem label="Работа" value={p.job} />
              <DetailItem label="Должность" value={p.position} />
              <DetailItem label="Образование" value={translateValue(p.education_level, EDUCATION_LEVEL_LABELS)} />
              <DetailItem label="Специальность" value={p.specialty} />
              <DetailItem label="Уч. заведение" value={p.education_institution_name} />
            </div>
          </Card>
        )}

        {/* Family */}
        {(p.marital_status || p.has_children || p.spouse_name) && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Heart className="w-4 h-4 text-muted-foreground" /> Семья
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 min-w-0">
              <DetailItem label="Сем. положение" value={translateValue(p.marital_status, MARITAL_STATUS_LABELS)} />
              <DetailItem label="Дети" value={p.has_children ? "Да" : p.has_children === false ? "Нет" : undefined} />
              <DetailItem label="Супруг(а)" value={p.spouse_name} />
              <DetailItem label="Контакты" value={p.spouse_contacts} />
            </div>
          </Card>
        )}

        {/* Medical */}
        {(p.therapist_name || p.clinic_name || p.diseases_last3_years) && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" /> Медицина
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 min-w-0">
              <DetailItem label="Терапевт" value={p.therapist_name} />
              <DetailItem label="Клиника" value={p.clinic_name} />
              <DetailItem label="Заболевания" value={p.diseases_last3_years} />
            </div>
          </Card>
        )}

        {/* Additional */}
        {p.additional_info && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-2">Дополнительно</h3>
            <p className="text-sm text-muted-foreground">{p.additional_info}</p>
          </Card>
        )}
      </div>
    )
  }

  // Legal entity
  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" /> Компания
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 min-w-0">
          <DetailItem label="Название" value={lp?.company_name || client.name} />
          <DetailItem label="БИН" value={lp?.bin || client.bin_iin} />
          <DetailItem label="Форма" value={lp?.legal_form} />
          <DetailItem label="Директор" value={lp?.director_full_name} />
          <DetailItem label="Юр. адрес" value={lp?.legal_address || client.address} />
          <DetailItem label="Факт. адрес" value={lp?.actual_address || client.actual_address} />
          <DetailItem label="Сайт" value={lp?.website} />
          <DetailItem label="Отрасль" value={lp?.industry} />
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" /> Контактное лицо
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 min-w-0">
          <DetailItem label="Имя" value={lp?.contact_person_name} />
          <DetailItem label="Должность" value={lp?.contact_person_position || client.contact_person_position} />
          <DetailItem label="Телефон" value={lp?.contact_person_phone || client.primary_phone || client.phone} />
          <DetailItem label="Email" value={lp?.contact_person_email || client.primary_email || client.email} />
        </div>
      </Card>

      {(lp?.bank_name || lp?.iban) && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-muted-foreground" /> Банковские данные
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 min-w-0">
            <DetailItem label="Банк" value={lp?.bank_name || client.bank_name} />
            <DetailItem label="IBAN" value={lp?.iban || client.iban} />
            <DetailItem label="БИК" value={lp?.bik || client.bik} />
            <DetailItem label="Кбе" value={lp?.kbe || client.kbe} />
          </div>
        </Card>
      )}

      {lp?.additional_info && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-2">Дополнительно</h3>
          <p className="text-sm text-muted-foreground">{lp.additional_info}</p>
        </Card>
      )}
    </div>
  )
}

// ─── Documents Section ──────────────────────────────────────────────

function DocumentsSection({ client }: { client: Client }) {
  const { toast } = useToast()
  const [docs, setDocs] = useState<Document[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")

  // PDF viewer state
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false)
  const [selectedPdfDoc, setSelectedPdfDoc] = useState<Document | null>(null)

  // Version dialog state
  const [versionDoc, setVersionDoc] = useState<Document | null>(null)
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [uploadingVersion, setUploadingVersion] = useState(false)
  const [versionComment, setVersionComment] = useState("")
  const versionFileRef = useRef<HTMLInputElement>(null)

  // Полный жизненный цикл документа (как на /documents): проверка, ревью,
  // подпись. Права берём с бэкенда — тот же docPermSet, что на общей странице.
  const [docPerms, setDocPerms] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)
  const [reviewDoc, setReviewDoc] = useState<Document | null>(null)
  const [isReviewOpen, setIsReviewOpen] = useState(false)
  const [signDoc, setSignDoc] = useState<Document | null>(null)
  const [isSignOpen, setIsSignOpen] = useState(false)

  const roleCode = getRoleCode(getCurrentUser())
  useEffect(() => {
    getMyPermissions()
      .then((data) => setDocPerms(new Set((data?.permissions || []).map((p: any) => p.action))))
      .catch(() => setDocPerms(new Set()))
  }, [])

  // fallback до загрузки прав — та же матрица, что на /documents
  const docPermFallback: Record<string, string[]> = {
    system_admin: ['documents.view', 'documents.create', 'documents.update', 'documents.delete', 'documents.send', 'documents.download'],
    management: ['documents.view', 'documents.create', 'documents.update', 'documents.send'],
    quality_control: ['documents.view', 'documents.update', 'documents.send', 'documents.download'],
    sales: ['documents.view', 'documents.send'],
    visa: ['documents.view', 'documents.send'],
    partner: ['documents.view'],
    hr: ['documents.view', 'documents.create', 'documents.update', 'documents.send', 'documents.download'],
    legal: ['documents.view', 'documents.create', 'documents.update', 'documents.send', 'documents.download'],
  }
  const docPermSet = docPerms.size > 0 ? docPerms : new Set(docPermFallback[roleCode || ''] || [])
  const canDownloadDocs = docPermSet.has('documents.download')
  const canSendDocs = docPermSet.has('documents.send')
  const canUpdateDocs = docPermSet.has('documents.update')

  const loadDocs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await ClientAPI.getClientDocuments(client.id, {
        page, size: 20,
        q: search || undefined,
        status: statusFilter || undefined,
        doc_type: typeFilter || undefined,
      })
      setDocs(res.items || [])
      setTotal(res.total || 0)
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [client.id, page, search, statusFilter, typeFilter, toast])

  useEffect(() => { loadDocs() }, [loadDocs])

  const loadVersions = async (doc: Document) => {
    setVersionDoc(doc)
    setVersionsLoading(true)
    try {
      const v = await getDocumentVersions(doc.id)
      setVersions(v)
    } catch {
      setVersions([])
    } finally {
      setVersionsLoading(false)
    }
  }

  const handleUploadVersion = async () => {
    if (!versionDoc || !versionFileRef.current?.files?.[0]) return
    setUploadingVersion(true)
    try {
      await uploadDocumentVersion(versionDoc.id, versionFileRef.current.files[0], versionComment || undefined)
      toast({ title: "Версия загружена" })
      setVersionComment("")
      versionFileRef.current.value = ""
      const v = await getDocumentVersions(versionDoc.id)
      setVersions(v)
      loadDocs()
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" })
    } finally {
      setUploadingVersion(false)
    }
  }

  const handleDownloadVersion = async (docId: number, versionId: number) => {
    try {
      const blob = await downloadDocumentVersion(docId, versionId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `version_${versionId}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" })
    }
  }

  const handleRestoreVersion = async (docId: number, versionId: number) => {
    try {
      await restoreDocumentVersion(docId, versionId)
      toast({ title: "Версия восстановлена" })
      const v = await getDocumentVersions(docId)
      setVersions(v)
      loadDocs()
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" })
    }
  }

  const handleViewDocument = (doc: Document) => {
    setSelectedPdfDoc(doc)
    setIsPdfViewerOpen(true)
  }

  // Отправить на проверку (draft → under_review)
  const handleSubmit = async (doc: Document) => {
    setActionLoading(true)
    try {
      await DocAPI.submitDocument(doc.id)
      toast({ title: "Документ отправлен на проверку" })
      loadDocs()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Ошибка", description: err?.message || "Не удалось отправить на проверку" })
    } finally {
      setActionLoading(false)
    }
  }

  // Ревью: утвердить (approve) или вернуть на доработку (return)
  const handleReview = async (action: "approve" | "return") => {
    if (!reviewDoc) return
    setActionLoading(true)
    try {
      await DocAPI.reviewDocument(reviewDoc.id, action)
      toast({ title: action === "approve" ? "Документ утверждён" : "Документ возвращён на доработку" })
      setIsReviewOpen(false)
      setReviewDoc(null)
      loadDocs()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Ошибка", description: err?.message || "Не удалось выполнить ревью" })
    } finally {
      setActionLoading(false)
    }
  }

  // Отправка документа клиенту в WhatsApp (ТЗ п.2.3): генерируем публичную
  // ссылку и шлём её в чат клиента через Wazzup
  const handleSendToWhatsApp = async (doc: Document) => {
    const phone = (client.phone || (client as any).primary_phone || "").replace(/\D/g, "")
    if (!phone) {
      toast({ variant: "destructive", title: "У клиента не указан телефон" })
      return
    }
    try {
      const { url } = await DocAPI.generateSignLink(doc.id)
      const title = (doc as any).title || DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type || `Документ #${doc.id}`
      await sendWazzupMessage(phone, `Здравствуйте! Направляем вам документ «${title}»: ${url}`)
      toast({ title: "Документ отправлен клиенту в WhatsApp" })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Не удалось отправить",
        description: err?.response?.data?.error || err?.message || "Проверьте интеграцию WhatsApp и статус документа",
      })
    }
  }

  // ── Массовое формирование документов из шаблонов (ТЗ п.2.4) ──
  // Менеджер отмечает галочками нужные шаблоны (договор 50/50, анкета,
  // заявления...), документы формируются автоматически с данными клиента.
  const [isGenerateOpen, setIsGenerateOpen] = useState(false)
  const [docTypes, setDocTypes] = useState<Array<{ doc_type: string; title_ru: string }>>([])
  const [docTypesLoading, setDocTypesLoading] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>({})
  const [generating, setGenerating] = useState(false)

  const openGenerateDialog = async () => {
    setIsGenerateOpen(true)
    if (docTypes.length === 0) {
      setDocTypesLoading(true)
      try {
        const types = await DocAPI.listDocumentTypes()
        setDocTypes(Array.isArray(types) ? types : [])
      } catch {
        toast({ title: "Ошибка", description: "Не удалось загрузить список шаблонов", variant: "destructive" })
      } finally {
        setDocTypesLoading(false)
      }
    }
  }

  const handleGenerateSelected = async () => {
    const chosen = Object.keys(selectedTypes).filter((k) => selectedTypes[k])
    if (chosen.length === 0) {
      toast({ title: "Выберите хотя бы один шаблон" })
      return
    }
    setGenerating(true)
    let ok = 0
    const failed: string[] = []
    for (const docType of chosen) {
      try {
        await DocAPI.createDocumentFromClient({
          client_id: client.id,
          client_type: (client.client_type as any) || "individual",
          deal_id: 0, // сервер возьмёт последнюю сделку клиента
          doc_type: docType,
          extra: {},
        } as any)
        ok++
      } catch {
        const spec = docTypes.find((t) => t.doc_type === docType)
        failed.push(spec?.title_ru || docType)
      }
    }
    setGenerating(false)
    if (ok > 0) {
      toast({ title: `Сформировано документов: ${ok}` })
      setSelectedTypes({})
      setIsGenerateOpen(false)
      loadDocs()
    }
    if (failed.length > 0) {
      toast({
        variant: "destructive",
        title: "Не удалось сформировать",
        description: `${failed.join(", ")}. Проверьте, что у клиента заполнены обязательные поля и есть сделка.`,
      })
    }
  }

  const handleDownloadDocument = async (doc: Document, format: "pdf" | "docx") => {
    try {
      const blob = await DocAPI.downloadDocument(doc.id, format)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `document_${doc.id}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Поиск..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm rounded-md border border-input bg-background"
        >
          <option value="">Все статусы</option>
          {Object.entries(DOC_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm rounded-md border border-input bg-background"
        >
          <option value="">Все типы</option>
          {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={loadDocs}>
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button size="sm" onClick={openGenerateDialog}>
          <FileText className="w-4 h-4 mr-1.5" />
          Сформировать документы
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">
          {total} {total === 1 ? "документ" : total < 5 ? "документа" : "документов"}
        </span>
      </div>

      {/* Диалог массового формирования документов (ТЗ п.2.4) */}
      <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Сформировать документы</DialogTitle>
            <DialogDescription>
              Отметьте шаблоны — документы сформируются автоматически с данными клиента.
              Позже можно вернуться и добавить ещё (заявления, соглашения и т.д.).
            </DialogDescription>
          </DialogHeader>
          {docTypesLoading ? (
            <div className="py-6 text-center">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {docTypes.map((t) => (
                <label
                  key={t.doc_type}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={!!selectedTypes[t.doc_type]}
                    onChange={(e) =>
                      setSelectedTypes((prev) => ({ ...prev, [t.doc_type]: e.target.checked }))
                    }
                  />
                  <span className="text-sm">{t.title_ru || t.doc_type}</span>
                </label>
              ))}
              {docTypes.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">Шаблоны не найдены</p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsGenerateOpen(false)} disabled={generating}>
              Отмена
            </Button>
            <Button onClick={handleGenerateSelected} disabled={generating || docTypesLoading}>
              {generating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Формирование...
                </>
              ) : (
                "Сформировать"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Нет документов</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <Card key={doc.id} className="p-3 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">
                      {DOC_TYPE_LABELS[doc.doc_type as DocType] || doc.doc_type}
                    </span>
                    <Badge variant="outline" className={`text-xs ${DOC_STATUS_COLORS[doc.status] || ""}`}>
                      {DOC_STATUS_LABELS[doc.status as DocStatus] || doc.status}
                    </Badge>
                    {doc.sign_status && doc.sign_status !== "pending" && (
                      <Badge variant="outline" className="text-xs">
                        {SIGN_STATUS_LABELS[doc.sign_status] || doc.sign_status}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>ID: {doc.id}</span>
                    <span>{formatDate(doc.created_at)}</span>
                    {doc.deal_id && <span>Сделка #{doc.deal_id}</span>}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleViewDocument(doc)}>
                      <Eye className="w-4 h-4 mr-2" /> Просмотр
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Download className="w-4 h-4 mr-2" /> Скачать
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => handleDownloadDocument(doc, "pdf")} disabled={!canDownloadDocs}>
                          <FileText className="w-4 h-4 mr-2" /> PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownloadDocument(doc, "docx")} disabled={!canDownloadDocs}>
                          <FileText className="w-4 h-4 mr-2" /> Word
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem onClick={() => loadVersions(doc)}>
                      <History className="w-4 h-4 mr-2" /> История версий
                    </DropdownMenuItem>

                    {/* Жизненный цикл документа (как на /documents) — по статусу */}
                    {(
                      (canUpdateDocs && doc.status === "draft") ||
                      (canUpdateDocs && doc.status === "under_review") ||
                      (canSendDocs && doc.status === "approved")
                    ) && <DropdownMenuSeparator />}
                    {canUpdateDocs && doc.status === "draft" && (
                      <DropdownMenuItem onClick={() => handleSubmit(doc)}>
                        <Send className="w-4 h-4 mr-2" /> Отправить на проверку
                      </DropdownMenuItem>
                    )}
                    {canUpdateDocs && doc.status === "under_review" && (
                      <DropdownMenuItem onClick={() => { setReviewDoc(doc); setIsReviewOpen(true) }}>
                        <ShieldCheck className="w-4 h-4 mr-2" /> Ревью
                      </DropdownMenuItem>
                    )}
                    {canSendDocs && doc.status === "approved" && (
                      <DropdownMenuItem onClick={() => { setSignDoc(doc); setIsSignOpen(true) }}>
                        <Send className="w-4 h-4 mr-2" /> Отправить на подпись
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />
                    {/* Отправка клиенту в WhatsApp (ТЗ п.2.3) */}
                    <DropdownMenuItem onClick={() => handleSendToWhatsApp(doc)}>
                      <Send className="w-4 h-4 mr-2" /> Отправить в WhatsApp
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* PDF Viewer */}
      <PdfViewer
        isOpen={isPdfViewerOpen}
        onClose={() => setIsPdfViewerOpen(false)}
        documentId={selectedPdfDoc?.id || 0}
        documentName={selectedPdfDoc ? (DOC_TYPE_LABELS[selectedPdfDoc.doc_type as DocType] || selectedPdfDoc.doc_type) : undefined}
      />

      {/* Ревью документа: утвердить / вернуть */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ревью документа #{reviewDoc?.id}</DialogTitle>
            <DialogDescription>Утвердите или верните документ на доработку.</DialogDescription>
          </DialogHeader>
          {reviewDoc && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Тип:</span>
              <span className="font-medium">{DOC_TYPE_LABELS[reviewDoc.doc_type as DocType] || reviewDoc.doc_type}</span>
              <Badge variant="outline" className={`text-xs ${DOC_STATUS_COLORS[reviewDoc.status] || ""}`}>
                {DOC_STATUS_LABELS[reviewDoc.status as DocStatus] || reviewDoc.status}
              </Badge>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsReviewOpen(false)} disabled={actionLoading}>Отмена</Button>
            <Button
              variant="outline"
              onClick={() => handleReview("return")}
              disabled={actionLoading}
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              <XCircle className="w-4 h-4 mr-2" /> Вернуть
            </Button>
            <Button onClick={() => handleReview("approve")} disabled={actionLoading} className="bg-green-600 hover:bg-green-700">
              <ShieldCheck className="w-4 h-4 mr-2" /> Утвердить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Отправка документа на подпись клиенту */}
      <SendForSignatureModal
        open={isSignOpen}
        onOpenChange={setIsSignOpen}
        document={signDoc}
        docTypeLabel={signDoc ? (DOC_TYPE_LABELS[signDoc.doc_type as DocType] || signDoc.doc_type) : undefined}
        onSuccess={() => { setIsSignOpen(false); loadDocs() }}
      />

      {/* Version dialog */}
      <Dialog open={!!versionDoc} onOpenChange={(isOpen: boolean) => { if (!isOpen) setVersionDoc(null) }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>История версий</DialogTitle>
            <DialogDescription>
              {versionDoc ? DOC_TYPE_LABELS[versionDoc.doc_type as DocType] || versionDoc.doc_type : ""} (ID: {versionDoc?.id})
            </DialogDescription>
          </DialogHeader>

          {/* Upload new version */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <input
              ref={versionFileRef}
              type="file"
              accept=".pdf,.docx,.xlsx"
              className="text-sm flex-1"
            />
            <input
              placeholder="Комментарий"
              value={versionComment}
              onChange={(e) => setVersionComment(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm rounded-md border border-input bg-background"
            />
            <Button size="sm" onClick={handleUploadVersion} disabled={uploadingVersion}>
              <Upload className="w-4 h-4 mr-1" />
              {uploadingVersion ? "Загрузка..." : "Загрузить"}
            </Button>
          </div>

          {/* Versions list */}
          {versionsLoading ? (
            <div className="py-8 text-center"><RefreshCw className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Версий нет — текущий файл является первой версией
            </p>
          ) : (
            <div className="space-y-2">
              {versions.map((v, idx) => (
                <div key={v.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                    v{v.version}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Версия {v.version}</span>
                      {idx === 0 && <Badge variant="outline" className="text-xs">текущая</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                      <span>{formatDateTime(v.created_at)}</span>
                      <span>{formatFileSize(v.file_size || 0)}</span>
                      {v.comment && <span>— {v.comment}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadVersion(versionDoc!.id, v.id)}>
                      <Download className="w-4 h-4" />
                    </Button>
                    {idx !== 0 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRestoreVersion(versionDoc!.id, v.id)}>
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Deals Section ──────────────────────────────────────────────────

const DEAL_STATUS_LABELS: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  won: "Выиграна",
  lost: "Проиграна",
  cancelled: "Отменена",
}

const DEAL_STATUS_COLORS: Record<string, string> = {
  new: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-100 text-amber-700",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-100 text-slate-500",
}

function DealsSection({ client }: { client: Client }) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError("")
      try {
        const res = await list_deals(undefined, { client_id: client.id, size: 50 })
        setDeals(res.items || res.data || [])
      } catch (err: any) {
        setError(err.message || "Не удалось загрузить сделки")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [client.id])

  if (loading) return <div className="py-8 text-center"><RefreshCw className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
  if (error) return <p className="text-sm text-destructive text-center py-8">{error}</p>
  if (deals.length === 0) return (
    <div className="text-center py-12 text-muted-foreground">
      <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
      <p className="text-sm">Нет сделок</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {deals.map((deal) => (
        <Card
          key={deal.id}
          className="p-3 hover:shadow-sm transition-shadow cursor-pointer"
          onClick={() => router.push(`/deals?id=${deal.id}`)}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">Сделка #{deal.id}</span>
                <Badge variant="outline" className={`text-xs ${DEAL_STATUS_COLORS[deal.status] || ""}`}>
                  {DEAL_STATUS_LABELS[deal.status] || deal.status}
                </Badge>
                {(deal.is_archived || deal.archived) && (
                  <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500">Архив</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{deal.amount} {deal.currency}</span>
                {deal.created_at && <span>{formatDate(deal.created_at)}</span>}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ─── Calls Section ──────────────────────────────────────────────────

function CallsSection({ client }: { client: Client }) {
  const [calls, setCalls] = useState<TelephonyCall[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await getClientCalls(Number(client.id), 50)
        setCalls(res.items || [])
      } catch (err: any) {
        setError(err.message || "Не удалось загрузить звонки")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [client.id])

  if (loading) return <div className="py-8 text-center"><RefreshCw className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
  if (error) return <p className="text-sm text-destructive text-center py-8">{error}</p>
  if (calls.length === 0) return (
    <div className="text-center py-12 text-muted-foreground">
      <Phone className="w-10 h-10 mx-auto mb-3 opacity-40" />
      <p className="text-sm">Нет звонков</p>
    </div>
  )

  const directionIcon = (d?: string) => {
    if (d === "inbound") return <Phone className="w-3.5 h-3.5 text-emerald-500" />
    if (d === "outbound") return <Phone className="w-3.5 h-3.5 text-blue-500" />
    return <Phone className="w-3.5 h-3.5 text-muted-foreground" />
  }

  const statusBadge = (s?: string) => {
    const map: Record<string, string> = {
      answered: "bg-emerald-100 text-emerald-700",
      completed: "bg-emerald-100 text-emerald-700",
      missed: "bg-rose-100 text-rose-700",
      failed: "bg-rose-100 text-rose-700",
    }
    return map[s || ""] || "bg-slate-100 text-slate-600"
  }

  return (
    <div className="space-y-2">
      {calls.map((call) => (
        <Card key={call.id} className="p-3">
          <div className="flex items-center gap-3">
            {directionIcon(call.direction)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{call.phone || call.normalized_phone || "Неизвестный"}</span>
                <Badge variant="outline" className={`text-xs ${statusBadge(call.status)}`}>
                  {call.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground flex gap-2">
                <span>{formatDateTime(call.started_at)}</span>
                {call.duration_seconds != null && <span>{call.duration_seconds}с</span>}
                {call.manager_name && <span>{call.manager_name}</span>}
              </div>
            </div>
            {call.recording_url && (
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <a href={call.recording_url} target="_blank" rel="noopener noreferrer">
                  <PlayCircle className="w-4 h-4" />
                </a>
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function ClientProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const clientId = String(params.id)

  const [client, setClient] = useState<Client | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeSection, setActiveSection] = useState<SectionKey>("overview")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [calling, setCalling] = useState(false)

  // Permission check
  const user = getCurrentUser()
  const roleCode = getRoleCode(user)
  const canEdit = user ? hasPermission(roleCode, ["clients:write"]) : false
  const canViewDocs = user ? hasPermission(roleCode, ["documents:read"]) : false

  // Load client
  const loadClient = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [clientData, profileData] = await Promise.all([
        ClientAPI.getClientById(clientId),
        ClientAPI.getClientProfile(clientId),
      ])
      setClient(clientData)
      setProfile(profileData)

      // Load avatar
      try {
        const url = await ClientAPI.loadClientAvatar(clientId)
        setAvatarUrl(url)
      } catch {
        setAvatarUrl(null)
      }
    } catch (err: any) {
      setError(err.message || "Не удалось загрузить клиента")
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { loadClient() }, [loadClient])

  // Avatar handlers
  const handleAvatarUpload = async (file: File) => {
    try {
      await ClientAPI.uploadClientAvatar(clientId, file)
      const url = await ClientAPI.loadClientAvatar(clientId)
      setAvatarUrl(url)
      toast({ title: "Аватар обновлён" })
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" })
    }
  }

  const handleAvatarDelete = async () => {
    try {
      await ClientAPI.deleteClientAvatar(clientId)
      setAvatarUrl(null)
      toast({ title: "Аватар удалён" })
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" })
    }
  }

  // Edit redirect
  const handleEdit = () => {
    router.push(`/clients?edit=${clientId}`)
  }

  const handleClientCall = async () => {
    const phone = client?.primary_phone || client?.phone
    if (!phone) return
    setCalling(true)
    try {
      await initiateCall(phone)
      toast({ title: "Звонок инициирован", description: `Набираем ${phone}` })
    } catch (err: any) {
      toast({
        title: "Ошибка звонка",
        description: err?.response?.data?.error ?? err?.message ?? "Неизвестная ошибка",
        variant: "destructive",
      })
    } finally {
      setCalling(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-2 mb-6">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="w-full sm:w-56 shrink-0 space-y-4">
            <Skeleton className="w-24 h-24 rounded-full mx-auto" />
            <Skeleton className="h-5 w-32 mx-auto" />
            <Skeleton className="h-4 w-24 mx-auto" />
          </div>
          <div className="flex-1 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-2">Не удалось загрузить клиента</h2>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={() => router.push("/clients")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> К списку клиентов
        </Button>
      </div>
    )
  }

  const clientName = client.display_name || client.name || "Без имени"
  const clientType = client.client_type === "legal" ? "Юр. лицо" : "Физ. лицо"
  const isArchived = client.is_archived || client.archived

  const visibleNavItems = NAV_ITEMS

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2"
        onClick={() => router.push("/clients")}
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> К списку клиентов
      </Button>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left sidebar */}
        <div className="w-full md:w-56 shrink-0">
          <Card className="p-4 md:sticky md:top-4">
            {/* Avatar */}
            <ClientAvatar
              client={client}
              avatarUrl={avatarUrl}
            />

            {/* Client info */}
            <div className="mt-3 text-center">
              <h2 className="font-semibold text-sm truncate">{clientName}</h2>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <Badge variant="outline" className="text-xs">
                  {clientType}
                </Badge>
                {isArchived && (
                  <Badge variant="destructive" className="text-xs">Архив</Badge>
                )}
              </div>
              {(client.primary_phone || client.phone) && (
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  <p className="text-xs text-muted-foreground truncate">
                    {client.primary_phone || client.phone}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={handleClientCall}
                    disabled={calling}
                    title="Позвонить"
                  >
                    <PhoneCall className="w-3 h-3 text-emerald-600" />
                  </Button>
                </div>
              )}
            </div>

            <Separator className="my-3" />

            {/* Mobile: horizontal tabs */}
            <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
              {visibleNavItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveSection(item.key)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap ${
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

            {canEdit && (
              <>
                <Separator className="my-3" />
                <Button variant="outline" size="sm" className="w-full" onClick={handleEdit}>
                  <Edit className="w-4 h-4 mr-2" /> Редактировать
                </Button>
              </>
            )}
          </Card>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold mb-4">
            {activeSection === "overview" && "Обзор"}
            {activeSection === "deals" && "Сделки"}
            {activeSection === "documents" && "Документы"}
            {activeSection === "calls" && "Звонки"}
          </h1>

          {activeSection === "overview" && (
            <div className="space-y-6">
              <OverviewSection client={client} profile={profile} />
              {/* Сканы документов клиента (паспорт, удостоверение, права,
                  дипломы, справки) с просмотром и увеличением */}
              <ClientAttachments clientId={Number(client.id)} canEdit={canEdit} />
            </div>
          )}
          {activeSection === "deals" && <DealsSection client={client} />}
          {activeSection === "documents" && (
            canViewDocs
              ? <DocumentsSection client={client} />
              : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Нет доступа к документам</p>
                </div>
              )
          )}
          {activeSection === "calls" && <CallsSection client={client} />}
        </div>
      </div>
    </div>
  )
}
