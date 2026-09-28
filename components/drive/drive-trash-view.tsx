"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, LoaderCircle, RotateCcw, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  driveErrorMessage,
  emptyDriveTrash,
  listDriveTrash,
  purgeDriveNodes,
  restoreDriveNodes,
  type DriveNode,
  type DriveTrashItem,
} from "@/src/api/drive.api"
import { DriveNodeIcon, formatBytes, formatDateTime } from "./drive-utils"

type Confirm = { kind: "purge"; items: DriveTrashItem[] } | { kind: "empty" } | null

// Корзина хранилища: удалённое можно восстановить на прежнее место или
// удалить навсегда. Только администратор.
export function DriveTrashView({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<DriveTrashItem[]>([])
  const [totalBytes, setTotalBytes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listDriveTrash()
      setItems(res.items)
      setTotalBytes(res.total_bytes)
      setSelected((prev) => new Set([...prev].filter((id) => res.items.some((i) => i.id === id))))
    } catch (err) {
      toast.error(driveErrorMessage(err, "Не удалось загрузить корзину"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selectedItems = useMemo(() => items.filter((i) => selected.has(i.id)), [items, selected])
  const allSelected = items.length > 0 && selectedItems.length === items.length
  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const restore = async (list: DriveTrashItem[]) => {
    setBusy(true)
    try {
      const res = await restoreDriveNodes(list.map((i) => i.id))
      toast.success(
        list.length === 1 ? `«${list[0].name}» восстановлен${list[0].kind === "folder" ? "а" : ""}` : `Восстановлено: ${res.restored}`,
      )
      setSelected(new Set())
      await load()
    } catch (err) {
      toast.error(driveErrorMessage(err, "Не удалось восстановить"))
    } finally {
      setBusy(false)
    }
  }

  const runConfirm = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      if (confirm.kind === "purge") {
        await purgeDriveNodes(confirm.items.map((i) => i.id))
        toast.success(confirm.items.length === 1 ? "Удалено навсегда" : `Удалено навсегда: ${confirm.items.length}`)
      } else {
        await emptyDriveTrash()
        toast.success("Корзина очищена")
      }
      setConfirm(null)
      setSelected(new Set())
      await load()
    } catch (err) {
      toast.error(driveErrorMessage(err, "Не удалось удалить"))
    } finally {
      setBusy(false)
    }
  }

  const from = (i: DriveTrashItem) =>
    i.parent_trashed ? `${i.parent_name} (тоже удалена — вернётся в корень)` : i.parent_name || "Хранилище"

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button type="button" onClick={onBack} className="mb-1 flex items-center gap-1 text-sm text-blue-600 hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Хранилище
          </button>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Trash2 className="h-6 w-6 text-slate-500" />
            Корзина
          </h1>
          <p className="text-sm text-slate-500">
            {items.length
              ? `Элементов: ${items.length} · ${formatBytes(totalBytes)}. Удалённое можно восстановить или удалить навсегда.`
              : "Удалённые файлы и папки попадают сюда"}
          </p>
        </div>
        <Button
          variant="outline"
          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          disabled={items.length === 0 || busy}
          onClick={() => setConfirm({ kind: "empty" })}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Очистить корзину
        </Button>
      </div>

      {selectedItems.length > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 shadow-sm">
          <span className="mr-2 text-sm font-medium text-blue-900">Выбрано: {selectedItems.length}</span>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => restore(selectedItems)}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Восстановить
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            disabled={busy}
            onClick={() => setConfirm({ kind: "purge", items: selectedItems })}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Удалить навсегда
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            <X className="mr-1.5 h-4 w-4" />
            Снять выделение
          </Button>
        </div>
      )}

      <div className="min-h-[240px] rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex h-60 items-center justify-center">
            <LoaderCircle className="h-7 w-7 animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-2 text-slate-500">
            <Trash2 className="h-10 w-10 text-slate-300" />
            <p className="text-sm">Корзина пуста</p>
          </div>
        ) : (
          <ul>
            <li className="hidden grid-cols-[20px_minmax(0,1fr)_minmax(0,220px)_170px_100px_220px] items-center gap-3 border-b border-slate-200 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 md:grid">
              <Checkbox
                checked={allSelected ? true : selectedItems.length > 0 ? "indeterminate" : false}
                onCheckedChange={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))}
                aria-label="Выбрать всё"
              />
              <span>Имя</span>
              <span>Откуда</span>
              <span>Удалено</span>
              <span>Размер</span>
              <span />
            </li>
            {items.map((i) => (
              <li
                key={i.id}
                className={`grid grid-cols-[20px_minmax(0,1fr)] items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 md:grid-cols-[20px_minmax(0,1fr)_minmax(0,220px)_170px_100px_220px] ${
                  selected.has(i.id) ? "bg-blue-50/70" : "hover:bg-slate-50"
                }`}
              >
                <Checkbox checked={selected.has(i.id)} onCheckedChange={() => toggle(i.id)} aria-label={`Выбрать «${i.name}»`} />
                <div className="flex min-w-0 items-center gap-3">
                  <DriveNodeIcon node={i as unknown as DriveNode} className="h-6 w-6 opacity-70" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">{i.name}</div>
                    <div className="text-xs text-slate-500 md:hidden">
                      {from(i)} · {formatDateTime(i.deleted_at)}
                    </div>
                    {i.kind === "folder" && <div className="text-xs text-slate-500">файлов внутри: {i.files}</div>}
                  </div>
                </div>
                <span className="hidden truncate text-sm text-slate-600 md:block" title={from(i)}>
                  {from(i)}
                </span>
                <span className="hidden text-sm text-slate-600 md:block">
                  {formatDateTime(i.deleted_at)}
                  {i.deleted_by_name && <span className="block truncate text-xs text-slate-400">{i.deleted_by_name}</span>}
                </span>
                <span className="hidden text-sm text-slate-600 md:block">{formatBytes(i.size_bytes)}</span>
                <div className="col-span-2 flex justify-end gap-1 md:col-span-1">
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => restore([i])}>
                    <RotateCcw className="mr-1.5 h-4 w-4" />
                    Восстановить
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={busy}
                    onClick={() => setConfirm({ kind: "purge", items: [i] })}
                    title="Удалить навсегда"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && !busy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "empty"
                ? "Очистить корзину?"
                : confirm && confirm.items.length > 1
                  ? `Удалить навсегда ${confirm.items.length} элем.?`
                  : `Удалить навсегда «${confirm?.kind === "purge" ? confirm.items[0]?.name : ""}»?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "empty"
                ? `Все элементы корзины (${items.length}) будут удалены безвозвратно вместе с файлами.`
                : "Файлы будут удалены из хранилища безвозвратно."}{" "}
              Восстановить их будет нельзя.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                runConfirm()
              }}
              disabled={busy}
              className="bg-red-600 hover:bg-red-700"
            >
              {busy && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              {confirm?.kind === "empty" ? "Очистить" : "Удалить навсегда"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
