"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  ChevronsUpDown,
  ClipboardPaste,
  CloudUpload,
  Copy,
  Download,
  EllipsisVertical,
  Eye,
  FileArchive,
  FolderUp,
  KeyRound,
  Lock,
  PackageOpen,
  FolderInput,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Info,
  LoaderCircle,
  Pencil,
  Scissors,
  Search,
  Send,
  Share2,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  archiveDriveNodes,
  copyDriveNodes,
  createDriveFolder,
  deleteDriveNodes,
  driveErrorMessage,
  driveLockedInfo,
  ensureDriveFolderPath,
  getDriveZipUrl,
  listDrive,
  setDrivePassword,
  unarchiveDriveNode,
  unlockDriveNode,
  moveDriveNodes,
  renameDriveNode,
  uploadDriveFile,
  type DriveListing,
  type DriveNode,
} from "@/src/api/drive.api"
import {
  DriveNodeIcon,
  driveTypeLabel,
  formatAccessUntil,
  formatBytes,
  formatDateTime,
} from "@/components/drive/drive-utils"
import { DrivePreviewDialog, downloadDriveFile } from "@/components/drive/drive-preview-dialog"
import { DriveShareDialog } from "@/components/drive/drive-share-dialog"
import { DriveMoveDialog } from "@/components/drive/drive-move-dialog"
import { DrivePropertiesDialog } from "@/components/drive/drive-properties-dialog"
import { DriveSendDialog } from "@/components/drive/drive-send-dialog"
import { DriveTrashView } from "@/components/drive/drive-trash-view"

// ── Очередь загрузки ────────────────────────────────────────────────────────

type UploadStatus = "queued" | "uploading" | "done" | "error" | "cancelled"

interface UploadItem {
  id: string
  file: File
  parentId: number | null
  /** Папка внутри parentId при загрузке папкой: «Проект/Документы». */
  relDir?: string
  loaded: number
  status: UploadStatus
  error?: string
  controller?: AbortController
}

// Сколько файлов грузим одновременно: больше — упираемся в канал и сервер без
// выигрыша в общем времени, а прогресс по каждому файлу ползёт медленнее.
const UPLOAD_CONCURRENCY = 3

type NameDialogState = { mode: "create" } | { mode: "rename"; node: DriveNode } | null

// Файл с папкой внутри загружаемой папки (ТЗ «доработки CRM КУБ», п.8).
type PickedFile = { file: File; relDir?: string }

const dirOf = (relPath: string) => {
  const parts = relPath.replace(/\\/g, "/").split("/").filter(Boolean)
  return parts.slice(0, -1).join("/")
}

// Перетащенные папки: обходим содержимое через File System Entries API.
async function collectDropped(dt: DataTransfer): Promise<PickedFile[]> {
  const entries = Array.from(dt.items || [])
    .map((it) => (it as any).webkitGetAsEntry?.())
    .filter(Boolean)
  if (entries.length === 0 || !entries.some((e: any) => e.isDirectory)) {
    return Array.from(dt.files || []).map((file) => ({ file }))
  }
  const out: PickedFile[] = []
  const walk = async (entry: any, dir: string): Promise<void> => {
    if (entry.isFile) {
      const file: File = await new Promise((res, rej) => entry.file(res, rej))
      out.push({ file, relDir: dir || undefined })
      return
    }
    if (!entry.isDirectory) return
    const reader = entry.createReader()
    const path = dir ? `${dir}/${entry.name}` : entry.name
    for (;;) {
      const batch: any[] = await new Promise((res, rej) => reader.readEntries(res, rej))
      if (batch.length === 0) break
      for (const child of batch) await walk(child, path)
    }
  }
  for (const e of entries) await walk(e, "")
  return out
}

// Буфер «Вырезать / Копировать»: живёт, пока открыт раздел, и переживает
// переход между папками — вставляется в ту папку, где нажали «Вставить».
type DriveClipboard = { mode: "cut" | "copy"; nodes: DriveNode[] } | null
type MoveDialogState = { nodes: DriveNode[]; mode: "move" | "copy" } | null

