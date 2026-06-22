"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { getPublicDocument, signPublicDocument } from "@/src/api/documents.api"
import { Loader2, CheckCircle2, FileX2, AlertCircle, FileText } from "lucide-react"

type PageState = "loading" | "expired" | "already_signed" | "ready" | "success"

interface DocumentData {
  id: number
  title?: string
  name?: string
  file_url?: string
  doc_type?: string
  status?: string
}

interface SuccessData {
  signed_at?: string
  event_id?: string | number
}

export default function PublicSignPage() {
  const { token } = useParams<{ token: string }>()

  const [pageState, setPageState] = useState<PageState>("loading")
  const [document, setDocument] = useState<DocumentData | null>(null)
  const [successData, setSuccessData] = useState<SuccessData | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [signerName, setSignerName] = useState("")
  const [signerPhone, setSignerPhone] = useState("")

  useEffect(() => {
    if (!token) return
    loadDocument()
  }, [token])

  async function loadDocument() {
    try {
      const data = await getPublicDocument(token)
      setDocument(data?.document ?? data)
      setPageState("ready")
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status
      if (status === 410) {
        setPageState("expired")
      } else if (status === 409) {
        setPageState("already_signed")
      } else {
        setPageState("expired")
      }
    }
  }

  async function handleSign() {
    if (!signerName.trim()) {
      setError("Пожалуйста, введите ФИО подписанта")
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const result = await signPublicDocument(token, {
        signer_name: signerName.trim(),
        signer_phone: signerPhone.trim() || undefined,
      })
      setSuccessData(result)
      setPageState("success")
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status
      if (status === 410) {
        setPageState("expired")
      } else if (status === 409) {
        setPageState("already_signed")
      } else {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Ошибка при подписании документа"
        setError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const docTitle = document?.title || document?.name || "Документ"

  if (pageState === "loading") {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 py-16">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <p className="text-slate-500">Загрузка документа...</p>
        </div>
      </PageShell>
    )
  }

  if (pageState === "expired") {
    return (
      <PageShell>
        <StatusCard
          icon={<FileX2 className="h-12 w-12 text-red-400" />}
          title="Ссылка недействительна"
          description="Срок действия ссылки для подписания истёк или она была отозвана. Пожалуйста, обратитесь к отправителю за новой ссылкой."
        />
      </PageShell>
    )
  }

  if (pageState === "already_signed") {
    return (
      <PageShell>
        <StatusCard
          icon={<CheckCircle2 className="h-12 w-12 text-green-400" />}
          title="Документ уже подписан"
          description="Этот документ уже был подписан ранее. Если у вас есть вопросы, обратитесь к отправителю."
        />
      </PageShell>
    )
  }

  if (pageState === "success") {
    const signedAt = successData?.signed_at
      ? new Date(successData.signed_at).toLocaleString("ru-KZ", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Date().toLocaleString("ru-KZ", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })

    return (
      <PageShell>
        <div className="flex flex-col items-center gap-6 py-8 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
          <div>
            <h2 className="text-xl font-semibold text-slate-800 mb-1">Документ подписан</h2>
            <p className="text-slate-500 text-sm">Подпись успешно принята</p>
          </div>
          <div className="w-full max-w-sm text-left border rounded-lg p-4 space-y-3 bg-slate-50">
            <InfoRow label="Документ" value={docTitle} />
            <InfoRow label="Дата подписания" value={signedAt} />
            {successData?.event_id && (
              <InfoRow label="Номер подтверждения" value={String(successData.event_id)} />
            )}
          </div>
          <p className="text-xs text-slate-400 max-w-xs">
            Сохраните эту страницу или сделайте снимок экрана как подтверждение подписания.
          </p>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <FileText className="h-8 w-8 text-blue-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-slate-500 mb-0.5">Документ для подписания</p>
            <p className="font-medium text-slate-800 truncate">{docTitle}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signer-name">
            ФИО подписанта <span className="text-red-500">*</span>
          </Label>
          <Input
            id="signer-name"
            placeholder="Иванов Иван Иванович"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signer-phone">Телефон</Label>
          <Input
            id="signer-phone"
            type="tel"
            placeholder="+7 (___) ___-__-__"
            value={signerPhone}
            onChange={(e) => setSignerPhone(e.target.value)}
            disabled={submitting}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          className="w-full"
          size="lg"
          onClick={handleSign}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Подписание...
            </>
          ) : (
            "Подписать документ"
          )}
        </Button>

        <p className="text-xs text-slate-400 text-center">
          Нажимая «Подписать документ», вы подтверждаете своё согласие с условиями документа
        </p>
      </div>
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center pt-8 pb-16 px-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-slate-800">Подписание документа</h1>
          <p className="text-sm text-slate-500 mt-1">Безопасная страница для электронной подписи</p>
        </div>
        <Card>
          <CardContent className="pt-6">{children}</CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatusCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      {icon}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">{title}</h2>
        <p className="text-sm text-slate-500 max-w-xs">{description}</p>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="font-medium text-slate-800 text-right">{value}</span>
    </div>
  )
}