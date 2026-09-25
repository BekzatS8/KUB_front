"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock, Infinity as InfinityIcon, LoaderCircle, Search, UserMinus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  driveErrorMessage,
  listDriveShares,
  listDriveUsers,
  revokeDriveShare,
  shareDriveNode,
  type DriveNode,
  type DriveShare,
  type DriveUser,
} from "@/src/api/drive.api"
import { getRoleName } from "@/src/models/roles.enum"
import { formatAccessUntil } from "./drive-utils"

const ADMIN_ROLE_ID = 50

type Term = "forever" | "1" | "7" | "30" | "date"

const TERMS: { value: Term; label: string }[] = [
  { value: "forever", label: "Бессрочно" },
  { value: "1", label: "1 день" },
  { value: "7", label: "7 дней" },
  { value: "30", label: "30 дней" },
  { value: "date", label: "До даты" },
]

/** Срок в ISO или null (бессрочно). Дата «до» включительно — до конца дня. */
function resolveExpiry(term: Term, date: string): string | null | undefined {
  if (term === "forever") return null
  if (term === "date") {
    if (!date) return undefined
    const d = new Date(`${date}T23:59:59`)
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
  }
  return new Date(Date.now() + Number(term) * 24 * 3600 * 1000).toISOString()
}

function todayISODate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

interface Props {
  node: DriveNode | null
  onClose: () => void
  /** Доступы изменились — обновить счётчик в списке. */
  onChanged: () => void
}

export function DriveShareDialog({ node, onClose, onChanged }: Props) {
  const [users, setUsers] = useState<DriveUser[]>([])
  const [shares, setShares] = useState<DriveShare[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [term, setTerm] = useState<Term>("forever")
  const [date, setDate] = useState("")
  const [saving, setSaving] = useState(false)
  const [revokingId, setRevokingId] = useState<number | null>(null)

  useEffect(() => {
    if (!node) return
    setQuery("")
    setSelected(new Set())
    setTerm("forever")
    setDate("")
    setLoading(true)
    Promise.all([listDriveUsers(), listDriveShares(node.id)])
      .then(([u, s]) => {
        setUsers(u)
        setShares(s)
      })
      .catch((err) => toast.error(driveErrorMessage(err, "Не удалось загрузить данные")))
      .finally(() => setLoading(false))
  }, [node])

  const activeByUser = useMemo(() => {
    const m = new Map<number, DriveShare>()
    shares.filter((s) => !s.expired).forEach((s) => m.set(s.user_id, s))
    return m
  }, [shares])

  // Администраторы видят всё хранилище и без выдачи — в списке они лишние.
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users
      .filter((u) => u.role_id !== ADMIN_ROLE_ID)
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [users, query])

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const expiry = resolveExpiry(term, date)

  const submit = async () => {
    if (!node || selected.size === 0) return
    if (expiry === undefined) {
      toast.error("Выберите дату окончания доступа")
      return
    }
    setSaving(true)
    try {
      setShares(await shareDriveNode(node.id, [...selected], expiry))
      toast.success(selected.size === 1 ? "Доступ открыт" : `Доступ открыт ${selected.size} сотрудникам`)
      setSelected(new Set())
      onChanged()
    } catch (err) {
      toast.error(driveErrorMessage(err, "Не удалось открыть доступ"))
    } finally {
      setSaving(false)
    }
  }

  const revoke = async (share: DriveShare) => {
    setRevokingId(share.id)
    try {
      await revokeDriveShare(share.id)
      setShares((prev) => prev.filter((s) => s.id !== share.id))
      toast.success(`Доступ для ${share.user_name} закрыт`)
      onChanged()
    } catch (err) {
      toast.error(driveErrorMessage(err, "Не удалось закрыть доступ"))
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <Dialog open={node !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">Доступ: {node?.name}</DialogTitle>
          <DialogDescription>
            {node?.kind === "folder"
              ? "Доступ к папке открывает всё её содержимое — в том числе вложенные папки и файлы, добавленные позже."
              : "Сотрудник сможет просматривать и скачивать этот файл."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Выдача доступа */}
            <section className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск сотрудника по имени или почте"
                  className="pl-9"
                />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                {candidates.length === 0 ? (
                  <p className="p-4 text-center text-sm text-slate-500">Никого не найдено</p>
                ) : (
                  candidates.map((u) => {
                    const current = activeByUser.get(u.id)
                    return (
                      <label
                        key={u.id}
                        className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-slate-50"
                      >
                        <Checkbox checked={selected.has(u.id)} onCheckedChange={() => toggle(u.id)} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-900">{u.name}</div>
                          <div className="truncate text-xs text-slate-500">
                            {getRoleName(u.role_id)}
                            {u.email ? ` · ${u.email}` : ""}
                          </div>
                        </div>
                        {current && (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                            есть доступ {formatAccessUntil(current.expires_at)}
                          </span>
                        )}
                      </label>
                    )
                  })
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Срок доступа</p>
                <div className="flex flex-wrap gap-2">
                  {TERMS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTerm(t.value)}
                      className={`rounded-full border px-3 py-1 text-sm transition ${
                        term === t.value
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                  {term === "date" && (
                    <input
                      type="date"
                      min={todayISODate()}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-8 rounded-md border border-slate-300 px-2 text-sm"
                    />
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {expiry === null
                    ? "Доступ будет действовать, пока вы его не закроете."
                    : expiry
                      ? `Доступ закроется автоматически ${formatAccessUntil(expiry)}.`
                      : "Выберите дату."}{" "}
                  Если у сотрудника уже есть доступ, срок будет заменён на новый.
                </p>
              </div>

              <Button onClick={submit} disabled={saving || selected.size === 0} className="w-full sm:w-auto">
                {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                {selected.size > 0 ? `Открыть доступ (${selected.size})` : "Выберите сотрудников"}
              </Button>
            </section>

            {/* Действующие доступы */}
            <section className="space-y-2 border-t border-slate-200 pt-4">
              <p className="text-sm font-medium text-slate-700">У кого есть доступ</p>
              {shares.length === 0 ? (
                <p className="text-sm text-slate-500">Пока ни у кого — видят только администраторы.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                  {shares.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">{s.user_name}</div>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          {s.expires_at ? <Clock className="h-3 w-3" /> : <InfinityIcon className="h-3 w-3" />}
                          {s.expired ? (
                            <span className="text-red-600">истёк {formatAccessUntil(s.expires_at).replace("до ", "")}</span>
                          ) : (
                            formatAccessUntil(s.expires_at)
                          )}
                          {s.created_by_name ? ` · выдал ${s.created_by_name}` : ""}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 hover:bg-red-50 hover:text-red-600"
                        disabled={revokingId === s.id}
                        onClick={() => revoke(s)}
                      >
                        {revokingId === s.id ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserMinus className="h-4 w-4" />
                        )}
                        <span className="ml-1 hidden sm:inline">Закрыть</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