// ── Сортировка списка ───────────────────────────────────────────────────────

type SortKey = "name" | "type" | "size" | "updated"
type SortState = { key: SortKey; dir: "asc" | "desc" }

const SORT_LABELS: Record<SortKey, string> = {
  name: "Имя",
  type: "Тип",
  size: "Размер",
  updated: "Изменён",
}
const DEFAULT_SORT: SortState = { key: "name", dir: "asc" }
// Выбор сортировки запоминается в браузере — удобство, не данные.
const SORT_STORAGE_KEY = "drive_sort"

function readSavedSort(): SortState {
  try {
    const saved = JSON.parse(localStorage.getItem(SORT_STORAGE_KEY) || "null")
    if (saved && saved.key in SORT_LABELS && (saved.dir === "asc" || saved.dir === "desc")) return saved
  } catch {}
  return DEFAULT_SORT
}

const byName = (a: DriveNode, b: DriveNode) =>
  a.name.localeCompare(b.name, "ru", { numeric: true, sensitivity: "base" })

// Папки всегда над файлами, как в проводнике; направление меняет порядок
// внутри групп. У папок нет размера — по размеру они идут по имени.
function sortNodes(nodes: DriveNode[], sort: SortState): DriveNode[] {
  const sign = sort.dir === "asc" ? 1 : -1
  const compare = (a: DriveNode, b: DriveNode): number => {
    switch (sort.key) {
      case "type":
        return driveTypeLabel(a).localeCompare(driveTypeLabel(b), "ru") || byName(a, b)
      case "size":
        return (a.kind === "file" && b.kind === "file" ? a.size_bytes - b.size_bytes : 0) || byName(a, b)
      case "updated":
        return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime() || byName(a, b)
      default:
        return byName(a, b)
    }
  }
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1
    // Размера у папок нет — между собой они всегда по алфавиту.
    if (sort.key === "size" && a.kind === "folder") return byName(a, b)
    return sign * compare(a, b)
  })
}

