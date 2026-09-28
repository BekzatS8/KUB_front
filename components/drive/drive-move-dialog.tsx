"use client"

import { useEffect, useState } from "react"
import { ChevronRight, Folder, HardDrive, LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { driveErrorMessage, listDrive, type DriveBreadcrumb, type DriveNode } from "@/src/api/drive.api"

// Выбор папки назначения для «Переместить» и «Копировать в…»: навигация по
// папкам хранилища, как в проводнике.
export function DriveMoveDialog({
  nodes,
  mode,
  onClose,
  onConfirm,
}: {
  /** Что перемещаем; null — окно закрыто. */
  nodes: DriveNode[] | null
  mode: "move" | "copy"
  onClose: () => void
  onConfirm: (targetId: number | null) => Promise<void>
}) {
  const [folderId, setFolderId] = useState<number | null>(null)
  const [folders, setFolders] = useState<DriveNode[]>([])
  const [crumbs, setCrumbs] = useState<DriveBreadcrumb[]>([])
  // Класть можно только в папку, которую разрешено менять.
  const [canEditTarget, setCanEditTarget] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (nodes) setFolderId(null)
  }, [nodes])

  useEffect(() => {
    if (!nodes) return
    setLoading(true)
    listDrive(folderId)
      .then((l) => {
        setFolders(l.items.filter((n) => n.kind === "folder"))
        setCrumbs(l.breadcrumbs)
        setCanEditTarget(l.can_edit ?? l.can_manage)
      })
      .catch((err) => toast.error(driveErrorMessage(err, "Не удалось загрузить папки")))
      .finally(() => setLoading(false))
  }, [nodes, folderId])

  const movingIds = new Set((nodes ?? []).map((n) => n.id))
  // Папку нельзя положить в неё саму или в подпапку: такие папки не открываем.
  const blocked = folderId !== null && (movingIds.has(folderId) || crumbs.some((c) => movingIds.has(c.id)))

  const confirm = async () => {
    setSaving(true)
    try {
      await onConfirm(folderId)
    } finally {
      setSaving(false)
    }
  }

  const count = nodes?.length ?? 0
  const title = mode === "move" ? "Переместить" : "Копировать в папку"

  return (
    <Dialog open={nodes !== null} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle>
            {title}: {count === 1 ? `«${nodes?.[0]?.name}»` : `${count} элем.`}
          </DialogTitle>
          <DialogDescription>Откройте папку, в которую {mode === "move" ? "переместить" : "скопировать"}, и нажмите кнопку внизу.</DialogDescription>
        </DialogHeader>

        <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => setFolderId(null)}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-slate-100 ${folderId ? "text-blue-600" : "font-semibold"}`}
          >
            <HardDrive className="h-4 w-4" />
            Хранилище
          </button>
          {crumbs.map((c) => (
            <span key={c.id} className="flex items-center gap-1">
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <button
                type="button"
                onClick={() => setFolderId(c.id)}
                className={`rounded px-1.5 py-0.5 hover:bg-slate-100 ${c.id === folderId ? "font-semibold" : "text-blue-600"}`}
              >
                {c.name}
              </button>
            </span>
          ))}
        </nav>

        <div className="h-64 overflow-y-auto rounded-lg border border-slate-200">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <LoaderCircle className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : folders.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-500">Вложенных папок нет</p>
          ) : (
            folders.map((f) => {
              const self = movingIds.has(f.id)
              return (
                <button
                  key={f.id}
                  type="button"
                  disabled={self}
                  onClick={() => setFolderId(f.id)}
                  className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  title={self ? "Эту папку вы перемещаете" : undefined}
                >
                  <Folder className="h-5 w-5 shrink-0 fill-amber-100 text-amber-500" />
                  <span className="truncate">{f.name}</span>
                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
                </button>
              )
            })
          )}
        </div>

        {blocked && (
          <p className="text-sm text-red-600">Нельзя положить папку в неё саму или в её подпапку.</p>
        )}
        {!blocked && !loading && !canEditTarget && (
          <p className="text-sm text-amber-700">В эту папку класть нельзя — откройте папку, в которой вам разрешено работать.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={confirm} disabled={saving || loading || blocked || !canEditTarget}>
            {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "move" ? "Переместить сюда" : "Копировать сюда"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
