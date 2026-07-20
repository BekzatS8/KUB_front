"use client"

/**
 * Предпросмотр шаблона документа (обратная связь 16.07.2026).
 *
 * Показывает, как выглядит бланк, до того как менеджер начнёт создавать по нему
 * документ клиенту. Вместо данных клиента — подписи полей («Фамилия Имя
 * Отчество», «сумма прописью»), чтобы было видно, что куда встанет.
 *
 * DOCX рендерит сам браузер (docx-preview) — сервер не гоняет LibreOffice ради
 * предпросмотра.
 */

import { useEffect, useRef, useState } from "react"
import { renderAsync } from "docx-preview"
import { FileText, Loader2, Stamp } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { previewDocumentTemplate } from "@/src/api/documents.api"

interface Props {
  open: boolean
  onClose: () => void
  docType: string | null
  title?: string
}

export function TemplatePreviewModal({ open, onClose, docType, title }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !docType) return
    let cancelled = false
    setLoading(true)
    setError(null)

    previewDocumentTemplate(docType)
      .then(async (blob) => {
        // контейнер появляется только после того, как загрузка сменилась
        // на контент, поэтому ждём кадр перед рендером
        if (cancelled) return
        setLoading(false)
        await new Promise((r) => requestAnimationFrame(() => r(null)))
        if (cancelled || !containerRef.current) return
        containerRef.current.innerHTML = ""
        await renderAsync(blob, containerRef.current, undefined, {
          className: "docx-container",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
        })
      })
      .catch((err: any) => {
        if (cancelled) return
        setLoading(false)
        setError(err?.message || "Не удалось загрузить предпросмотр")
      })

    return () => {
      cancelled = true
    }
  }, [open, docType])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            {title || "Предпросмотр шаблона"}
          </DialogTitle>
          <DialogDescription>
            Так выглядит бланк. Вместо данных клиента — названия полей: при создании
            документа они заполнятся автоматически.
          </DialogDescription>
        </DialogHeader>

        {/* docx-preview не рисует плавающие картинки за текстом (печать,
            подпись). В готовом документе они есть — предупреждаем, чтобы
            пустое место в предпросмотре не приняли за пропажу. */}
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Stamp className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Печать и подпись здесь не показываются — это ограничение предпросмотра.
            В сформированном документе (PDF) они будут на месте.
          </span>
        </div>

        <div className="max-h-[70vh] overflow-auto rounded-lg border bg-slate-50 p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Загружаем шаблон...
            </div>
          ) : error ? (
            <div className="py-20 text-center text-red-600">{error}</div>
          ) : (
            <div ref={containerRef} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