export default function DrivePage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const folderParam = searchParams.get("folder")
  const folderId = folderParam && /^\d+$/.test(folderParam) ? Number(folderParam) : null
  // ?view=trash — корзина (только администратор).
  const trashView = searchParams.get("view") === "trash"

  const [listing, setListing] = useState<DriveListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  useEffect(() => setSort(readSavedSort()), [])

  // Повторный клик по той же колонке меняет направление. Размер и дата
  // по первому клику — от больших и свежих.
  const changeSort = (key: SortKey) => {
    setSort((prev) => {
      const next: SortState =
        prev.key === key
          ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
          : { key, dir: key === "size" || key === "updated" ? "desc" : "asc" }
      try {
        localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const [nameDialog, setNameDialog] = useState<NameDialogState>(null)
  const [nameValue, setNameValue] = useState("")
  const [nameSaving, setNameSaving] = useState(false)

  const [toDelete, setToDelete] = useState<DriveNode[] | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [shareNode, setShareNode] = useState<DriveNode | null>(null)
  const [previewNode, setPreviewNode] = useState<DriveNode | null>(null)

  // Выделение нескольких элементов и операции над ними.
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [clipboard, setClipboard] = useState<DriveClipboard>(null)
  const [pasting, setPasting] = useState(false)
  const [moveDialog, setMoveDialog] = useState<MoveDialogState>(null)
  const [sendNodes, setSendNodes] = useState<DriveNode[] | null>(null)
  const [propsNode, setPropsNode] = useState<DriveNode | null>(null)
  const closeProps = useCallback(() => setPropsNode(null), [])

  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  // Папки, созданные при загрузке папкой: «parent|путь» → id (без гонок).
  const folderCache = useRef(new Map<string, Promise<number>>())
  // Ввод пароля к защищённой папке/файлу и что повторить после разблокировки.
  const [unlockState, setUnlockState] = useState<{ nodeId: number; name: string; retry: () => void } | null>(null)
  const [unlockPassword, setUnlockPassword] = useState("")
  const [unlocking, setUnlocking] = useState(false)
  const [passwordNode, setPasswordNode] = useState<DriveNode | null>(null)
  const [pwCurrent, setPwCurrent] = useState("")
  const [pwNew, setPwNew] = useState("")
  const [pwSaving, setPwSaving] = useState(false)
  const [busyAction, setBusyAction] = useState(false)
  const folderIdRef = useRef(folderId)
  folderIdRef.current = folderId

  const canManage = listing?.can_manage ?? false
  // Менять содержимое открытой папки: администратор везде, сотрудник — внутри
  // папки с доступом «редактирование».
  const canEdit = listing?.can_edit ?? canManage

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        setListing(await listDrive(folderId))
      } catch (err: any) {
        const locked = driveLockedInfo(err)
        if (locked) {
          setUnlockPassword("")
          setUnlockState({ ...locked, retry: () => load() })
          return
        }
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
    setSelected(new Set())
    load()
  }, [load])

  const openFolder = (id: number | null) => {
    router.push(id ? `${pathname}?folder=${id}` : pathname)
  }

  const items = useMemo(() => {
    const all = listing?.items ?? []
    const q = query.trim().toLowerCase()
    return sortNodes(q ? all.filter((n) => n.name.toLowerCase().includes(q)) : all, sort)
  }, [listing, query, sort])

  const files = useMemo(() => items.filter((n) => n.kind === "file"), [items])

  // Действие с узлом под паролем: сначала спросить пароль, потом выполнить.
  const askUnlock = (nodeId: number, name: string, retry: () => void) => {
    setUnlockPassword("")
    setUnlockState({ nodeId, name, retry })
  }
  // Ошибка «под паролем» (423) — окно пароля и повтор действия.
  const handleLocked = (err: any, retry: () => void): boolean => {
    const locked = driveLockedInfo(err)
    if (!locked) return false
    askUnlock(locked.nodeId, locked.name, retry)
    return true
  }

  const submitUnlock = async () => {
    if (!unlockState) return
    setUnlocking(true)
    try {
      await unlockDriveNode(unlockState.nodeId, unlockPassword)
      const retry = unlockState.retry
      setUnlockState(null)
      retry()
    } catch (err) {
      toast.error(driveErrorMessage(err, "Неверный пароль"))
    } finally {
      setUnlocking(false)
    }
  }

  const openNode = (node: DriveNode) => {
    if (node.kind === "folder") openFolder(node.id)
    else if (node.protected) askUnlock(node.id, node.name, () => setPreviewNode(node))
    else setPreviewNode(node)
  }

  // «Скачать» выбранное: один файл — как есть, иначе ZIP со структурой папок.
  const downloadSelection = async (nodes: DriveNode[]) => {
    if (nodes.length === 1 && nodes[0].kind === "file" && !nodes[0].protected) {
      downloadDriveFile(nodes[0])
      return
    }
    try {
      const url = await getDriveZipUrl(nodes.map((n) => n.id))
      const a = document.createElement("a")
      a.href = url
      a.rel = "noopener"
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (err) {
      if (!handleLocked(err, () => downloadSelection(nodes))) toast.error(driveErrorMessage(err, "Не удалось скачать"))
    }
  }

  const archiveSelection = async (nodes: DriveNode[]) => {
    setBusyAction(true)
    try {
      const node = await archiveDriveNodes(nodes.map((n) => n.id))
      toast.success(`Создан архив «${node.name}»`)
      setSelected(new Set())
      load(true)
    } catch (err) {
      if (!handleLocked(err, () => archiveSelection(nodes))) toast.error(driveErrorMessage(err, "Не удалось создать архив"))
    } finally {
      setBusyAction(false)
    }
  }

  const unarchive = async (node: DriveNode) => {
    setBusyAction(true)
    try {
      const folder = await unarchiveDriveNode(node.id)
      toast.success(`Распаковано в папку «${folder.name}»`)
      setSelected(new Set())
      load(true)
    } catch (err) {
      if (!handleLocked(err, () => unarchive(node))) toast.error(driveErrorMessage(err, "Не удалось распаковать"))
    } finally {
      setBusyAction(false)
    }
  }

  const openPasswordDialog = (node: DriveNode) => {
    setPwCurrent("")
    setPwNew("")
    setPasswordNode(node)
  }

  const savePassword = async (remove: boolean) => {
    if (!passwordNode) return
    setPwSaving(true)
    try {
      await setDrivePassword(passwordNode.id, pwCurrent, remove ? "" : pwNew)
      toast.success(remove ? "Пароль снят" : passwordNode.protected ? "Пароль изменён" : "Пароль установлен")
      setPasswordNode(null)
      load(true)
    } catch (err) {
      toast.error(driveErrorMessage(err, "Не удалось изменить пароль"))
    } finally {
      setPwSaving(false)
    }
  }

  // ── Выделение, буфер, перемещение ────────────────────────────────────────

  const selectedNodes = useMemo(() => items.filter((n) => selected.has(n.id)), [items, selected])
  const allSelected = items.length > 0 && selectedNodes.length === items.length
  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((n) => n.id)))
  const cutIds = useMemo(
    () => new Set(clipboard?.mode === "cut" ? clipboard.nodes.map((n) => n.id) : []),
    [clipboard],
  )

  const toClipboard = (mode: "cut" | "copy", nodes: DriveNode[]) => {
    if (nodes.length === 0 || (mode === "cut" && !canEdit)) return
    setClipboard({ mode, nodes })
    setSelected(new Set())
    toast.success(
      `${mode === "cut" ? "Вырезано" : "Скопировано"}: ${nodes.length === 1 ? `«${nodes[0].name}»` : `${nodes.length} элем.`} — откройте папку и нажмите «Вставить»`,
    )
  }

  // Переместить или скопировать в папку targetId (null — корень).
  const transfer = async (mode: "move" | "copy", nodes: DriveNode[], targetId: number | null) => {
    const ids = nodes.map((n) => n.id)
    try {
      if (mode === "move") {
        const res = await moveDriveNodes(ids, targetId)
        toast.success(res.moved ? `Перемещено: ${res.moved}` : "Элементы уже в этой папке")
      } else {
        const res = await copyDriveNodes(ids, targetId)
        toast.success(`Скопировано: ${res.copied}`)
      }
      setSelected(new Set())
      load(true)
      return true
    } catch (err) {
      toast.error(driveErrorMessage(err, mode === "move" ? "Не удалось переместить" : "Не удалось скопировать"))
      return false
    }
  }

  const paste = async () => {
    if (!clipboard || pasting) return
    setPasting(true)
    const ok = await transfer(clipboard.mode === "cut" ? "move" : "copy", clipboard.nodes, folderId)
    // Вырезанное вставляется один раз, скопированное — сколько угодно.
    if (ok && clipboard.mode === "cut") setClipboard(null)
    setPasting(false)
  }

  // Горячие клавиши, как в проводнике (не мешают вводу в полях).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (trashView) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return
      if (document.querySelector("[role=dialog]")) return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (e.key === "Escape" && selected.size > 0) {
        setSelected(new Set())
      } else if (mod && (key === "a" || key === "ф")) {
        e.preventDefault()
        setSelected(new Set(items.map((n) => n.id)))
      } else if (mod && (key === "c" || key === "с") && selectedNodes.length > 0) {
        toClipboard("copy", selectedNodes)
      } else if (mod && (key === "x" || key === "ч") && selectedNodes.length > 0 && canEdit) {
        toClipboard("cut", selectedNodes)
      } else if (mod && (key === "v" || key === "м") && clipboard && canEdit) {
        e.preventDefault()
        paste()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  // ── Загрузка ──────────────────────────────────────────────────────────────

  const enqueue = (list: FileList | File[] | PickedFile[]) => {
    const picked: PickedFile[] = Array.from(list as any).map((x: any) => (x instanceof File ? { file: x } : x))
    if (picked.length === 0) return
    setUploads((prev) => [
      ...prev.filter((u) => u.status !== "done" && u.status !== "cancelled"),
      ...picked.map(({ file, relDir }) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        parentId: folderIdRef.current,
        relDir,
        loaded: 0,
        status: "queued" as UploadStatus,
      })),
    ])
  }

  // Папка назначения при загрузке папкой: создаётся один раз на путь.
  const resolveParent = (item: UploadItem): Promise<number | null> => {
    if (!item.relDir) return Promise.resolve(item.parentId)
    const key = `${item.parentId ?? 0}|${item.relDir.toLowerCase()}`
    let p = folderCache.current.get(key)
    if (!p) {
      p = ensureDriveFolderPath(item.parentId, item.relDir).then((n) => n.id)
      p.catch(() => folderCache.current.delete(key))
      folderCache.current.set(key, p)
    }
    return p
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
        resolveParent(item)
          .then((parentId) => uploadDriveFile(parentId, item.file, (loaded) => patchUpload(item.id, { loaded }), controller.signal))
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
    if (!canEdit) return
    // Папки перетаскиваются вместе с содержимым (п.8).
    collectDropped(e.dataTransfer)
      .then((picked) => picked.length && enqueue(picked))
      .catch(() => e.dataTransfer.files?.length && enqueue(e.dataTransfer.files))
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
    if (!toDelete || toDelete.length === 0) return
    setDeleting(true)
    let removed = 0
    try {
      removed = (await deleteDriveNodes(toDelete.map((n) => n.id))).trashed
      toast.success(
        toDelete.length > 1 ? `Перемещено в корзину: ${removed}` : `«${toDelete[0].name}» перемещено в корзину`,
      )
      setToDelete(null)
      setSelected(new Set())
    } catch (err) {
      toast.error(driveErrorMessage(err, removed ? `Удалено ${removed}, остальное не удалось` : "Не удалось удалить"))
    } finally {
      setDeleting(false)
      load(true)
    }
  }

  // ── Разметка ─────────────────────────────────────────────────────────────

  // Пока права не загружены — сразу корзина, без мелькания хранилища.
  if (trashView && (canManage || listing === null)) {
    return <DriveTrashView onBack={() => router.push(pathname)} />
  }

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
        {(canEdit || canManage) && (
          <div className="flex flex-wrap gap-2">
            {clipboard && canEdit && (
              <div className="flex items-center overflow-hidden rounded-md border border-blue-200 bg-blue-50">
                <Button variant="ghost" onClick={paste} disabled={pasting} className="rounded-none text-blue-700 hover:bg-blue-100">
                  {pasting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardPaste className="mr-2 h-4 w-4" />}
                  Вставить ({clipboard.nodes.length})
                </Button>
                <button
                  type="button"
                  onClick={() => setClipboard(null)}
                  className="h-10 border-l border-blue-200 px-2 text-blue-700 hover:bg-blue-100"
                  title="Очистить буфер"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {canManage && (
              <Button variant="outline" onClick={() => router.push(`${pathname}?view=trash`)} title="Удалённые файлы и папки">
                <Trash2 className="mr-2 h-4 w-4" />
                Корзина
              </Button>
            )}
            {canEdit && (
              <>
                <Button variant="outline" onClick={() => openNameDialog({ mode: "create" })}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Создать папку
                </Button>
                <Button variant="outline" onClick={() => folderInputRef.current?.click()} title="Загрузить папку вместе с содержимым">
                  <FolderUp className="mr-2 h-4 w-4" />
                  Загрузить папку
                </Button>
                <Button onClick={() => fileInputRef.current?.click()}>
                  <CloudUpload className="mr-2 h-4 w-4" />
                  Загрузить
                </Button>
              </>
            )}
            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="hidden"
              {...({ webkitdirectory: "", directory: "" } as any)}
              onChange={(e) => {
                const list = Array.from(e.target.files || [])
                enqueue(list.map((file) => ({ file, relDir: dirOf((file as any).webkitRelativePath || "") || undefined })))
                e.target.value = ""
              }}
            />
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
        <div className="flex w-full gap-2 sm:w-auto">
          {/* На телефоне заголовков колонок нет — сортировка списком. */}
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm md:hidden"
            value={`${sort.key}:${sort.dir}`}
            onChange={(e) => {
              const [key, dir] = e.target.value.split(":") as [SortKey, SortState["dir"]]
              setSort({ key, dir })
              try {
                localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ key, dir }))
              } catch {}
            }}
            aria-label="Сортировка"
          >
            <option value="name:asc">Имя А→Я</option>
            <option value="name:desc">Имя Я→А</option>
            <option value="type:asc">Тип</option>
            <option value="size:desc">Сначала большие</option>
            <option value="size:asc">Сначала маленькие</option>
            <option value="updated:desc">Сначала новые</option>
            <option value="updated:asc">Сначала старые</option>
          </select>
          <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск в папке" className="pl-9" />
          </div>
        </div>
      </div>

      {selectedNodes.length > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 shadow-sm">
          <span className="mr-2 text-sm font-medium text-blue-900">Выбрано: {selectedNodes.length}</span>
          {/* «Скачать» — сразу при выделении (п.8): файл как есть, папки и
              несколько элементов — ZIP с сохранением структуры папок. */}
          <Button size="sm" variant="ghost" onClick={() => downloadSelection(selectedNodes)}>
            <Download className="mr-1.5 h-4 w-4" />
            Скачать
          </Button>
          {canEdit && (
            <Button size="sm" variant="ghost" disabled={busyAction} onClick={() => archiveSelection(selectedNodes)}>
              <FileArchive className="mr-1.5 h-4 w-4" />
              Архивировать
            </Button>
          )}
          {canEdit && selectedNodes.length === 1 && selectedNodes[0].kind === "file" && /\.zip$/i.test(selectedNodes[0].name) && (
            <Button size="sm" variant="ghost" disabled={busyAction} onClick={() => unarchive(selectedNodes[0])}>
              <PackageOpen className="mr-1.5 h-4 w-4" />
              Разархивировать
            </Button>
          )}
          {canEdit && selectedNodes.length === 1 && (
            <Button size="sm" variant="ghost" onClick={() => openPasswordDialog(selectedNodes[0])}>
              <KeyRound className="mr-1.5 h-4 w-4" />
              {selectedNodes[0].protected ? "Пароль…" : "Поставить пароль"}
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={() => toClipboard("cut", selectedNodes)}>
              <Scissors className="mr-1.5 h-4 w-4" />
              Вырезать
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => toClipboard("copy", selectedNodes)}>
            <Copy className="mr-1.5 h-4 w-4" />
            Копировать
          </Button>
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={() => setMoveDialog({ nodes: selectedNodes, mode: "move" })}>
              <FolderInput className="mr-1.5 h-4 w-4" />
              Переместить…
            </Button>
          )}
          {selectedNodes.some((n) => n.kind === "file") && (
            <Button size="sm" variant="ghost" onClick={() => setSendNodes(selectedNodes)}>
              <Send className="mr-1.5 h-4 w-4" />
              Отправить
            </Button>
          )}
          {selectedNodes.length === 1 && (
            <Button size="sm" variant="ghost" onClick={() => setPropsNode(selectedNodes[0])}>
              <Info className="mr-1.5 h-4 w-4" />
              Свойства
            </Button>
          )}
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setToDelete(selectedNodes)}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Удалить
            </Button>
          )}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            <X className="mr-1.5 h-4 w-4" />
            Снять выделение
          </Button>
        </div>
      )}

      <div
        className={`relative min-h-[320px] rounded-xl border bg-white transition ${
          dragOver ? "border-2 border-dashed border-blue-500 bg-blue-50/40" : "border-slate-200"
        }`}
        onDragOver={(e) => {
          if (!canEdit) return
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
            sharedView={(listing?.shared_view ?? false) && folderId === null}
            canManage={canEdit}
            onUpload={() => fileInputRef.current?.click()}
          />
        ) : (
          <ul className={dragOver ? "opacity-30" : ""}>
            <li className="hidden grid-cols-[20px_minmax(0,1fr)_80px_110px_150px_40px] items-center gap-3 border-b border-slate-200 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 md:grid">
              <Checkbox
                checked={allSelected ? true : selectedNodes.length > 0 ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                aria-label="Выбрать всё"
              />
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => {
                const active = sort.key === key
                const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => changeSort(key)}
                    className={`flex items-center gap-1 text-left uppercase tracking-wide hover:text-slate-900 ${active ? "text-slate-900" : ""}`}
                    title={`Сортировать: ${SORT_LABELS[key].toLowerCase()}`}
                  >
                    {SORT_LABELS[key]}
                    <Icon className={`h-3.5 w-3.5 ${active ? "" : "opacity-40"}`} />
                  </button>
                )
              })}
              <span />
            </li>
            {items.map((node) => (
              <li
                key={node.id}
                className={`group grid grid-cols-[20px_minmax(0,1fr)_40px] items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 md:grid-cols-[20px_minmax(0,1fr)_80px_110px_150px_40px] ${
                  selected.has(node.id) ? "bg-blue-50/70 hover:bg-blue-50" : "hover:bg-slate-50"
                } ${cutIds.has(node.id) ? "opacity-50" : ""}`}
              >
                <Checkbox
                  checked={selected.has(node.id)}
                  onCheckedChange={() => toggleSelect(node.id)}
                  aria-label={`Выбрать «${node.name}»`}
                />
                <button
                  type="button"
                  onClick={() => openNode(node)}
                  className="flex min-w-0 items-center gap-3 text-left"
                >
                  <DriveNodeIcon node={node} className="h-6 w-6" />
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-900 group-hover:text-blue-700">
                      <span className="truncate">{node.name}</span>
                      {node.protected && <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Защищено паролем" />}
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
                <span className="hidden truncate text-sm text-slate-600 md:block">{driveTypeLabel(node)}</span>
                <span className="hidden text-sm text-slate-600 md:block">
                  {node.kind === "file" ? formatBytes(node.size_bytes) : "—"}
                </span>
                <span className="hidden text-sm text-slate-600 md:block">{formatDateTime(node.updated_at)}</span>
                <NodeMenu
                  node={node}
                  canManage={canManage}
                  canEdit={canEdit}
                  onOpen={() => openNode(node)}
                  onDownload={() => (node.protected ? askUnlock(node.id, node.name, () => downloadDriveFile(node)) : downloadDriveFile(node))}
                  onShare={() => setShareNode(node)}
                  onRename={() => openNameDialog({ mode: "rename", node })}
                  onDelete={() => setToDelete([node])}
                  onCut={() => toClipboard("cut", [node])}
                  onCopy={() => toClipboard("copy", [node])}
                  onMove={() => setMoveDialog({ nodes: [node], mode: "move" })}
                  onSend={() => setSendNodes([node])}
                  onProperties={() => setPropsNode(node)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Пароль к защищённой папке или файлу (п.8) */}
      <Dialog open={unlockState !== null} onOpenChange={(open) => !open && setUnlockState(null)}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="h-4 w-4 text-amber-600" />Введите пароль</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submitUnlock()
            }}
            className="space-y-3"
          >
            <p className="text-sm text-slate-600">«{unlockState?.name}» защищено паролем.</p>
            <Input type="password" autoFocus value={unlockPassword} onChange={(e) => setUnlockPassword(e.target.value)} placeholder="Пароль" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUnlockState(null)}>Отмена</Button>
              <Button type="submit" disabled={!unlockPassword || unlocking}>{unlocking ? "Проверка…" : "Открыть"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Поставить / сменить / снять пароль (п.8) */}
      <Dialog open={passwordNode !== null} onOpenChange={(open) => !open && setPasswordNode(null)}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle>{passwordNode?.protected ? "Пароль" : "Поставить пароль"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              «{passwordNode?.name}»{passwordNode?.kind === "folder" ? " и всё внутри папки" : ""} будет открываться только после ввода пароля.
            </p>
            {passwordNode?.protected && !canManage && (
              <Input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} placeholder="Текущий пароль" />
            )}
            <Input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder={passwordNode?.protected ? "Новый пароль" : "Пароль (не короче 4 символов)"} />
            {passwordNode?.protected && canManage && (
              <p className="text-xs text-slate-500">Администратор меняет и снимает пароль без ввода текущего.</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {passwordNode?.protected ? (
              <Button variant="outline" className="text-red-600" disabled={pwSaving || (!canManage && !pwCurrent)} onClick={() => savePassword(true)}>
                Снять пароль
              </Button>
            ) : <span />}
            <Button disabled={pwSaving || pwNew.length < 4 || (passwordNode?.protected && !canManage && !pwCurrent)} onClick={() => savePassword(false)}>
              {passwordNode?.protected ? "Сменить" : "Поставить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <AlertDialogTitle>
              {toDelete && toDelete.length > 1
                ? `Переместить в корзину ${toDelete.length} элем.?`
                : `Переместить «${toDelete?.[0]?.name}» в корзину?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.some((n) => n.kind === "folder")
                ? "Папки попадут в корзину вместе со всем содержимым."
                : "Файлы попадут в корзину."}{" "}
              {canManage
                ? "Пока они там, их никто не видит и доступы не действуют. Восстановить или удалить навсегда можно в разделе «Корзина»."
                : "Администратор увидит удаление в Ленте и при необходимости восстановит."}
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
              В корзину
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DriveShareDialog node={shareNode} onClose={() => setShareNode(null)} onChanged={() => load(true)} />
      <DriveMoveDialog
        nodes={moveDialog?.nodes ?? null}
        mode={moveDialog?.mode ?? "move"}
        onClose={() => setMoveDialog(null)}
        onConfirm={async (targetId) => {
          if (!moveDialog) return
          if (await transfer(moveDialog.mode, moveDialog.nodes, targetId)) setMoveDialog(null)
        }}
      />
      <DriveSendDialog nodes={sendNodes} onClose={() => setSendNodes(null)} />
      <DrivePropertiesDialog node={propsNode} onClose={closeProps} />
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
  canEdit,
  onOpen,
  onDownload,
  onShare,
  onRename,
  onDelete,
  onCut,
  onCopy,
  onMove,
  onSend,
  onProperties,
}: {
  node: DriveNode
  canManage: boolean
  canEdit: boolean
  onOpen: () => void
  onDownload: () => void
  onShare: () => void
  onRename: () => void
  onDelete: () => void
  onCut: () => void
  onCopy: () => void
  onMove: () => void
  onSend: () => void
  onProperties: () => void
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
        {isFile && (
          <DropdownMenuItem onClick={onSend}>
            <Send className="mr-2 h-4 w-4" />
            Отправить…
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {canEdit && (
          <DropdownMenuItem onClick={onCut}>
            <Scissors className="mr-2 h-4 w-4" />
            Вырезать
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onCopy}>
          <Copy className="mr-2 h-4 w-4" />
          Копировать
        </DropdownMenuItem>
        {canEdit && (
          <DropdownMenuItem onClick={onMove}>
            <FolderInput className="mr-2 h-4 w-4" />
            Переместить…
          </DropdownMenuItem>
        )}
        {(canManage || canEdit) && <DropdownMenuSeparator />}
        {canManage && (
          <DropdownMenuItem onClick={onShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Поделиться
          </DropdownMenuItem>
        )}
        {canEdit && (
          <>
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
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onProperties}>
          <Info className="mr-2 h-4 w-4" />
          Свойства
        </DropdownMenuItem>
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
