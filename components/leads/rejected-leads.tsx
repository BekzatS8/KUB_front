"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Hand,
  Instagram,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Send,
  Undo2,
  UserX,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useMe } from "@/lib/use-role-code"
import { list_leads, move_lead_stage, take_lead } from "@/src/api/leads.api"
import { listFunnelStages } from "@/src/api/funnel-stages.api"
import type { FunnelStage } from "@/src/models/funnel-stages.model"

interface RejectedLead {
  id: number
  title: string
  phone?: string
  source?: string
  created_at?: string
  owner_id: number
  owner_name?: string
  unassigned?: boolean
  branch_name?: string
  funnel_id?: number | null
}

const PAGE_SIZE = 20

// Фильтр по источнику — значения, которые принимает сервер (?source=).
const SOURCE_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Все" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "telegram", label: "Telegram" },
]

const SOURCE_META: Record<string, { label: string; icon: typeof Phone; className: string }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, className: "bg-emerald-50 text-emerald-600" },
  instagram: { label: "Instagram", icon: Instagram, className: "bg-pink-50 text-pink-600" },
  telegram: { label: "Telegram", icon: Send, className: "bg-sky-50 text-sky-600" },
  binotel: { label: "Звонок", icon: Phone, className: "bg-violet-50 text-violet-600" },
  phone: { label: "Звонок", icon: Phone, className: "bg-violet-50 text-violet-600" },
}

function sourceMeta(source?: string) {
  return SOURCE_META[(source || "").toLowerCase()] || { label: source || "Вручную", icon: MessageCircle, className: "bg-slate-100 text-slate-500" }
}

function errorText(err: any, fallback: string) {
  return err?.response?.data?.message || err?.message || fallback
}

// +77766661699 → +7 776 666 16 99
function formatPhone(raw?: string) {
  const d = String(raw || "").replace(/\D/g, "")
  if (d.length === 11 && (d[0] === "7" || d[0] === "8")) {
    return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`
  }
  return d ? `+${d}` : ""
}

// «Лид из WhatsApp +7776…» — заголовок собран автоматически и повторяет
// телефон. Тогда главным показываем телефон, а не дубль.
function displayName(lead: RejectedLead) {
  const phone = formatPhone(lead.phone)
  const stripped = (lead.title || "").replace(/\+?\d[\d\s()-]{6,}/g, "").trim()
  const generic = !stripped || /^лид(\s+из\s+\S+)?$/i.test(stripped)
  if (generic) return { main: phone || lead.title || `Лид #${lead.id}`, sub: "" }
  return { main: stripped, sub: phone }
}

function formatDate(iso?: string) {
  if (!iso) return { date: "—", ago: "" }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: iso, ago: "" }
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  const ago = days <= 0 ? "сегодня" : days === 1 ? "вчера" : days < 30 ? `${days} дн. назад` : ""
  const date = d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }).replace(/\s*г\.$/, "")
  return { date, ago }
}

function initials(name?: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean)
  return (parts[0]?.[0] || "") + (parts[1]?.[0] || "") || "?"
}

// Этапы воронки для «Вернуть в работу» — кэш на время жизни страницы.
const stagesCache = new Map<number, FunnelStage[]>()

async function workStages(funnelId: number): Promise<FunnelStage[]> {
  if (!stagesCache.has(funnelId)) {
    const list = await listFunnelStages(funnelId)
    stagesCache.set(funnelId, list || [])
  }
  // Только рабочие этапы: не отказ и не «проигран».
  return (stagesCache.get(funnelId) || []).filter((s) => s.is_active !== false && !s.is_rejection && s.type !== "lost")
}

