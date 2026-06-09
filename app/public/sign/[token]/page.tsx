"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import {
    FileText,
    PenTool,
    CheckCircle2,
    XCircle,
    Loader2,
    Eraser,
    AlertTriangle,
    Download,
    Shield,
    Clock,
    Bell,
    Link2,
    Hash,
    FileCheck,
    Mail,
    Info,
    ChevronDown,
    Sparkles,
    Lock,
    Eye,
} from "lucide-react"
import { getPublicDocument, submitPublicSign } from "@/src/api/documents.api"

// ─── Helpers: HTTPS enforcement ──────────────────────────────────

/** Force any URL to use https:// protocol to prevent mixed-content */
function enforceHttps(url: string): string {
    if (!url) return url
    return url.replace(/^http:\/\//i, 'https://')
}

// ─── Types ───────────────────────────────────────────────────────

interface PublicDocData {
    id: number
    doc_type: string
    doc_type_label?: string
    deal_id?: number
    file_url?: string
    file_path_docx?: string
    file_path_pdf?: string
    status: string
    status_label?: string
    client_name?: string
    company_name?: string
    has_telegram_bot?: boolean
    expires_at?: string
    created_at?: string
}

type PageState = "loading" | "ready" | "expired" | "signing" | "success" | "error"

// ─── Helpers ─────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
    contract_full: "Полный контракт",
    full_contract: "Полный контракт",
    invoice: "Счёт-фактура",
    agreement: "Договор",
    act: "Акт выполненных работ",
    nda: "Соглашение о конфиденциальности",
    offer: "Коммерческое предложение",
    addendum: "Дополнительное соглашение",
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
    draft: { label: "Черновик", color: "text-gray-700", bg: "bg-gray-100", border: "border-gray-200", icon: "📝" },
    pending: { label: "Ожидает подписи", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", icon: "⏳" },
    approved: { label: "Утверждено", color: "text-green-700", bg: "bg-green-50", border: "border-green-200", icon: "✅" },
    signed: { label: "Подписано", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", icon: "✍️" },
    rejected: { label: "Отклонено", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", icon: "❌" },
    expired: { label: "Истёк срок", color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200", icon: "⌛" },
}

function getDocTypeLabel(docType: string): string {
    return DOC_TYPE_LABELS[docType] || docType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
}

function getStatusStyle(status: string) {
    return STATUS_CONFIG[status] || STATUS_CONFIG.draft
}

function formatDate(dateStr: string): string {
    try {
        const date = new Date(dateStr)
        return date.toLocaleString("ru-RU", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
    } catch {
        return dateStr
    }
}

function getTimeRemaining(expiresAt: string): { text: string; isExpired: boolean; isUrgent: boolean } {
    try {
        const now = new Date()
        const expires = new Date(expiresAt)
        const diff = expires.getTime() - now.getTime()

        if (diff <= 0) return { text: "Ссылка истекла", isExpired: true, isUrgent: false }

        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

        if (hours > 24) {
            const days = Math.floor(hours / 24)
            return { text: `${days} д. ${hours % 24} ч.`, isExpired: false, isUrgent: false }
        }
        if (hours > 0) {
            return { text: `${hours} ч. ${minutes} мин.`, isExpired: false, isUrgent: hours < 3 }
        }
        return { text: `${minutes} мин.`, isExpired: false, isUrgent: true }
    } catch {
        return { text: "Неизвестно", isExpired: false, isUrgent: false }
    }
}

// ─── Signature Pad Component ─────────────────────────────────────

function SignaturePad({
    onSignatureChange,
}: {
    onSignatureChange: (data: string | null) => void
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasContent, setHasContent] = useState(false)

    const getCtx = () => canvasRef.current?.getContext("2d") || null

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return { x: 0, y: 0 }
        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height

        if ("touches" in e) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY,
            }
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        }
    }

    const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault()
        const ctx = getCtx()
        if (!ctx) return
        const pos = getPos(e)
        ctx.beginPath()
        ctx.moveTo(pos.x, pos.y)
        setIsDrawing(true)
    }

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault()
        if (!isDrawing) return
        const ctx = getCtx()
        if (!ctx) return
        const pos = getPos(e)
        ctx.lineWidth = 2.5
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        ctx.strokeStyle = "#1a1a2e"
        ctx.lineTo(pos.x, pos.y)
        ctx.stroke()
        setHasContent(true)
    }

    const stopDraw = () => {
        setIsDrawing(false)
        if (hasContent && canvasRef.current) {
            onSignatureChange(canvasRef.current.toDataURL("image/png"))
        }
    }

    const clear = () => {
        const ctx = getCtx()
        const canvas = canvasRef.current
        if (!ctx || !canvas) return
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        setHasContent(false)
        onSignatureChange(null)
    }

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const parent = canvas.parentElement
        if (!parent) return
        const dpr = window.devicePixelRatio || 1
        canvas.width = parent.clientWidth * dpr
        canvas.height = 200 * dpr
        const ctx = canvas.getContext("2d")
        if (ctx) {
            ctx.scale(dpr, dpr)
        }
    }, [])

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <PenTool className="h-4 w-4 text-gray-500" />
                    <p className="text-sm font-medium text-gray-700">
                        Ваша подпись
                    </p>
                </div>
                {hasContent && (
                    <button
                        onClick={clear}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        <Eraser className="h-3.5 w-3.5" />
                        Очистить
                    </button>
                )}
            </div>
            <div
                className="relative rounded-2xl border-2 border-dashed border-gray-300 bg-white overflow-hidden cursor-crosshair touch-none transition-colors hover:border-gray-400 focus-within:border-blue-400"
                style={{
                    background: "linear-gradient(135deg, #fefefe 0%, #f8fafc 100%)",
                }}
            >
                {/* Baseline hint */}
                <div
                    className="absolute left-6 right-6 border-b border-gray-200"
                    style={{ bottom: "40px" }}
                />
                <div
                    className="absolute text-[10px] text-gray-300 font-medium tracking-wider uppercase"
                    style={{ bottom: "20px", left: "24px" }}
                >
                    x подпись
                </div>
                <canvas
                    ref={canvasRef}
                    className="w-full relative z-10"
                    style={{ height: "200px" }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={stopDraw}
                />
            </div>
            {!hasContent && (
                <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    Нарисуйте подпись мышкой или пальцем
                </p>
            )}
        </div>
    )
}

