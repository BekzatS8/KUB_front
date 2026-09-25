import {
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
} from "lucide-react"

import type { DriveNode } from "@/src/api/drive.api"
import { cn } from "@/lib/utils"

const SPREADSHEET = /\.(xlsx?|ods|csv)$/i
const ARCHIVE = /\.(zip|rar|7z|tar|gz|bz2|xz)$/i
const DOCUMENT = /\.(docx?|odt|rtf|pdf|txt|md|pptx?|odp)$/i

/** Иконка и цвет по типу элемента — чтобы тип считывался без чтения имени. */
export function DriveNodeIcon({ node, className }: { node: DriveNode; className?: string }) {
  const base = cn("h-5 w-5 shrink-0", className)
  if (node.kind === "folder") return <Folder className={cn(base, "fill-amber-100 text-amber-500")} />
  const mt = node.mime_type || ""
  if (mt.startsWith("image/")) return <FileImage className={cn(base, "text-violet-500")} />
  if (mt.startsWith("video/")) return <FileVideo className={cn(base, "text-rose-500")} />
  if (mt.startsWith("audio/")) return <FileAudio className={cn(base, "text-pink-500")} />
  if (SPREADSHEET.test(node.name)) return <FileSpreadsheet className={cn(base, "text-emerald-600")} />
  if (ARCHIVE.test(node.name)) return <FileArchive className={cn(base, "text-slate-500")} />
  if (/\.pdf$/i.test(node.name)) return <FileText className={cn(base, "text-red-500")} />
  if (DOCUMENT.test(node.name)) return <FileText className={cn(base, "text-blue-600")} />
  return <File className={cn(base, "text-slate-400")} />
}

export function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return "0 Б"
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"]
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  const digits = i === 0 || value >= 100 ? 0 : 1
  return `${value.toFixed(digits).replace(".", ",")} ${units[i]}`
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** «до 25.10.2026, 18:00» или «бессрочно». */
export function formatAccessUntil(iso: string | null | undefined): string {
  return iso ? `до ${formatDateTime(iso)}` : "бессрочно"
}
