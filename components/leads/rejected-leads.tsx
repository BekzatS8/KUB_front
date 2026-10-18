"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Hand, RefreshCw, Search, Undo2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { list_leads, move_lead_stage, take_lead } from "@/src/api/leads.api"
import { listFunnelStages } from "@/src/api/funnel-stages.api"
import type { FunnelStage } from "@/src/models/funnel-stages.model"
import { getCurrentUser, getRoleCode } from "@/lib/auth"

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
  stage_id?: number | null
}

const PAGE_SIZE = 20

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
  binotel: "Звонок",
  manual: "Вручную",
  website: "Сайт",
}

function errorText(err: any, fallback: string) {
  return err?.response?.data?.message || err?.message || fallback
}

function formatDate(iso?: string) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("ru-RU")
  } catch {
    return iso
  }
}

// Этапы воронки для «Вернуть в работу» — кэш на время жизни страницы.
const stagesCache = new Map<number, FunnelStage[]>()

async function workStages(funnelId: number): Promise<FunnelStage[]> {
  if (!stagesCache.has(funnelId)) {
    const list = await listFunnelStages(funnelId)
    stagesCache.set(funnelId, list || [])
  }
  // Возвращаем только рабочие этапы: не отказ и не «проигран».
  return (stagesCache.get(funnelId) || []).filter((s) => s.is_active !== false && !s.is_rejection && s.type !== "lost")
}

// Отказники — лиды, ушедшие на этап отказа (статус «отказ»). С доски они
// убираются, здесь их можно найти, взять себе и вернуть в работу на любой
// рабочий этап воронки.
export function RejectedLeads() {
  const router = useRouter()
  const me = getCurrentUser() as any
  const myId = Number(me?.id || 0)
  const roleCode = getRoleCode(me) || ""
  const canWork = ["system_admin", "management", "sales", "visa", "partner"].includes(roleCode)

  const [items, setItems] = useState<RejectedLead[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<number | null>(null)
  const [stagesFor, setStagesFor] = useState<Record<number, FunnelStage[]>>({})

  // Поиск — с небольшой задержкой, чтобы не дёргать сервер на каждую букву.
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
      const res = await list_leads(undefined, params)
      const list: RejectedLead[] = Array.isArray(res) ? res : res?.items || []
      setItems(list)
      setTotal(Number(res?.pagination?.total ?? list.length))
    } catch (err: any) {
      setError(errorText(err, "Не удалось загрузить отказников"))
    } finally {
      setLoading(false)
    }
  }, [page, search])

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

  const returnToWork = async (lead: RejectedLead, stageId: number) => {
    const stage = (stagesFor[Number(lead.funnel_id)] || []).find((s) => s.id === stageId)
    setBusyId(lead.id)
    try {
      await move_lead_stage({ stage_id: stageId }, { id: lead.id })
      toast.success(`Лид #${lead.id} снова в работе${stage ? ` — этап «${stage.name}»` : ""}`)
      await load()
    } catch (err: any) {
      toast.error(errorText(err, "Не удалось вернуть лид в работу"))
    } finally {
      setBusyId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Отказники</span>
          <Button variant="outline" size="icon" onClick={load} disabled={loading} title="Обновить">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
        <CardDescription>
          Лиды, ушедшие на этап отказа. Возьмите лид себе и верните в работу на нужный этап — он снова
          появится на доске.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: имя, телефон или номер лида"
            className="pl-9"
          />
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {!loading && !error && items.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">
            {search ? "Ничего не найдено" : "Отказников нет"}
          </p>
        )}

        <div className="space-y-2">
          {items.map((lead) => {
            const stages = stagesFor[Number(lead.funnel_id || 0)] || []
            const isMine = !!myId && lead.owner_id === myId
            const canTake = canWork && !isMine && !!lead.unassigned
            const busy = busyId === lead.id
            return (
              <div
                key={lead.id}
                className="flex flex-col gap-3 rounded-lg border bg-white p-3 md:flex-row md:items-center md:justify-between"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => router.push(`/leads/${lead.id}`)}
                  title="Открыть карточку лида"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-400">#{lead.id}</span>
                    <span className="truncate font-medium text-gray-900 hover:underline">{lead.title || `Лид #${lead.id}`}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                    {lead.phone && <span className="font-mono">+{String(lead.phone).replace(/^\+/, "")}</span>}
                    {lead.source && <span>{SOURCE_LABELS[lead.source] || lead.source}</span>}
                    {lead.branch_name && <span>{lead.branch_name}</span>}
                    <span>создан {formatDate(lead.created_at)}</span>
                    <span className={lead.unassigned ? "text-amber-600" : ""}>
                      {lead.unassigned || !lead.owner_name ? "без ответственного" : `отв.: ${lead.owner_name}${isMine ? " (вы)" : ""}`}
                    </span>
                  </div>
                </button>

                {canWork && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {canTake && (
                      <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => take(lead)} disabled={busy}>
                        <Hand className="h-3.5 w-3.5" />
                        Взять себе
                      </Button>
                    )}
                    {lead.funnel_id ? (
                      <label className="inline-flex items-center gap-1">
                        <Undo2 className="h-3.5 w-3.5 text-gray-500" />
                        <select
                          aria-label="Вернуть в работу"
                          value=""
                          disabled={busy || stages.length === 0}
                          onChange={(e) => {
                            const stageId = Number(e.target.value)
                            if (stageId) returnToWork(lead, stageId)
                          }}
                          className="h-8 cursor-pointer rounded-md border bg-white px-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-default disabled:opacity-60"
                        >
                          <option value="" disabled>
                            {stages.length === 0 ? "Загрузка этапов…" : "Вернуть в работу…"}
                          </option>
                          {stages.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <span className="text-xs text-gray-400">Нет воронки — откройте карточку</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-1 text-sm text-gray-600">
            <span>
              Всего: {total} · стр. {page} из {totalPages}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