// ─── Loading Skeleton ────────────────────────────────────────────

function LoadingSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Header skeleton */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-200" />
                    <div className="space-y-2 flex-1">
                        <div className="h-5 bg-gray-200 rounded-lg w-48" />
                        <div className="h-3 bg-gray-100 rounded w-32" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="space-y-2">
                            <div className="h-3 bg-gray-100 rounded w-20" />
                            <div className="h-5 bg-gray-200 rounded w-28" />
                        </div>
                    ))}
                </div>
            </div>
            {/* Signature skeleton */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
                <div className="h-5 bg-gray-200 rounded w-36" />
                <div className="h-10 bg-gray-100 rounded-xl" />
                <div className="h-[200px] bg-gray-100 rounded-2xl" />
                <div className="h-12 bg-gray-200 rounded-xl" />
            </div>
        </div>
    )
}

// ─── Expired State ───────────────────────────────────────────────

function ExpiredView() {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
            {/* Top gradient accent */}
            <div className="h-1.5 bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300" />

            <div className="p-8 sm:p-12 text-center">
                {/* Icon */}
                <div className="relative mx-auto mb-6 w-24 h-24">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse opacity-50" />
                    <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        <Clock className="h-12 w-12 text-gray-400" />
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                    Срок действия ссылки истёк
                </h2>
                <p className="text-base text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
                    Срок действия ссылки истек. Пожалуйста, запросите новую у менеджера.
                </p>

                {/* Contact hint */}
                <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-5 max-w-sm mx-auto">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                            <Mail className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-semibold text-blue-900">
                                Свяжитесь с менеджером
                            </p>
                            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                                Обратитесь к вашему менеджеру для получения
                                новой ссылки на подписание документа.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Main Public Page ────────────────────────────────────────────

export default function PublicSignPage() {
    const params = useParams<{ token: string }>()
    const token = params.token

    const [pageState, setPageState] = useState<PageState>("loading")
    const [docData, setDocData] = useState<PublicDocData | null>(null)
    const [signatureData, setSignatureData] = useState<string | null>(null)
    const [email, setEmail] = useState("")
    const [emailError, setEmailError] = useState("")
    const [error, setError] = useState("")
    const [showHowItWorks, setShowHowItWorks] = useState(false)
    const [showMemo, setShowMemo] = useState(false)

    // Detect whether the page is served over HTTPS
    const [isSecure, setIsSecure] = useState(true)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsSecure(window.location.protocol === 'https:')
        }
    }, [])

    // Validate email
    const validateEmail = (value: string): boolean => {
        if (!value.trim()) {
            setEmailError("Введите Email для юридического подтверждения")
            return false
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(value)) {
            setEmailError("Введите корректный Email адрес")
            return false
        }
        setEmailError("")
        return true
    }

    // Load document
    useEffect(() => {
        if (!token) return
        const load = async () => {
            try {
                const res = await getPublicDocument(token)
                // Handle both { document: {...} } and direct data shapes
                const data = res?.document || res
                setDocData(data)

                // Check expiry
                if (data?.expires_at) {
                    const expiresDate = new Date(data.expires_at)
                    const now = new Date()
                    if (now >= expiresDate) {
                        setPageState("expired")
                        return
                    }
                }

                setPageState("ready")
            } catch (err: any) {
                setError(
                    err?.response?.data?.message ||
                    err?.message ||
                    "Ссылка недействительна или истекла"
                )
                setPageState("error")
            }
        }
        load()
    }, [token])

    // Submit signature
    const handleSubmitSign = async () => {
        if (!signatureData) return
        if (!validateEmail(email)) return

        setPageState("signing")
        try {
            await submitPublicSign(token, signatureData, email)
            setPageState("success")
        } catch (err: any) {
            setError(
                err?.response?.data?.message ||
                err?.message ||
                "Ошибка при подписании документа"
            )
            setPageState("error")
        }
    }

    // Check link expiry
    const expiryInfo = docData?.expires_at ? getTimeRemaining(docData.expires_at) : null
    const isExpired = pageState === "expired" || (expiryInfo?.isExpired || false)

    // Derive sign-button disabled
    const isSubmitDisabled = pageState === "signing" || !signatureData || !email.trim()

    // ─── Render ──────────────────────────────────────────────────

    return (
        <div className="min-h-screen" style={{
            background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 25%, #ede9fe 50%, #e0e7ff 75%, #eef2ff 100%)",
        }}>
            {/* ══════ Header ══════ */}
            <header className="bg-white/80 backdrop-blur-xl border-b border-indigo-200/60 sticky top-0 z-50">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center shadow-lg shadow-indigo-600/25">
                        <FileText className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 tracking-tight">
                            Центр подписи документов
                        </h1>
                        <p className="text-xs text-gray-500">
                            Защищённый просмотр и подписание
                        </p>
                    </div>
                    {/* Security badge — dynamic based on HTTPS status */}
                    {isSecure ? (
                        <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
                            <Lock className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-[11px] font-medium text-green-700">Защищено (HTTPS)</span>
                        </div>
                    ) : (
                        <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            <span className="text-[11px] font-medium text-amber-700">Небезопасное соединение</span>
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
                {/* ══════ Loading ══════ */}
                {pageState === "loading" && <LoadingSkeleton />}

                {/* ══════ Expired ══════ */}
                {pageState === "expired" && <ExpiredView />}

                {/* ══════ Error ══════ */}
                {pageState === "error" && (
                    <div className="bg-white rounded-2xl border border-red-200 shadow-lg shadow-red-100/50 overflow-hidden">
                        {/* Top accent */}
                        <div className="h-1.5 bg-gradient-to-r from-red-400 via-red-500 to-red-400" />
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
                                <XCircle className="h-10 w-10 text-red-400" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">
                                Не удалось загрузить документ
                            </h2>
                            <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                                {error}
                            </p>
                            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 max-w-sm mx-auto">
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Если вы считаете, что это ошибка, обратитесь к
                                    отправителю документа для получения новой ссылки.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══════ Success ══════ */}
                {pageState === "success" && (
                    <div className="bg-white rounded-2xl border border-green-200 shadow-lg shadow-green-100/50 overflow-hidden">
                        {/* Top accent */}
                        <div className="h-1.5 bg-gradient-to-r from-green-400 via-emerald-500 to-green-400" />
                        <div className="relative p-8 text-center overflow-hidden">
                            {/* Celebration gradient */}
                            <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 via-transparent to-emerald-50/30 pointer-events-none" />
                            <div className="relative">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-200/40">
                                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                                </div>
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <Sparkles className="h-5 w-5 text-green-500" />
                                    <h2 className="text-2xl font-bold text-gray-900">
                                        Документ подписан!
                                    </h2>
                                </div>
                                <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto leading-relaxed">
                                    Ваша подпись успешно сохранена, статус документа обновлён.
                                    Менеджер получит уведомление.
                                </p>

                                <p className="text-xs text-gray-400">
                                    Вы можете закрыть эту страницу.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══════ Ready — Content ══════ */}
                {(pageState === "ready" || pageState === "signing") && docData && (
                    <>
                        {/* ── Status banner: Ожидает подписи ── */}
                        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 p-4 flex items-center gap-3 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/25">
                                <Eye className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-indigo-900">
                                    Ожидает вашей подписи
                                </p>
                                <p className="text-xs text-indigo-600 mt-0.5">
                                    Просмотрите документ, скачайте при необходимости и подпишите ниже
                                </p>
                            </div>
                        </div>

                        {/* ── Link Expiry warning ── */}
                        {expiryInfo && !expiryInfo.isExpired && (
                            <div className={`rounded-2xl border p-4 flex items-center gap-3 transition-all ${expiryInfo.isUrgent
                                ? "bg-amber-50 border-amber-200"
                                : "bg-blue-50 border-blue-200"
                                }`}>
                                <Clock className={`h-5 w-5 shrink-0 ${expiryInfo.isUrgent
                                    ? "text-amber-500"
                                    : "text-blue-500"
                                    }`} />
                                <div>
                                    <p className={`text-sm font-medium ${expiryInfo.isUrgent
                                        ? "text-amber-800"
                                        : "text-blue-800"
                                        }`}>
                                        Ссылка действительна: {expiryInfo.text}
                                    </p>
                                    {docData.expires_at && (
                                        <p className={`text-xs mt-0.5 ${expiryInfo.isUrgent ? "text-amber-600" : "text-blue-600"
                                            }`}>
                                            До {formatDate(docData.expires_at)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── Document info card ── */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                            {/* Top accent */}
                            <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-500" />

                            <div className="p-6">
                                {/* Title row */}
                                <div className="flex items-start gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
                                        <FileText className="h-6 w-6 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-xl font-bold text-gray-900 leading-tight">
                                            {docData.doc_type_label || getDocTypeLabel(docData.doc_type)}
                                        </h2>
                                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                            {/* Status badge */}
                                            {(() => {
                                                const style = getStatusStyle(docData.status)
                                                return (
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${style.bg} ${style.color} ${style.border} border`}>
                                                        <FileCheck className="h-3 w-3" />
                                                        {docData.status_label || style.label}
                                                    </span>
                                                )
                                            })()}
                                            {/* ID badge */}
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-gray-500 bg-gray-100 border border-gray-200 rounded-full">
                                                <Hash className="h-3 w-3" />
                                                ID: {docData.id}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Detail grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {docData.client_name && (
                                        <div className="space-y-1">
                                            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Клиент</p>
                                            <p className="text-sm font-medium text-gray-900">{docData.client_name}</p>
                                        </div>
                                    )}
                                    {docData.company_name && (
                                        <div className="space-y-1">
                                            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Компания</p>
                                            <p className="text-sm font-medium text-gray-900">{docData.company_name}</p>
                                        </div>
                                    )}
                                    {docData.deal_id && (
                                        <div className="space-y-1">
                                            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Сделка</p>
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md">
                                                <Link2 className="h-3 w-3" />
                                                deal#{docData.deal_id}
                                            </span>
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Тип документа</p>
                                        <p className="text-sm font-medium text-gray-900">
                                            {docData.doc_type_label || getDocTypeLabel(docData.doc_type)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Download section */}
                            {(docData.file_path_docx || docData.file_url || docData.file_path_pdf) && (
                                <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/50">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            {/* File icon */}
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${docData.file_path_docx
                                                ? "bg-blue-100 text-blue-700"
                                                : "bg-red-100 text-red-700"
                                                }`}>
                                                <span className="text-xs font-bold">
                                                    {docData.file_path_docx
                                                        ? "DOCX"
                                                        : "PDF"
                                                    }
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">
                                                    Файл документа
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Нажмите для скачивания
                                                </p>
                                            </div>
                                        </div>
                                        <a
                                            href={enforceHttps(docData.file_path_docx || docData.file_url || docData.file_path_pdf || '')}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            id="download-document-btn"
                                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl hover:from-indigo-500 hover:to-blue-500 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                                        >
                                            <Download className="h-4 w-4" />
                                            Скачать документ
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Document preview ── */}
                        {(docData.file_url || docData.file_path_pdf) && (
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-gray-500" />
                                    <h3 className="text-sm font-semibold text-gray-800">Просмотр документа</h3>
                                </div>
                                <div className="bg-gray-100">
                                    <iframe
                                        src={enforceHttps(docData.file_url || docData.file_path_pdf || '')}
                                        className="w-full"
                                        style={{ height: "500px" }}
                                        title="Просмотр документа"
                                    />
                                </div>
                            </div>
                        )}

                        {/* ── Client Memo / Instructions ── */}
                        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                            <button
                                onClick={() => setShowMemo(!showMemo)}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-amber-50/50 transition-colors"
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                                    </div>
                                    <span className="text-sm font-semibold text-gray-800">
                                        Памятка для клиента
                                    </span>
                                </div>
                                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${showMemo ? "rotate-180" : ""}`} />
                            </button>

                            <div
                                className="overflow-hidden transition-all duration-300 ease-in-out"
                                style={{
                                    maxHeight: showMemo ? "600px" : "0",
                                    opacity: showMemo ? 1 : 0,
                                }}
                            >
                                <div className="px-6 pb-6 space-y-3">
                                    {/* Confidentiality */}
                                    <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-red-50/50 to-orange-50/30 border border-red-100">
                                        <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                                            <Lock className="h-4 w-4 text-red-600" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-900 mb-1">
                                                Конфиденциальность
                                            </h4>
                                            <p className="text-xs text-gray-600 leading-relaxed">
                                                Код и ссылка на данный документ являются <strong>конфиденциальными</strong>.
                                                Не передавайте их третьим лицам. Ссылка предназначена только для вас
                                                и привязана к конкретному документу.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Notification */}
                                    <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-50/50 to-indigo-50/30 border border-blue-100">
                                        <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                            <Bell className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-900 mb-1">
                                                Уведомление
                                            </h4>
                                            <p className="text-xs text-gray-600 leading-relaxed">
                                                После подписания уведомление будет автоматически отправлено в систему.
                                                Менеджер получит информацию о том, что документ был подписан.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Security */}
                                    <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-green-50/50 to-emerald-50/30 border border-green-100">
                                        <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                                            <Shield className="h-4 w-4 text-green-600" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-900 mb-1">
                                                Безопасность
                                            </h4>
                                            <p className="text-xs text-gray-600 leading-relaxed">
                                                Все данные передаются по защищённому каналу.
                                                Ваша подпись и email хранятся в зашифрованном виде.
                                                Каждый документ имеет уникальный токен доступа.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Signature Section ── */}
                        {!isExpired && (
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                {/* Top accent */}
                                <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-500" />

                                <div className="px-6 py-4 border-b border-gray-100">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                                            <PenTool className="h-4 w-4 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-gray-900">Подписание документа</h3>
                                            <p className="text-xs text-gray-500">Заполните поля ниже для подтверждения</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 space-y-5">
                                    {/* Legal disclaimer */}
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                                        <div className="flex items-start gap-2.5">
                                            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                            <p className="text-xs text-amber-700 leading-relaxed">
                                                Поставив подпись, вы подтверждаете ознакомление с
                                                документом и согласие с его содержанием. Подпись
                                                имеет юридическую силу.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Email field */}
                                    <div className="space-y-2">
                                        <label htmlFor="sign-email" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                            <Mail className="h-4 w-4 text-gray-500" />
                                            Email для подтверждения
                                            <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                id="sign-email"
                                                type="email"
                                                value={email}
                                                onChange={(e) => {
                                                    setEmail(e.target.value)
                                                    if (emailError) validateEmail(e.target.value)
                                                }}
                                                onBlur={() => email && validateEmail(email)}
                                                placeholder="example@company.kz"
                                                autoComplete="email"
                                                className={`w-full px-4 py-3 text-sm rounded-xl border-2 bg-gray-50/50 focus:bg-white outline-none transition-all placeholder:text-gray-400 ${emailError
                                                    ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                                    : "border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                    }`}
                                            />
                                        </div>
                                        {emailError && (
                                            <p className="text-xs text-red-500 flex items-center gap-1">
                                                <XCircle className="h-3 w-3" />
                                                {emailError}
                                            </p>
                                        )}
                                        <p className="text-[11px] text-gray-400">
                                            Email используется для юридического подтверждения подписи
                                        </p>
                                    </div>

                                    {/* Signature pad */}
                                    <SignaturePad onSignatureChange={setSignatureData} />

                                    {/* Submit button */}
                                    <button
                                        id="sign-document-btn"
                                        onClick={handleSubmitSign}
                                        disabled={isSubmitDisabled}
                                        className="w-full h-14 flex items-center justify-center gap-2.5 text-base font-semibold text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-lg hover:shadow-xl"
                                        style={{
                                            background: isSubmitDisabled
                                                ? "#94a3b8"
                                                : "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)",
                                            boxShadow: isSubmitDisabled
                                                ? "0 4px 12px rgba(148,163,184,0.3)"
                                                : "0 4px 20px rgba(79,70,229,0.35)",
                                        }}
                                    >
                                        {pageState === "signing" ? (
                                            <>
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                Подписание...
                                            </>
                                        ) : (
                                            <>
                                                <PenTool className="h-5 w-5" />
                                                Подписать документ
                                            </>
                                        )}
                                    </button>

                                </div>
                            </div>
                        )}

                        {/* ── "How it works" section ── */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                            <button
                                onClick={() => setShowHowItWorks(!showHowItWorks)}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center gap-2.5">
                                    <Info className="h-5 w-5 text-indigo-500" />
                                    <span className="text-sm font-semibold text-gray-800">
                                        Как это работает
                                    </span>
                                </div>
                                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${showHowItWorks ? "rotate-180" : ""}`} />
                            </button>

                            <div
                                className="overflow-hidden transition-all duration-300 ease-in-out"
                                style={{
                                    maxHeight: showHowItWorks ? "600px" : "0",
                                    opacity: showHowItWorks ? 1 : 0,
                                }}
                            >
                                <div className="px-6 pb-6 space-y-4">
                                    {/* Step 1: Notifications */}
                                    <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-50/50 to-indigo-50/30 border border-blue-100">
                                        <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                            <Bell className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-900 mb-1">
                                                Уведомления
                                            </h4>
                                            <p className="text-xs text-gray-600 leading-relaxed">
                                                После подписания документа менеджер получит мгновенное уведомление о статусе подписания.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Step 2: Deal linkage */}
                                    <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-purple-50/50 to-indigo-50/30 border border-purple-100">
                                        <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                                            <Link2 className="h-4 w-4 text-purple-600" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-900 mb-1">
                                                Привязка к сделке
                                            </h4>
                                            <p className="text-xs text-gray-600 leading-relaxed">
                                                Данный документ привязан к конкретной сделке
                                                {docData.deal_id ? ` (deal#${docData.deal_id})` : ""} в системе CRM.
                                                Все действия фиксируются в истории сделки.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Step 3: Security */}
                                    <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-green-50/50 to-emerald-50/30 border border-green-100">
                                        <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                                            <Shield className="h-4 w-4 text-green-600" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-900 mb-1">
                                                Безопасность
                                            </h4>
                                            <p className="text-xs text-gray-600 leading-relaxed">
                                                Ссылка и код доступа к документу действуют ограниченное время.
                                                Не передавайте ссылку третьим лицам. Каждый документ имеет уникальный
                                                токен доступа, который привязан к вашей сессии.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </main>

            {/* ══════ Footer ══════ */}
            <footer className="bg-white/60 backdrop-blur-sm border-t border-indigo-200/60 mt-8">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center">
                                <FileText className="h-3 w-3 text-white" />
                            </div>
                            <span className="text-xs font-medium text-gray-500">CRM Platform</span>
                        </div>
                        <p className="text-[11px] text-gray-400 text-center sm:text-right">
                            Защищённая страница подписания документов © {new Date().getFullYear()}
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
