"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ChevronRight,
  CloudUpload,
  Download,
  EllipsisVertical,
  Eye,
  FolderOpen,
  FolderPlus,
  HardDrive,
  LoaderCircle,
  Pencil,
  Search,
  Share2,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  createDriveFolder,
  deleteDriveNode,
  driveErrorMessage,
  listDrive,
  renameDriveNode,
  uploadDriveFile,
  type DriveListing,
  type DriveNode,
} from "@/src/api/drive.api"
import { DriveNodeIcon, formatAccessUntil, formatBytes, formatDateTime } from "@/components/drive/drive-utils"
import { DrivePreviewDialog, downloadDriveFile } from "@/components/drive/drive-preview-dialog"
import { DriveShareDialog } from "@/components/drive/drive-share-dialog"

// ── Очередь загрузки ────────────────────────────────────────────────────────

type UploadStatus = "queued" | "uploading" | "done" | "error" | "cancelled"

interface UploadItem {
  id: string
  file: File
  parentId: number | null
  loaded: number
  status: UploadStatus
  error?: string
  controller?: AbortController
}

// Сколько файлов грузим одновременно: больше — упираемся в канал и сервер без
// выигрыша в общем времени, а прогресс по каждому файлу ползёт медленнее.
const UPLOAD_CONCURRENCY = 3

type NameDialogState = { mode: "create" } | { mode: "rename"; node: DriveNode } | null