// Отказники — лиды, ушедшие на этап отказа (статус «отказ»). С доски они
// убираются; здесь их находят, берут себе и возвращают в работу на рабочий
// этап воронки.
export function RejectedLeads() {
  const router = useRouter()
  const { id: myId, roleCode } = useMe()
  const canWork = ["system_admin", "management", "sales", "visa", "partner"].includes(roleCode)

  const [items, setItems] = useState<RejectedLead[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const [source, setSource] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<number | null>(null)
  const [stagesFor, setStagesFor] = useState<Record<number, FunnelStage[]>>({})

  // Поиск — с задержкой, чтобы не дёргать сервер на каждую букву.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      setSearch(query.trim())
    }, 350)
    return () => clearTimeout(t)
  }, [query])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params: Record<string, any> = { page, size: PAGE_SIZE, status: "cancelled", sort_by: "created_at", order: "desc" }
      if (search) params.q = search
      if (source) params.source = source
      const res = await list_leads(undefined, params)
      const list: RejectedLead[] = Array.isArray(res) ? res : res?.items || []
      setItems(list)
      setTotal(Number(res?.pagination?.total ?? list.length))
    } catch (err: any) {
      setError(errorText(err, "Не удалось загрузить отказников"))
    } finally {
      setLoading(false)
    }
  }, [page, search, source])

  useEffect(() => {
    load()
  }, [load])

  // Этапы воронок, нужные для текущей страницы.
  useEffect(() => {
    const funnelIds = Array.from(new Set(items.map((l) => Number(l.funnel_id || 0)).filter(Boolean)))
    funnelIds.forEach((fid) => {
      if (stagesFor[fid]) return
      workStages(fid)
        .then((list) => setStagesFor((prev) => ({ ...prev, [fid]: list })))
        .catch(() => setStagesFor((prev) => ({ ...prev, [fid]: [] })))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const take = async (lead: RejectedLead) => {
    setBusyId(lead.id)
    try {
      await take_lead(lead.id)
      toast.success(`Лид #${lead.id} теперь ваш`)
      await load()
    } catch (err: any) {
      toast.error(errorText(err, "Не удалось взять лид"))
    } finally {
      setBusyId(null)
    }
  }

  const returnToWork = async (lead: RejectedLead, stage: FunnelStage) => {
    setBusyId(lead.id)
    try {
      await move_lead_stage({ stage_id: stage.id }, { id: lead.id })
      toast.success(`Лид #${lead.id} снова в работе — этап «${stage.name}»`)
      await load()
    } catch (err: any) {
      toast.error(errorText(err, "Не удалось вернуть лид в работу"))
    } finally {
      setBusyId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(total, page * PAGE_SIZE)
  // Колонки таблицы на широком экране; на узком строки — карточки.
  const gridCols = "md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_auto] md:items-center md:gap-4"

  return (
    <Card className="mb-6 overflow-hidden">
      <CardContent className="p-0">
        {/* Шапка */}
        <div className="flex flex-col gap-4 border-b p-4 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <UserX className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">Отказники</h2>
                  {!loading && (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">{total}</span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-gray-500">
                  Лиды на этапе отказа. Верните лид в работу — он снова появится на доске.
                </p>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={load} disabled={loading} title="Обновить">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по имени, телефону или номеру лида"
                className="pl-9"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SOURCE_FILTERS.map((f) => (
                <button
                  key={f.value || "all"}
                  type="button"
                  onClick={() => {
                    setPage(1)
                    setSource(f.value)
                  }}
                  className={cn(
                    "whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors",
                    source === f.value ? "bg-white font-medium text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Заголовки колонок */}
        <div className={cn("hidden border-b bg-gray-50 px-6 py-2 text-xs font-medium uppercase tracking-wide text-gray-500", gridCols)}>
          <span>Клиент</span>
          <span>Филиал</span>
          <span>Ответственный</span>
          <span>Создан</span>
          <span className="w-[230px] text-right">Действия</span>
        </div>

        {error && <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {loading && items.length === 0 && (
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-4 md:px-6">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <UserX className="h-6 w-6" />
            </div>
            <p className="font-medium text-gray-700">{search || source ? "Ничего не найдено" : "Отказников нет"}</p>
            <p className="text-sm text-gray-500">
              {search || source ? "Измените поиск или фильтр." : "Лиды появятся здесь, когда их переведут на этап отказа."}
            </p>
          </div>
        )}

        <div className={cn("divide-y", loading && items.length > 0 && "opacity-60")}>
          {items.map((lead) => {
            const meta = sourceMeta(lead.source)
            const SourceIcon = meta.icon
            const name = displayName(lead)
            const created = formatDate(lead.created_at)
            const stages = stagesFor[Number(lead.funnel_id || 0)]
            const isMine = !!myId && lead.owner_id === myId
            const free = lead.unassigned || !lead.owner_name
            const canTake = canWork && !isMine && free
            const busy = busyId === lead.id
            return (
              <div
                key={lead.id}
                className={cn("group flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-gray-50 md:px-6", gridCols)}
              >
                {/* Клиент */}
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-3 text-left"
                  onClick={() => router.push(`/leads/${lead.id}`)}
                  title="Открыть карточку лида"
                >
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", meta.className)}>
                    <SourceIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-900 group-hover:text-blue-700">{name.main}</span>
                    <span className="block truncate text-xs text-gray-500">
                      <span className="font-mono text-gray-400">#{lead.id}</span>
                      <span className="mx-1.5 text-gray-300">·</span>
                      {meta.label}
                      {name.sub && (
                        <>
                          <span className="mx-1.5 text-gray-300">·</span>
                          {name.sub}
                        </>
                      )}
                    </span>
                  </span>
                </button>

                {/* Филиал, ответственный, дата: на телефоне — одна строка под
                    именем, на широком экране — колонки (md:contents). */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-12 md:contents">
                {/* Филиал */}
                <div className="text-sm text-gray-700 md:truncate">
                  {lead.branch_name || <span className="text-gray-400">—</span>}
                </div>

                {/* Ответственный */}
                <div className="min-w-0">
                  {free ? (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      Без ответственного
                    </span>
                  ) : (
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold uppercase text-blue-700">
                        {initials(lead.owner_name)}
                      </span>
                      <span className="truncate text-sm text-gray-800">
                        {lead.owner_name}
                        {isMine && <span className="ml-1 text-xs text-gray-400">(вы)</span>}
                      </span>
                    </span>
                  )}
                </div>

                {/* Создан */}
                <div className="text-sm">
                  <span className="text-gray-700">{created.date}</span>
                  {created.ago && (
                    <span className="ml-1 text-xs text-gray-400 md:ml-0 md:block">
                      <span className="md:hidden">· </span>
                      {created.ago}
                    </span>
                  )}
                </div>
                </div>

                {/* Действия */}
                <div className="flex items-center gap-2 pl-12 md:w-[230px] md:justify-end md:pl-0">
                  {canTake && (
                    <Button
                      size="sm"
                      className="h-8 gap-1 bg-amber-500 text-white hover:bg-amber-600"
                      onClick={() => take(lead)}
                      disabled={busy}
                    >
                      <Hand className="h-3.5 w-3.5" />
                      Взять
                    </Button>
                  )}
                  {canWork && lead.funnel_id ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="h-8 gap-1" disabled={busy}>
                          {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                          В работу
                          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="text-xs font-normal text-gray-500">Вернуть на этап</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {!stages && <DropdownMenuItem disabled>Загрузка этапов…</DropdownMenuItem>}
                        {stages && stages.length === 0 && <DropdownMenuItem disabled>Нет рабочих этапов</DropdownMenuItem>}
                        {stages?.map((s) => (
                          <DropdownMenuItem key={s.id} onClick={() => returnToWork(lead, s)} className="gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color || "#94a3b8" }} />
                            {s.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-gray-500"
                    onClick={() => router.push(`/leads/${lead.id}`)}
                    title="Открыть карточку"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-gray-600 md:px-6">
            <span>
              {from}–{to} из {total}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-xs text-gray-500">
                  {page} / {totalPages}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
