"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Building2,
  Clock,
  Infinity as InfinityIcon,
  LoaderCircle,
  Network,
  Search,
  User as UserIcon,
  UserMinus,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  driveErrorMessage,
  listDriveShareGroups,
  listDriveShares,
  listDriveUsers,
  revokeDriveShare,
  shareDriveNode,
  type DriveNode,
  type DriveShare,
  type DriveShareGroup,
  type DriveShareTarget,
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

type Tab = "users" | "branches" | "departments"

const TABS: { value: Tab; label: string; icon: typeof UserIcon; search: string }[] = [
  { value: "users", label: "Сотрудники", icon: UserIcon, search: "Поиск сотрудника по имени или почте" },
  { value: "branches", label: "Филиалы", icon: Building2, search: "Поиск филиала" },
  { value: "departments", label: "Отделы", icon: Network, search: "Поиск отдела" },
]

const TARGET_LABELS: Record<DriveShareTarget, { label: string; icon: typeof UserIcon }> = {
  all: { label: "все сотрудники", icon: Users },
  branch: { label: "филиал", icon: Building2 },
  department: { label: "отдел", icon: Network },
  user: { label: "сотрудник", icon: UserIcon },
}

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

function toggleIn(set: Set<number>, id: number): Set<number> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

interface Props {
  node: DriveNode | null
  onClose: () => void
  /** Доступы изменились — обновить счётчик в списке. */
  onChanged: () => void
}

