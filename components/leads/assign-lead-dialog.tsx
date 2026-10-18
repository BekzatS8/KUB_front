"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Check, RefreshCw, Search, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { assign_lead, get_lead_assignees, type LeadAssignee } from "@/src/api/leads.api"

function errorText(err: any, fallback: string) {
  return err?.response?.data?.message || err?.message || fallback
}

// Передать лид другому сотруднику (админ и руководство). Список сотрудников
// отдаёт сервер: только работающие и те, кому лид будет виден (свой филиал;
// руководство и админ — любые).
export function AssignLeadDialog({
  leadId,
  leadTitle,
  currentOwnerId,
  open,
  onClose,
  onAssigned,
}: {
  leadId: number | null
  leadTitle?: string
  currentOwnerId?: number
  open: boolean
  onClose: () => void
  onAssigned?: () => void
}) {
  const [items, setItems] = useState<LeadAssignee[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || !leadId) return
    setQuery("")
    setSelected(null)
    setError("")
    setLoading(true)
    get_lead_assignees(leadId)
      .then(setItems)
      .catch((err) => setError(errorText(err, "Не удалось загрузить сотрудников")))
      .finally(() => setLoading(false))
  }, [open, leadId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? items.filter((u) => u.name.toLowerCase().includes(q)) : items
  }, [items, query])

  const save = async () => {
    if (!leadId || !selected) return
    setSaving(true)
    setError("")
    try {
      await assign_lead({ assignee_id: selected } as any, { id: leadId })
      const name = items.find((u) => u.id === selected)?.name
      toast.success(name ? `Лид передан: ${name}` : "Ответственный назначен")
      onAssigned?.()
      onClose()
    } catch (err: any) {
      setError(errorText(err, "Не удалось назначить ответственного"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Назначить ответственного
          </DialogTitle>
          <DialogDescription>
            {leadTitle ? `Лид «${leadTitle}». ` : ""}Лид останется на своём этапе, сменится только ответственный.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск сотрудника"
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border">
            {loading ? (
              <div className="flex items-center gap-2 p-3 text-sm text-slate-500">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Загрузка…
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">Нет подходящих сотрудников</p>
            ) : (
              filtered.map((u) => {
                const isCurrent = u.id === currentOwnerId
                const isSelected = u.id === selected
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => setSelected(u.id)}
                    className={`flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 ${
                      isSelected ? "bg-primary/10" : "hover:bg-slate-50"
                    } ${isCurrent ? "cursor-default opacity-60" : ""}`}
                  >
                    <span className="min-w-0 truncate">
                      {u.name}
                      {u.is_elevated && <span className="ml-1 text-xs text-slate-400">· руководство</span>}
                      {isCurrent && <span className="ml-1 text-xs text-slate-400">· сейчас ответственный</span>}
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                )
              })
            )}
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={save} disabled={!selected || saving}>
            {saving && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            Назначить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
