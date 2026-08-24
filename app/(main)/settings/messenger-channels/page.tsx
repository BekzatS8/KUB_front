"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getWazzupChannels,
  setWazzupChannelBranch,
  type WazzupChannel,
} from "@/src/api/integrations_wazzup.api"
import { listBranches, type Branch } from "@/src/api/branches.api"

const TRANSPORT_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
}

export default function MessengerChannelsPage() {
  const [channels, setChannels] = useState<WazzupChannel[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [chRes, brRes] = await Promise.all([getWazzupChannels(), listBranches()])
      setChannels(chRes?.value || [])
      setBranches(Array.isArray(brRes) ? brRes : brRes?.data || [])
    } catch {
      toast.error("Не удалось загрузить каналы")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleChange = async (channelId: number, branchIdRaw: string) => {
    const branchId = branchIdRaw ? Number(branchIdRaw) : null
    setSavingId(channelId)
    try {
      await setWazzupChannelBranch(channelId, branchId)
      setChannels((prev) =>
        prev.map((c) => (c.id === channelId ? { ...c, branch_id: branchId } : c)),
      )
      toast.success("Филиал канала сохранён")
    } catch {
      toast.error("Не удалось сохранить филиал канала")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Каналы мессенджера</h1>
          <p className="text-sm text-slate-600">
            Привязка каналов WhatsApp / Telegram / Instagram к филиалам
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
          Обновить
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Канал → филиал</CardTitle>
          <CardDescription>
            Входящий лид из канала попадает в выбранный филиал. Так менеджеры филиала
            видят только своих лидов и клиентов. Если филиал не выбран — лид получает
            филиал владельца интеграции.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Загрузка каналов...</p>
          ) : channels.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Каналы не найдены. Убедитесь, что интеграция Wazzup включена и каналы
              добавлены в личном кабинете сервиса, затем откройте раздел «Мессенджер»
              один раз для синхронизации и нажмите «Обновить».
            </p>
          ) : (
            <div className="space-y-3">
              {channels.map((ch) => (
                <div
                  key={ch.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900">
                      {ch.name || ch.phone || ch.channel_id}
                    </div>
                    <div className="text-xs text-slate-500">
                      {TRANSPORT_LABELS[ch.transport] || ch.transport}
                      {ch.phone ? ` · ${ch.phone}` : ""}
                    </div>
                  </div>
                  <select
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm sm:w-56"
                    value={ch.branch_id ? String(ch.branch_id) : ""}
                    disabled={savingId === ch.id}
                    onChange={(e) => handleChange(ch.id, e.target.value)}
                  >
                    <option value="">— без филиала —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