export function DriveShareDialog({ node, onClose, onChanged }: Props) {
  const [users, setUsers] = useState<DriveUser[]>([])
  const [branches, setBranches] = useState<DriveShareGroup[]>([])
  const [departments, setDepartments] = useState<DriveShareGroup[]>([])
  const [shares, setShares] = useState<DriveShare[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>("users")
  const [query, setQuery] = useState("")
  const [selUsers, setSelUsers] = useState<Set<number>>(new Set())
  const [selBranches, setSelBranches] = useState<Set<number>>(new Set())
  const [selDepartments, setSelDepartments] = useState<Set<number>>(new Set())
  const [all, setAll] = useState(false)
  const [term, setTerm] = useState<Term>("forever")
  const [date, setDate] = useState("")
  const [saving, setSaving] = useState(false)
  const [revokingId, setRevokingId] = useState<number | null>(null)

  const resetSelection = () => {
    setSelUsers(new Set())
    setSelBranches(new Set())
    setSelDepartments(new Set())
    setAll(false)
  }

  useEffect(() => {
    if (!node) return
    setQuery("")
    setTab("users")
    resetSelection()
    setTerm("forever")
    setDate("")
    setLoading(true)
    Promise.all([
      listDriveUsers(),
      listDriveShares(node.id),
      // Старый бэкенд без групп — окно работает как раньше, только с сотрудниками.
      listDriveShareGroups().catch(() => ({ branches: [], departments: [] })),
    ])
      .then(([u, s, g]) => {
        setUsers(u)
        setShares(s)
        setBranches(g.branches)
        setDepartments(g.departments)
      })
      .catch((err) => toast.error(driveErrorMessage(err, "Не удалось загрузить данные")))
      .finally(() => setLoading(false))
  }, [node])

  // Действующие доступы по ключу «тип:id» — для пометки «есть доступ».
  const active = useMemo(() => {
    const m = new Map<string, DriveShare>()
    shares
      .filter((s) => !s.expired)
      .forEach((s) => {
        const target = s.target || "user"
        const id = target === "branch" ? s.branch_id : target === "department" ? s.department_id : s.user_id
        m.set(`${target}:${id ?? 0}`, s)
      })
    return m
  }, [shares])

  const q = query.trim().toLowerCase()
  // Администраторы видят всё хранилище и без выдачи — в списке они лишние.
  const userRows = useMemo(
    () =>
      users
        .filter((u) => u.role_id !== ADMIN_ROLE_ID)
        .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
    [users, q],
  )
  const groupRows = (list: DriveShareGroup[]) => list.filter((g) => !q || g.name.toLowerCase().includes(q))

  const selectedCount = selUsers.size + selBranches.size + selDepartments.size + (all ? 1 : 0)
  const expiry = resolveExpiry(term, date)

  const submit = async () => {
    if (!node || selectedCount === 0) return
    if (expiry === undefined) {
      toast.error("Выберите дату окончания доступа")
      return
    }
    setSaving(true)
    try {
      setShares(
        await shareDriveNode(
          node.id,
          {
            userIds: [...selUsers],
            branchIds: [...selBranches],
            departmentIds: [...selDepartments],
            all,
          },
          expiry,
        ),
      )
      toast.success(all ? "Доступ открыт всем сотрудникам" : "Доступ открыт")
      resetSelection()
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
      toast.success(`Доступ для «${share.label || share.user_name}» закрыт`)
      onChanged()
    } catch (err) {
      toast.error(driveErrorMessage(err, "Не удалось закрыть доступ"))
    } finally {
      setRevokingId(null)
    }
  }

  const accessBadge = (key: string) => {
    const current = active.get(key)
    if (!current) return null
    return (
      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
        есть доступ {formatAccessUntil(current.expires_at)}
      </span>
    )
  }

  const groupList = (list: DriveShareGroup[], kind: "branch" | "department", selected: Set<number>, setSelected: (s: Set<number>) => void) => {
    const rows = groupRows(list)
    if (rows.length === 0) return <p className="p-4 text-center text-sm text-slate-500">Ничего не найдено</p>
    return rows.map((g) => (
      <label
        key={g.id}
        className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-slate-50"
      >
        <Checkbox checked={selected.has(g.id)} onCheckedChange={() => setSelected(toggleIn(selected, g.id))} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-slate-900">{g.name}</div>
          <div className="text-xs text-slate-500">
            сотрудников: {g.members} · новые сотрудники {kind === "branch" ? "филиала" : "отдела"} получат доступ сами
          </div>
        </div>
        {accessBadge(`${kind}:${g.id}`)}
      </label>
    ))
  }

  const tabCount: Record<Tab, number> = {
    users: selUsers.size,
    branches: selBranches.size,
    departments: selDepartments.size,
  }

  return (
    <Dialog open={node !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto bg-white">
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
              {/* «Все» — одной записью: новые сотрудники тоже получат доступ. */}
              <label
                className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                  all ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <Checkbox checked={all} onCheckedChange={(v) => setAll(v === true)} />
                <Users className="h-5 w-5 shrink-0 text-blue-600" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900">Все сотрудники</div>
                  <div className="text-xs text-slate-500">Включая тех, кого добавят позже</div>
                </div>
                {accessBadge("all:0")}
              </label>

              <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                {TABS.map((t) => {
                  const Icon = t.icon
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        setTab(t.value)
                        setQuery("")
                      }}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition ${
                        tab === t.value ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {t.label}
                      {tabCount[t.value] > 0 && (
                        <span className="rounded-full bg-blue-600 px-1.5 text-xs text-white">{tabCount[t.value]}</span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={TABS.find((t) => t.value === tab)?.search}
                  className="pl-9"
                />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                {tab === "users" &&
                  (userRows.length === 0 ? (
                    <p className="p-4 text-center text-sm text-slate-500">Никого не найдено</p>
                  ) : (
                    userRows.map((u) => (
                      <label
                        key={u.id}
                        className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-slate-50"
                      >
                        <Checkbox checked={selUsers.has(u.id)} onCheckedChange={() => setSelUsers(toggleIn(selUsers, u.id))} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-900">{u.name}</div>
                          <div className="truncate text-xs text-slate-500">
                            {getRoleName(u.role_id)}
                            {u.email ? ` · ${u.email}` : ""}
                          </div>
                        </div>
                        {accessBadge(`user:${u.id}`)}
                      </label>
                    ))
                  ))}
                {tab === "branches" && groupList(branches, "branch", selBranches, setSelBranches)}
                {tab === "departments" && groupList(departments, "department", selDepartments, setSelDepartments)}
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
                  Если доступ уже есть, срок будет заменён на новый.
                </p>
              </div>

              <Button onClick={submit} disabled={saving || selectedCount === 0} className="w-full sm:w-auto">
                {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                {selectedCount > 0 ? `Открыть доступ (${selectedCount})` : "Выберите, кому открыть доступ"}
              </Button>
            </section>

            {/* Действующие доступы */}
            <section className="space-y-2 border-t border-slate-200 pt-4">
              <p className="text-sm font-medium text-slate-700">У кого есть доступ</p>
              {shares.length === 0 ? (
                <p className="text-sm text-slate-500">Пока ни у кого — видят только администраторы.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                  {shares.map((s) => {
                    const kind = TARGET_LABELS[s.target || "user"] ?? TARGET_LABELS.user
                    const KindIcon = kind.icon
                    return (
                      <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                        <KindIcon className="h-4 w-4 shrink-0 text-slate-400" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {s.label || s.user_name}
                            {s.target && s.target !== "user" && s.target !== "all" && (
                              <span className="ml-2 text-xs font-normal text-slate-500">{kind.label}</span>
                            )}
                          </div>
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
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