export default function DrivePage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const folderParam = searchParams.get("folder")
  const folderId = folderParam && /^\d+$/.test(folderParam) ? Number(folderParam) : null

  const [listing, setListing] = useState<DriveListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

  const [nameDialog, setNameDialog] = useState<NameDialogState>(null)
  const [nameValue, setNameValue] = useState("")
  const [nameSaving, setNameSaving] = useState(false)

  const [toDelete, setToDelete] = useState<DriveNode | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [shareNode, setShareNode] = useState<DriveNode | null>(null)
  const [previewNode, setPreviewNode] = useState<DriveNode | null>(null)

  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderIdRef = useRef(folderId)
  folderIdRef.current = folderId

  const canManage = listing?.can_manage ?? false

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        setListing(await listDrive(folderId))
      } catch (err: any) {
        if (err?.response?.status === 404) {
          toast.error("Папка не найдена или доступ к ней закрыт")
          router.replace(pathname)
          return
        }
        toast.error(driveErrorMessage(err, "Не удалось загрузить хранилище"))
      } finally {
        setLoading(false)
      }
    },
    [folderId, pathname, router],
  )

  useEffect(() => {
    setQuery("")
    load()
  }, [load])

  const openFolder = (id: number | null) => {
    router.push(id ? `${pathname}?folder=${id}` : pathname)
  }

  const items = useMemo(() => {
    const all = listing?.items ?? []
    const q = query.trim().toLowerCase()
    return q ? all.filter((n) => n.name.toLowerCase().includes(q)) : all
  }, [listing, query])

  const files = useMemo(() => items.filter((n) => n.kind === "file"), [items])

  const openNode = (node: DriveNode) => {
    if (node.kind === "folder") openFolder(node.id)
    else setPreviewNode(node)
  }

  // ── Загрузка ──────────────────────────────────────────────────────────────

  const enqueue = (list: FileList | File[]) => {
    const picked = Array.from(list)
    if (picked.length === 0) return
    setUploads((prev) => [
      ...prev.filter((u) => u.status !== "done" && u.status !== "cancelled"),
      ...picked.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        parentId: folderIdRef.current,
        loaded: 0,
        status: "queued" as UploadStatus,
      })),
    ])
  }

  const patchUpload = (id: string, patch: Partial<UploadItem>) =>
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))

  // Планировщик: следит за очередью и держит в работе не больше N загрузок.
  useEffect(() => {
    const active = uploads.filter((u) => u.status === "uploading").length
    const slots = UPLOAD_CONCURRENCY - active
    if (slots <= 0) return
    uploads
      .filter((u) => u.status === "queued")
      .slice(0, slots)
      .forEach((item) => {
        const controller = new AbortController()
        patchUpload(item.id, { status: "uploading", controller })
        uploadDriveFile(item.parentId, item.file, (loaded) => patchUpload(item.id, { loaded }), controller.signal)
          .then(() => {
            patchUpload(item.id, { status: "done", loaded: item.file.size, controller: undefined })
            if (item.parentId === folderIdRef.current) load(true)
          })
          .catch((err) => {
            if (controller.signal.aborted) {
              patchUpload(item.id, { status: "cancelled", controller: undefined })
              return
            }
            patchUpload(item.id, {
              status: "error",
              error: driveErrorMessage(err, "Ошибка загрузки"),
              controller: undefined,
            })
          })
      })
  }, [uploads, load])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (!canManage) return
    if (e.dataTransfer.files?.length) enqueue(e.dataTransfer.files)
  }

  // ── Папки, переименование, удаление ──────────────────────────────────────

  const openNameDialog = (state: NameDialogState) => {
    setNameDialog(state)
    setNameValue(state?.mode === "rename" ? state.node.name : "")
  }

  const submitName = async () => {
    if (!nameDialog) return
    const name = nameValue.trim()
    if (!name) return
    setNameSaving(true)
    try {
      if (nameDialog.mode === "create") {
        await createDriveFolder(folderId, name)
        toast.success(`Папка «${name}» создана`)
      } else {
        await renameDriveNode(nameDialog.node.id, name)
        toast.success("Переименовано")
      }
      setNameDialog(null)
      load(true)
    } catch (err) {
      toast.error(driveErrorMessage(err, "Не удалось сохранить"))
    } finally {
      setNameSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      const res = await deleteDriveNode(toDelete.id)
      toast.success(
        toDelete.kind === "folder"
          ? `Папка удалена${res.files_removed ? `, файлов: ${res.files_removed}` : ""}`
          : "Файл удалён",
      )
      setToDelete(null)
      load(true)
    } catch (err) {
      toast.error(driveErrorMessage(err, "Не удалось удалить"))
    } finally {
      setDeleting(false)
    }
  }

  // ── Разметка ─────────────────────────────────────────────────────────────

  const rootLabel = listing?.shared_view ? "Доступные мне" : "Хранилище"
  const activeUploads = uploads.filter((u) => u.status !== "cancelled")

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <HardDrive className="h-6 w-6 text-blue-600" />
            Хранилище
          </h1>
          <p className="text-sm text-slate-500">
            {listing?.shared_view
              ? "Файлы и папки, к которым вам открыли доступ"
              : listing && listing.total_bytes !== undefined
                ? `Занято ${formatBytes(listing.total_bytes)} · файлов: ${listing.total_files ?? 0}`
                : "Файлы компании"}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openNameDialog({ mode: "create" })}>
              <FolderPlus className="mr-2 h-4 w-4" />
              Создать папку
            </Button>
            <Button onClick={() => fileInputRef.current?.click()}>
              <CloudUpload className="mr-2 h-4 w-4" />
              Загрузить
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) enqueue(e.target.files)
                e.target.value = ""
              }}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm" aria-label="Путь">
          <button
            type="button"
            onClick={() => openFolder(null)}
            className={`rounded px-1.5 py-0.5 hover:bg-slate-100 ${folderId ? "text-blue-600" : "font-semibold text-slate-900"}`}
          >
            {rootLabel}
          </button>
          {listing?.breadcrumbs.map((c, i) => {
            const last = i === listing.breadcrumbs.length - 1
            return (
              <span key={c.id} className="flex min-w-0 items-center gap-1">
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                <button
                  type="button"
                  disabled={last}
                  onClick={() => openFolder(c.id)}
                  className={`truncate rounded px-1.5 py-0.5 ${last ? "font-semibold text-slate-900" : "text-blue-600 hover:bg-slate-100"}`}
                >
                  {c.name}
                </button>
              </span>
            )
          })}
        </nav>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск в папке" className="pl-9" />
        </div>
      </div>

      <div
        className={`relative min-h-[320px] rounded-xl border bg-white transition ${
          dragOver ? "border-2 border-dashed border-blue-500 bg-blue-50/40" : "border-slate-200"
        }`}
        onDragOver={(e) => {
          if (!canManage) return
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
        }}
        onDrop={onDrop}
      >
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-blue-600">
            <CloudUpload className="h-10 w-10" />
            <p className="font-medium">Отпустите, чтобы загрузить в эту папку</p>
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <LoaderCircle className="h-7 w-7 animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            searching={query.trim() !== ""}
            sharedView={listing?.shared_view ?? false}
            canManage={canManage}
            onUpload={() => fileInputRef.current?.click()}
          />
        ) : (
          <ul className={dragOver ? "opacity-30" : ""}>
            <li className="hidden grid-cols-[minmax(0,1fr)_110px_150px_40px] gap-3 border-b border-slate-200 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 md:grid">
              <span>Имя</span>
              <span>Размер</span>
              <span>Изменён</span>
              <span />
            </li>
            {items.map((node) => (
              <li
                key={node.id}
                className="group grid grid-cols-[minmax(0,1fr)_40px] items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_110px_150px_40px]"
              >
                <button
                  type="button"
                  onClick={() => openNode(node)}
                  className="flex min-w-0 items-center gap-3 text-left"
                >
                  <DriveNodeIcon node={node} className="h-6 w-6" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900 group-hover:text-blue-700">
                      {node.name}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                      {node.kind === "folder" && (
                        <span>{node.children_count ? `элементов: ${node.children_count}` : "пустая папка"}</span>
                      )}
                      <span className="md:hidden">
                        {node.kind === "file" && `${formatBytes(node.size_bytes)} · `}
                        {formatDateTime(node.updated_at)}
                      </span>
                      {canManage && !!node.shares_count && (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <Users className="h-3 w-3" />
                          доступ: {node.shares_count}
                        </span>
                      )}
                      {listing?.shared_view && !folderId && (
                        <span className="text-amber-700">доступ {formatAccessUntil(node.share_expires_at)}</span>
                      )}
                    </span>
                  </span>
                </button>
                <span className="hidden text-sm text-slate-600 md:block">
                  {node.kind === "file" ? formatBytes(node.size_bytes) : "—"}
                </span>
                <span className="hidden text-sm text-slate-600 md:block">{formatDateTime(node.updated_at)}</span>
                <NodeMenu
                  node={node}
                  canManage={canManage}
                  onOpen={() => openNode(node)}
                  onDownload={() => downloadDriveFile(node)}
                  onShare={() => setShareNode(node)}
                  onRename={() => openNameDialog({ mode: "rename", node })}
                  onDelete={() => setToDelete(node)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Создание папки / переименование */}
      <Dialog open={nameDialog !== null} onOpenChange={(open) => !open && setNameDialog(null)}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>{nameDialog?.mode === "rename" ? "Переименовать" : "Новая папка"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submitName()
            }}
          >
            <Input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              placeholder="Название"
              maxLength={255}
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setNameDialog(null)}>
                Отмена
              </Button>
              <Button type="submit" disabled={nameSaving || !nameValue.trim()}>
                {nameSaving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                {nameDialog?.mode === "rename" ? "Сохранить" : "Создать"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Удаление */}
      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить «{toDelete?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.kind === "folder"
                ? "Папка будет удалена вместе со всем содержимым, включая вложенные папки. Выданные доступы закроются."
                : "Файл будет удалён из хранилища, выданные к нему доступы закроются."}{" "}
              Восстановить удалённое нельзя.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DriveShareDialog node={shareNode} onClose={() => setShareNode(null)} onChanged={() => load(true)} />
      <DrivePreviewDialog
        files={files}
        node={previewNode}
        onNavigate={setPreviewNode}
        onClose={() => setPreviewNode(null)}
      />

      {activeUploads.length > 0 && (
        <UploadPanel
          items={activeUploads}
          onCancel={(item) => item.controller?.abort()}
          onClose={() => setUploads((prev) => prev.filter((u) => u.status === "uploading" || u.status === "queued"))}
        />
      )}
    </div>
  )
}

// ── Подкомпоненты ───────────────────────────────────────────────────────────

function NodeMenu({
  node,
  canManage,
  onOpen,
  onDownload,
  onShare,
  onRename,
  onDelete,
}: {
  node: DriveNode
  canManage: boolean
  onOpen: () => void
  onDownload: () => void
  onShare: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const isFile = node.kind === "file"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 justify-self-end" aria-label="Действия">
          <EllipsisVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onOpen}>
          {isFile ? <Eye className="mr-2 h-4 w-4" /> : <FolderOpen className="mr-2 h-4 w-4" />}
          Открыть
        </DropdownMenuItem>
        {isFile && (
          <DropdownMenuItem onClick={onDownload}>
            <Download className="mr-2 h-4 w-4" />
            Скачать
          </DropdownMenuItem>
        )}
        {canManage && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Поделиться
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="mr-2 h-4 w-4" />
              Переименовать
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:bg-red-50 focus:text-red-700">
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EmptyState({
  searching,
  sharedView,
  canManage,
  onUpload,
}: {
  searching: boolean
  sharedView: boolean
  canManage: boolean
  onUpload: () => void
}) {
  let title = "Папка пуста"
  let hint = ""
  if (searching) {
    title = "Ничего не найдено"
    hint = "Поиск идёт по именам в текущей папке."
  } else if (sharedView) {
    title = "Вам пока ничего не открыли"
    hint = "Когда администратор откроет доступ к файлу или папке, они появятся здесь."
  } else if (canManage) {
    hint = "Перетащите файлы сюда или нажмите «Загрузить»."
  }
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 px-6 text-center">
      <FolderOpen className="h-12 w-12 text-slate-300" />
      <p className="font-medium text-slate-700">{title}</p>
      {hint && <p className="max-w-sm text-sm text-slate-500">{hint}</p>}
      {canManage && !searching && !sharedView && (
        <Button variant="outline" className="mt-2" onClick={onUpload}>
          <CloudUpload className="mr-2 h-4 w-4" />
          Загрузить файлы
        </Button>
      )}
    </div>
  )
}

function UploadPanel({
  items,
  onCancel,
  onClose,
}: {
  items: UploadItem[]
  onCancel: (item: UploadItem) => void
  onClose: () => void
}) {
  const pending = items.filter((u) => u.status === "queued" || u.status === "uploading").length
  const failed = items.filter((u) => u.status === "error").length
  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
        <p className="text-sm font-semibold text-slate-900">
          {pending > 0 ? `Загрузка: осталось ${pending}` : failed > 0 ? `Готово, с ошибками: ${failed}` : "Загрузка завершена"}
        </p>
        {pending === 0 && (
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Закрыть">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <ul className="max-h-72 overflow-y-auto">
        {items.map((u) => {
          const percent = u.file.size ? Math.min(100, Math.round((u.loaded / u.file.size) * 100)) : 100
          return (
            <li key={u.id} className="border-b border-slate-100 px-4 py-2 last:border-0">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm text-slate-800">{u.file.name}</p>
                {u.status === "uploading" || u.status === "queued" ? (
                  <button
                    type="button"
                    onClick={() => onCancel(u)}
                    className="text-xs text-slate-500 hover:text-red-600"
                    disabled={u.status === "queued"}
                  >
                    {u.status === "queued" ? "в очереди" : "отмена"}
                  </button>
                ) : u.status === "done" ? (
                  <span className="text-xs text-emerald-600">готово</span>
                ) : (
                  <span className="text-xs text-red-600">ошибка</span>
                )}
              </div>
              {u.status === "uploading" && (
                <div className="mt-1.5 flex items-center gap-2">
                  <Progress value={percent} className="h-1.5 flex-1" />
                  <span className="w-9 text-right text-xs text-slate-500">{percent}%</span>
                </div>
              )}
              {u.status === "error" && <p className="mt-0.5 text-xs text-red-600">{u.error}</p>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
