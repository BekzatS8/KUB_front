"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Download, FileQuestion, LoaderCircle, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { driveErrorMessage, getDriveLink, type DriveNode } from "@/src/api/drive.api"
import { DriveNodeIcon, formatBytes } from "./drive-utils"

interface Props {
  /** Файлы текущей папки — для листания стрелками. */
  files: DriveNode[]
  node: DriveNode | null
  onNavigate: (node: DriveNode) => void
  onClose: () => void
}

/** Скачивание по временной ссылке: сервер отдаёт attachment, страница не уходит. */
export async function downloadDriveFile(node: DriveNode) {
  try {
    const url = await getDriveLink(node.id, { download: true })
    const a = document.createElement("a")
    a.href = url
    a.rel = "noopener"
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch (err) {
    toast.error(driveErrorMessage(err, "Не удалось скачать файл"))
  }
}

export function DrivePreviewDialog({ files, node, onNavigate, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Документ в iframe грузится (а офисный — ещё и конвертируется) отдельно
  // от получения ссылки, поэтому держим свой флаг до события onLoad.
  const [frameLoading, setFrameLoading] = useState(false)

  const kind = node?.preview || ""

  useEffect(() => {
    setUrl(null)
    setError(null)
    if (!node || !kind) return
    let cancelled = false
    setFrameLoading(kind === "pdf" || kind === "office" || kind === "text")
    getDriveLink(node.id, { variant: kind === "office" ? "pdf" : "original" })
      .then((u) => !cancelled && setUrl(u))
      .catch((err) => !cancelled && setError(driveErrorMessage(err, "Не удалось открыть файл")))
    return () => {
      cancelled = true
    }
  }, [node, kind])

  // Страховка: если браузер не прислал load (ответ ушёл на скачивание, сеть
  // оборвалась), индикатор не должен крутиться вечно. Офисному документу
  // даём время на конвертацию на сервере — она ограничена 90 секундами.
  useEffect(() => {
    if (!url || !frameLoading) return
    const t = setTimeout(() => setFrameLoading(false), kind === "office" ? 100_000 : 10_000)
    return () => clearTimeout(t)
  }, [url, frameLoading, kind])

  const index = node ? files.findIndex((f) => f.id === node.id) : -1
  const prev = index > 0 ? files[index - 1] : null
  const next = index >= 0 && index < files.length - 1 ? files[index + 1] : null

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && prev) onNavigate(prev)
      if (e.key === "ArrowRight" && next) onNavigate(next)
    },
    [prev, next, onNavigate],
  )
  useEffect(() => {
    if (!node) return
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [node, onKey])

  return (
    <Dialog open={node !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideCloseButton
        className="flex h-[92dvh] max-w-6xl flex-col gap-0 overflow-hidden bg-white p-0 sm:p-0"
      >
        {node && (
          <>
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
              <DriveNodeIcon node={node} />
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-base font-semibold text-slate-900">{node.name}</DialogTitle>
                <p className="text-xs text-slate-500">
                  {formatBytes(node.size_bytes)}
                  {files.length > 1 && index >= 0 ? ` · ${index + 1} из ${files.length}` : ""}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => downloadDriveFile(node)}>
                <Download className="mr-2 h-4 w-4" />
                Скачать
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-slate-100">
              {prev && (
                <NavButton side="left" label="Предыдущий файл" onClick={() => onNavigate(prev)} />
              )}
              {next && (
                <NavButton side="right" label="Следующий файл" onClick={() => onNavigate(next)} />
              )}

              {!kind ? (
                <NoPreview node={node} />
              ) : error ? (
                <NoPreview node={node} message={error} />
              ) : !url ? (
                <LoaderCircle className="h-8 w-8 animate-spin text-slate-400" />
              ) : (
                <PreviewBody
                  kind={kind}
                  url={url}
                  name={node.name}
                  frameLoading={frameLoading}
                  onFrameLoad={() => setFrameLoading(false)}
                />
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PreviewBody({
  kind,
  url,
  name,
  frameLoading,
  onFrameLoad,
}: {
  kind: string
  url: string
  name: string
  frameLoading: boolean
  onFrameLoad: () => void
}) {
  switch (kind) {
    case "image":
      return <img src={url} alt={name} className="max-h-full max-w-full object-contain" />
    case "video":
      return <video src={url} controls className="max-h-full max-w-full bg-black" />
    case "audio":
      return <audio src={url} controls className="w-full max-w-xl" />
    default:
      // pdf, office (уже сконвертированный в PDF) и текст — во встроенном окне.
      return (
        <>
          {frameLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-100 text-sm text-slate-500">
              <LoaderCircle className="h-8 w-8 animate-spin text-slate-400" />
              {kind === "office" ? "Готовим предпросмотр документа…" : "Загрузка…"}
            </div>
          )}
          <iframe
            src={url}
            title={name}
            onLoad={onFrameLoad}
            className={kind === "text" ? "h-full w-full bg-white" : "h-full w-full"}
          />
        </>
      )
  }
}

function NoPreview({ node, message }: { node: DriveNode; message?: string }) {
  return (
    <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
      <FileQuestion className="h-12 w-12 text-slate-300" />
      <p className="font-medium text-slate-700">{message || "Предпросмотр для этого типа файлов недоступен"}</p>
      <p className="text-sm text-slate-500">Файл можно скачать и открыть на компьютере.</p>
      <Button onClick={() => downloadDriveFile(node)}>
        <Download className="mr-2 h-4 w-4" />
        Скачать {formatBytes(node.size_bytes)}
      </Button>
    </div>
  )
}

function NavButton({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-700 shadow-md transition hover:bg-white ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      <Icon className="h-6 w-6" />
    </button>
  )
}
