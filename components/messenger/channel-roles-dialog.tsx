"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { RefreshCw, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getWazzupChannelRoles,
  resetWazzupChannelRoles,
  setWazzupChannelRoles,
  type WazzupChannel,
  type WazzupChannelRole,
  type WazzupChannelRoleItem,
} from "@/src/api/integrations_wazzup.api"

// Роли Wazzup в том же порядке и с теми же подсказками, что в кабинете.
const ROLES: { role: Exclude<WazzupChannelRole, "">; label: string; hint: string }[] = [
  { role: "auditor", label: "Контроль качества", hint: "Видит все чаты номера, писать не может" },
  { role: "seller", label: "Менеджер", hint: "Видит только своих клиентов" },
  { role: "manager", label: "Руководитель", hint: "Видит все чаты номера и может писать" },
]

// Окно «Доступ к чатам» номера — как «Выбор ролей» в кабинете Wazzup.
// Нужно дочернему аккаунту: своего кабинета у него нет, роли выдаёт CRM.
export function ChannelRolesDialog({
  channel,
  onClose,
  onSaved,
}: {
  channel: WazzupChannel | null
  onClose: () => void
  onSaved?: (configured: boolean) => void
}) {
  const [items, setItems] = useState<WazzupChannelRoleItem[]>([])
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (!channel) return
    setQuery("")
    setItems([])
    setLoading(true)
    getWazzupChannelRoles(channel.id)
      .then((res) => {
        setItems(res.items || [])
        setConfigured(res.configured)
      })
      .catch((err: any) => {
        toast.error(err?.response?.data?.message || "Не удалось загрузить доступ к номеру")
        onClose()
      })
      .finally(() => setLoading(false))
  }, [channel, onClose])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (it) => it.name.toLowerCase().includes(q) || (it.branch_name || "").toLowerCase().includes(q),
    )
  }, [items, query])

  const update = (userIds: number[], patch: (it: WazzupChannelRoleItem) => WazzupChannelRoleItem) => {
    const ids = new Set(userIds)
    setItems((prev) => prev.map((it) => (ids.has(it.user_id) ? patch(it) : it)))
  }

  // Роль у сотрудника одна: повторный клик по отмеченной снимает доступ.
  const toggleRole = (it: WazzupChannelRoleItem, role: WazzupChannelRole) => {
    update([it.user_id], (x) => {
      const next = x.role === role ? "" : role
      return {
        ...x,
        role: next,
        // Новых клиентов по умолчанию разбирают менеджеры.
        allow_get_new_clients: next === "" ? false : x.role === "" ? next === "seller" : x.allow_get_new_clients,
      }
    })
  }

  // «Выбрать роль для всех» действует на найденных поиском сотрудников.
  const bulkState = (role: WazzupChannelRole): boolean | "indeterminate" => {
    if (visible.length === 0) return false
    const n = visible.filter((it) => it.role === role).length
    return n === 0 ? false : n === visible.length ? true : "indeterminate"
  }
  const toggleAll = (role: WazzupChannelRole) => {
    const all = bulkState(role) === true
    update(
      visible.map((it) => it.user_id),
      (x) => ({
        ...x,
        role: all ? "" : role,
        allow_get_new_clients: all ? false : role === "seller",
      }),
    )
  }

  const save = async () => {
    if (!channel) return
    setSaving(true)
    try {
      const res = await setWazzupChannelRoles(
        channel.id,
        items
          .filter((it) => it.role)
          .map((it) => ({ user_id: it.user_id, role: it.role, allow_get_new_clients: it.allow_get_new_clients })),
      )
      toast.success("Доступ к номеру сохранён и отправлен в Wazzup")
      onSaved?.(res.configured)
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Не удалось сохранить доступ")
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    if (!channel) return
    setSaving(true)
    try {
      const res = await resetWazzupChannelRoles(channel.id)
      toast.success("Номер снова получает доступ автоматически по ролям CRM")
      onSaved?.(res.configured)
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Не удалось сбросить доступ")
    } finally {
      setSaving(false)
    }
  }

  const withAccess = items.filter((it) => it.role).length

  return (
    <Dialog open={channel !== null} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle>Доступ к чатам: {channel?.name || channel?.phone || channel?.channel_id}</DialogTitle>
          <DialogDescription>
            {configured
              ? "Доступ настроен вручную. Сотрудники без роли чатов этого номера не видят."
              : "Сейчас доступ выдаётся автоматически по ролям CRM — ниже показано, какой. Измените и сохраните, чтобы настроить вручную."}
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 px-5 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по сотрудникам или филиалу"
              className="pl-9"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-500">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Загрузка…
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b text-xs text-slate-500">
                  <th className="py-2 pr-2 text-left font-medium">Сотрудник</th>
                  {ROLES.map((r) => (
                    <th key={r.role} className="w-24 px-1 py-2 text-center font-medium" title={r.hint}>
                      {r.label}
                    </th>
                  ))}
                  <th
                    className="w-28 px-1 py-2 text-center font-medium"
                    title="Обращения от новых клиентов распределяются по очереди между отмеченными"
                  >
                    Получает новых клиентов
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b bg-slate-50">
                  <td className="py-2 pr-2 text-slate-600">Выбрать роль для всех{query.trim() ? " найденных" : ""}</td>
                  {ROLES.map((r) => (
                    <td key={r.role} className="px-1 py-2 text-center">
                      <Checkbox checked={bulkState(r.role)} onCheckedChange={() => toggleAll(r.role)} />
                    </td>
                  ))}
                  <td />
                </tr>
                {visible.map((it) => (
                  <tr key={it.user_id} className={it.role ? "border-b bg-emerald-50/60" : "border-b"}>
                    <td className="py-2 pr-2">
                      <div className={it.role ? "font-medium text-emerald-800" : "text-slate-800"}>{it.name}</div>
                      {it.branch_name && <div className="text-xs text-slate-500">{it.branch_name}</div>}
                    </td>
                    {ROLES.map((r) => (
                      <td key={r.role} className="px-1 py-2 text-center">
                        <Checkbox
                          checked={it.role === r.role}
                          onCheckedChange={() => toggleRole(it, r.role)}
                          aria-label={`${it.name}: ${r.label}`}
                        />
                      </td>
                    ))}
                    <td className="px-1 py-2 text-center">
                      {it.role && (
                        <Switch
                          checked={it.allow_get_new_clients}
                          onCheckedChange={(v) => update([it.user_id], (x) => ({ ...x, allow_get_new_clients: v }))}
                          aria-label={`${it.name}: получает новых клиентов`}
                        />
                      )}
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Никого не найдено
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            С доступом: {withAccess} из {items.length}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {configured && (
              <Button variant="ghost" onClick={reset} disabled={saving || loading}>
                Вернуть автоматический доступ
              </Button>
            )}
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Отмена
            </Button>
            <Button onClick={save} disabled={saving || loading}>
              {saving && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
