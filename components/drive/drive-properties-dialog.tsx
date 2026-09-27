"use client"

import { useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { driveErrorMessage, getDriveProperties, type DriveNode, type DriveProperties } from "@/src/api/drive.api"
import { DriveNodeIcon, driveTypeLabel, formatBytes, formatDateTime } from "./drive-utils"

// «Свойства» файла или папки, как в проводнике.
export function DrivePropertiesDialog({ node, onClose }: { node: DriveNode | null; onClose: () => void }) {
  const [props, setProps] = useState<DriveProperties | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!node) return
    setProps(null)
    setLoading(true)
    getDriveProperties(node.id)
      .then(setProps)
      .catch((err) => {
        toast.error(driveErrorMessage(err, "Не удалось загрузить свойства"))
        onClose()
      })
      .finally(() => setLoading(false))
  }, [node, onClose])

  const n = props?.node ?? node
  const isFolder = n?.kind === "folder"
  const path = ["Хранилище", ...(props?.path ?? []).map((c) => c.name)].join(" / ")

  const rows: [string, string][] = n
    ? [
        ["Тип", isFolder ? "Папка" : `${driveTypeLabel(n)}${n.mime_type ? ` (${n.mime_type})` : ""}`],
        ["Расположение", path],
        [
          "Размер",
          isFolder
            ? props?.total_bytes !== undefined
              ? formatBytes(props.total_bytes)
              : "…"
            : `${formatBytes(n.size_bytes)} (${n.size_bytes.toLocaleString("ru-RU")} байт)`,
        ],
        ...(isFolder
          ? ([["Содержит", props ? `файлов: ${props.files ?? 0}, папок: ${props.folders ?? 0}` : "…"]] as [string, string][])
          : []),
        ["Создан", formatDateTime(n.created_at)],
        ["Изменён", formatDateTime(n.updated_at)],
        ...(n.created_by_name ? ([["Автор", n.created_by_name]] as [string, string][]) : []),
        ...(n.shares_count ? ([["Доступ открыт", `${n.shares_count}`]] as [string, string][]) : []),
      ]
    : []

  return (
    <Dialog open={node !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            {n && <DriveNodeIcon node={n} className="h-6 w-6" />}
            <span className="truncate">{n?.name}</span>
          </DialogTitle>
        </DialogHeader>
        {loading && !props ? (
          <div className="flex justify-center py-8">
            <LoaderCircle className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <dl className="divide-y divide-slate-100 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 py-2">
                <dt className="text-slate-500">{k}</dt>
                <dd className="break-words text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </DialogContent>
    </Dialog>
  )
}
