"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Edit, Plus, RefreshCw, Trash2, ToggleLeft, ToggleRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CustomSelect } from "@/components/ui/custom-select"
import { Skeleton } from "@/components/ui/skeleton"
import { getMyPermissions } from "@/src/api/permissions.api"
import * as FunnelsAPI from "@/src/api/funnels.api"
import * as FunnelStagesAPI from "@/src/api/funnel-stages.api"
import * as RulesAPI from "@/src/api/funnel-transition-rules.api"
import type { Funnel } from "@/src/models/funnels.model"
import type { FunnelStage } from "@/src/models/funnel-stages.model"
import type {
  FunnelTransitionRule,
  UpsertFunnelTransitionRuleRequest,
} from "@/src/models/funnel-transition-rules.model"

const emptyForm: UpsertFunnelTransitionRuleRequest = {
  name: "",
  from_funnel_id: 0,
  from_stage_id: 0,
  to_funnel_id: 0,
  to_stage_id: 0,
  is_active: true,
}

export default function FunnelTransitionsPage() {
  const [rules, setRules] = useState<FunnelTransitionRule[]>([])
  const [funnels, setFunnels] = useState<Funnel[]>([])
  const [stagesCache, setStagesCache] = useState<Record<number, FunnelStage[]>>({})
  const [canManage, setCanManage] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<FunnelTransitionRule | null>(null)
  const [form, setForm] = useState<UpsertFunnelTransitionRuleRequest>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<FunnelTransitionRule | null>(null)

  async function loadStages(funnelId: number) {
    if (!funnelId || stagesCache[funnelId]) return
    try {
      const stages = await FunnelStagesAPI.listFunnelStages(funnelId)
      setStagesCache((prev) => ({ ...prev, [funnelId]: stages }))
    } catch {
      toast.error("Не удалось загрузить этапы воронки")
    }
  }

  useEffect(() => {
    if (form.from_funnel_id) loadStages(form.from_funnel_id)
  }, [form.from_funnel_id])

  useEffect(() => {
    if (form.to_funnel_id) loadStages(form.to_funnel_id)
  }, [form.to_funnel_id])

  async function load() {
    setIsLoading(true)
    try {
      const [permData, funnelData, rulesData] = await Promise.all([
        getMyPermissions(),
        FunnelsAPI.listFunnels(),
        RulesAPI.listFunnelTransitionRules(),
      ])
      setCanManage(Boolean(permData?.scopes?.["funnels.update"]))
      setFunnels(funnelData || [])
      setRules(rulesData || [])
    } catch (err) {
      toast.error("Ошибка при загрузке данных")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditingRule(null)
    setForm(emptyForm)
    setIsDialogOpen(true)
  }

  function openEdit(rule: FunnelTransitionRule) {
    setEditingRule(rule)
    setForm({
      name: rule.name,
      from_funnel_id: rule.from_funnel_id,
      from_stage_id: rule.from_stage_id,
      to_funnel_id: rule.to_funnel_id,
      to_stage_id: rule.to_stage_id,
      is_active: rule.is_active,
    })
    setIsDialogOpen(true)
  }

  async function handleSave() {
    if (!form.from_funnel_id || !form.from_stage_id || !form.to_funnel_id || !form.to_stage_id) {
      toast.error("Заполните все поля")
      return
    }
    setIsSaving(true)
    try {
      if (editingRule) {
        await RulesAPI.updateFunnelTransitionRule(editingRule.id, form)
        toast.success("Правило обновлено")
      } else {
        await RulesAPI.createFunnelTransitionRule(form)
        toast.success("Правило создано")
      }
      setIsDialogOpen(false)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Ошибка при сохранении")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await RulesAPI.deleteFunnelTransitionRule(deleteTarget.id)
      toast.success("Правило удалено")
      setDeleteTarget(null)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Ошибка при удалении")
    }
  }

  async function handleToggle(rule: FunnelTransitionRule) {
    try {
      await RulesAPI.toggleFunnelTransitionRule(rule.id, !rule.is_active)
      toast.success(rule.is_active ? "Правило отключено" : "Правило включено")
      load()
    } catch {
      toast.error("Ошибка при изменении статуса")
    }
  }

  function getFunnelName(id: number) {
    return funnels.find((f) => f.id === id)?.name || `Воронка #${id}`
  }

  function getStageName(funnelId: number, stageId: number) {
    const stages = stagesCache[funnelId] || []
    return stages.find((s) => s.id === stageId)?.name || `Этап #${stageId}`
  }

  const funnelOptions = funnels.map((f) => ({ value: String(f.id), label: f.name }))

  function stageOptions(funnelId: number) {
    return (stagesCache[funnelId] || []).map((s) => ({ value: String(s.id), label: s.name }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Правила переходов между воронками</h1>
          <p className="text-sm text-gray-500 mt-1">
            Настройте автоматические переходы сделок из одной воронки в другую при достижении определённого этапа
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
          {canManage && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Добавить правило
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Активные правила</CardTitle>
          <CardDescription>
            Когда сделка попадает в указанный этап воронки, она автоматически копируется в целевую воронку на выбранный этап
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : rules.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <p>Правила не настроены</p>
              {canManage && (
                <Button variant="link" onClick={openCreate} className="mt-2">
                  Добавить первое правило
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Если сделка попадает в</TableHead>
                  <TableHead>То переводится в</TableHead>
                  <TableHead>Статус</TableHead>
                  {canManage && <TableHead className="text-right">Действия</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">
                      {rule.name || `Правило #${rule.id}`}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="text-gray-500">Воронка:</span>{" "}
                        <span className="font-medium">{rule.from_funnel?.name || getFunnelName(rule.from_funnel_id)}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Этап:</span>{" "}
                        <span className="font-medium">
                          {rule.from_stage?.name || getStageName(rule.from_funnel_id, rule.from_stage_id)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="text-gray-500">Воронка:</span>{" "}
                        <span className="font-medium">{rule.to_funnel?.name || getFunnelName(rule.to_funnel_id)}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Этап:</span>{" "}
                        <span className="font-medium">
                          {rule.to_stage?.name || getStageName(rule.to_funnel_id, rule.to_stage_id)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.is_active ? "default" : "outline"}>
                        {rule.is_active ? "Активно" : "Отключено"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={rule.is_active ? "Отключить" : "Включить"}
                            onClick={() => handleToggle(rule)}
                          >
                            {rule.is_active ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => setDeleteTarget(rule)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Редактировать правило" : "Новое правило перехода"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Название правила</Label>
              <Input
                placeholder="Например: Продажи → Юридический отдел"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="rounded-md border p-3 space-y-3 bg-blue-50/50">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Условие (ЕСЛИ)</p>
              <div>
                <Label>Воронка</Label>
                <CustomSelect
                  value={String(form.from_funnel_id || "")}
                  onChange={(v) => setForm({ ...form, from_funnel_id: Number(v), from_stage_id: 0 })}
                  placeholder="Выберите воронку"
                  options={funnelOptions}
                />
              </div>
              <div>
                <Label>Достигает этапа</Label>
                <CustomSelect
                  value={String(form.from_stage_id || "")}
                  onChange={(v) => setForm({ ...form, from_stage_id: Number(v) })}
                  placeholder={form.from_funnel_id ? "Выберите этап" : "Сначала выберите воронку"}
                  options={stageOptions(form.from_funnel_id)}
                />
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-3 bg-green-50/50">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Действие (ТО)</p>
              <div>
                <Label>Перенести в воронку</Label>
                <CustomSelect
                  value={String(form.to_funnel_id || "")}
                  onChange={(v) => setForm({ ...form, to_funnel_id: Number(v), to_stage_id: 0 })}
                  placeholder="Выберите воронку"
                  options={funnelOptions}
                />
              </div>
              <div>
                <Label>На этап</Label>
                <CustomSelect
                  value={String(form.to_stage_id || "")}
                  onChange={(v) => setForm({ ...form, to_stage_id: Number(v) })}
                  placeholder={form.to_funnel_id ? "Выберите этап" : "Сначала выберите воронку"}
                  options={stageOptions(form.to_funnel_id)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active ?? true}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="is_active">Правило активно</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить правило?</AlertDialogTitle>
            <AlertDialogDescription>
              Правило «{deleteTarget?.name || `#${deleteTarget?.id}`}» будет удалено безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
