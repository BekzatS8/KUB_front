"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Copy, Edit, Plus, RefreshCw, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import * as FunnelsAPI from "@/src/api/funnels.api"
import * as FunnelStagesAPI from "@/src/api/funnel-stages.api"
import { getMyPermissions } from "@/src/api/permissions.api"
import type { Funnel, UpsertFunnelRequest } from "@/src/models/funnels.model"
import type { FunnelStage, FunnelStageType, UpsertFunnelStageRequest } from "@/src/models/funnel-stages.model"

const emptyForm: UpsertFunnelRequest = {
  name: "",
  code: "",
  department_id: 0,
  branch_id: null,
  is_active: true,
  sort_order: 0,
}

const STAGE_TYPE_LABELS: Record<FunnelStageType, string> = {
  regular: "Обычный",
  won: "Успех",
  lost: "Неуспех",
}

const emptyStageForm: UpsertFunnelStageRequest = {
  name: "",
  code: "",
  color: "#94a3b8",
  type: "regular",
  probability: 0,
  description: "",
  is_active: true,
  auto_archive: false,
}

export default function FunnelsPage() {
  const [funnels, setFunnels] = useState<Funnel[]>([])
  const [canManage, setCanManage] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Funnel | null>(null)
  const [form, setForm] = useState<UpsertFunnelRequest>(emptyForm)

  const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null)
  const [stages, setStages] = useState<FunnelStage[]>([])
  const [stagesLoading, setStagesLoading] = useState(false)
  const [isStageDialogOpen, setIsStageDialogOpen] = useState(false)
  const [editingStage, setEditingStage] = useState<FunnelStage | null>(null)
  const [stageForm, setStageForm] = useState<UpsertFunnelStageRequest>(emptyStageForm)
  const [reassignDialog, setReassignDialog] = useState<{ stage: FunnelStage; targetId: number } | null>(null)

  const departments = useMemo(() => {
    const map = new Map<number, { id: number; name: string; code: string }>()
    funnels.forEach((funnel) => {
      if (funnel.department) {
        map.set(funnel.department.id, {
          id: funnel.department.id,
          name: funnel.department.name,
          code: funnel.department.code,
        })
      }
    })
    return Array.from(map.values())
  }, [funnels])

  async function load() {
    setIsLoading(true)
    try {
      const [permissionData, funnelData] = await Promise.all([
        getMyPermissions(),
        FunnelsAPI.listFunnels(),
      ])
      setCanManage(Boolean(permissionData.scopes["funnels.create"]))
      setFunnels(Array.isArray(funnelData) ? funnelData : [])
    } catch (error: any) {
      toast.error(error?.message || "Не удалось загрузить воронки")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm({
      ...emptyForm,
      department_id: departments[0]?.id || 0,
    })
    setIsDialogOpen(true)
  }

  function openEdit(funnel: Funnel) {
    setEditing(funnel)
    setForm({
      name: funnel.name,
      code: funnel.code,
      department_id: funnel.department_id,
      branch_id: funnel.branch_id || null,
      is_active: funnel.is_active,
      sort_order: funnel.sort_order,
    })
    setIsDialogOpen(true)
  }

  async function save() {
    if (!form.name.trim() || !form.code.trim() || !form.department_id) {
      toast.error("Заполните название, код и отдел")
      return
    }

    try {
      if (editing) {
        await FunnelsAPI.updateFunnel(editing.id, form)
        toast.success("Воронка обновлена")
      } else {
        await FunnelsAPI.createFunnel(form)
        toast.success("Воронка создана")
      }
      setIsDialogOpen(false)
      await load()
    } catch (error: any) {
      toast.error(error?.message || "Не удалось сохранить воронку")
    }
  }

  async function remove(funnel: Funnel) {
    if (!window.confirm(`Удалить воронку "${funnel.name}"?`)) return
    try {
      await FunnelsAPI.deleteFunnel(funnel.id)
      toast.success("Воронка удалена")
      await load()
    } catch (error: any) {
      toast.error(error?.message || "Не удалось удалить воронку")
    }
  }

  async function reorder() {
    try {
      await FunnelsAPI.reorderFunnels(funnels.map((funnel) => funnel.id))
      toast.success("Порядок сохранен")
      await load()
    } catch (error: any) {
      toast.error(error?.message || "Не удалось сохранить порядок")
    }
  }

  async function loadStages(funnelId: number) {
    setStagesLoading(true)
    try {
      const data = await FunnelStagesAPI.listFunnelStages(funnelId)
      setStages(Array.isArray(data) ? data : [])
    } catch (error: any) {
      toast.error(error?.message || "Не удалось загрузить этапы")
    } finally {
      setStagesLoading(false)
    }
  }

  useEffect(() => {
    if (selectedFunnelId) {
      loadStages(selectedFunnelId)
    } else {
      setStages([])
    }
  }, [selectedFunnelId])

  useEffect(() => {
    if (!selectedFunnelId && funnels.length > 0) {
      setSelectedFunnelId(funnels[0].id)
    }
  }, [funnels, selectedFunnelId])

  function openCreateStage() {
    if (!selectedFunnelId) return
    setEditingStage(null)
    setStageForm(emptyStageForm)
    setIsStageDialogOpen(true)
  }

  function openEditStage(stage: FunnelStage) {
    setEditingStage(stage)
    setStageForm({
      name: stage.name,
      code: stage.code,
      color: stage.color,
      type: stage.type,
      probability: stage.probability,
      description: stage.description || "",
      is_active: stage.is_active,
      auto_archive: stage.auto_archive ?? false,
    })
    setIsStageDialogOpen(true)
  }

  async function saveStage() {
    if (!selectedFunnelId) return
    if (!stageForm.name.trim() || !stageForm.code.trim()) {
      toast.error("Заполните название и код этапа")
      return
    }
    try {
      if (editingStage) {
        await FunnelStagesAPI.updateFunnelStage(editingStage.id, stageForm)
        toast.success("Этап обновлен")
      } else {
        await FunnelStagesAPI.createFunnelStage(selectedFunnelId, stageForm)
        toast.success("Этап создан")
      }
      setIsStageDialogOpen(false)
      await loadStages(selectedFunnelId)
    } catch (error: any) {
      toast.error(error?.message || "Не удалось сохранить этап")
    }
  }

  async function removeStage(stage: FunnelStage, reassignToStageId?: number) {
    if (!selectedFunnelId) return
    try {
      await FunnelStagesAPI.deleteFunnelStage(stage.id, reassignToStageId)
      toast.success("Этап удален")
      setReassignDialog(null)
      await loadStages(selectedFunnelId)
    } catch (error: any) {
      if (error?.response?.status === 409) {
        const fallback = stages.find((s) => s.id !== stage.id)
        if (fallback) {
          setReassignDialog({ stage, targetId: fallback.id })
          return
        }
      }
      toast.error(error?.message || "Не удалось удалить этап")
    }
  }

  function confirmRemoveStage(stage: FunnelStage) {
    if (!window.confirm(`Удалить этап "${stage.name}"?`)) return
    removeStage(stage)
  }

  async function duplicateStage(stage: FunnelStage) {
    if (!selectedFunnelId) return
    try {
      await FunnelStagesAPI.duplicateFunnelStage(stage.id)
      toast.success("Этап скопирован")
      await loadStages(selectedFunnelId)
    } catch (error: any) {
      toast.error(error?.message || "Не удалось скопировать этап")
    }
  }

  async function moveStage(stage: FunnelStage, direction: -1 | 1) {
    if (!selectedFunnelId) return
    const index = stages.findIndex((s) => s.id === stage.id)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= stages.length) return
    const reordered = [...stages]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    setStages(reordered)
    try {
      await FunnelStagesAPI.reorderFunnelStages(selectedFunnelId, reordered.map((s) => s.id))
    } catch (error: any) {
      toast.error(error?.message || "Не удалось сохранить порядок этапов")
      await loadStages(selectedFunnelId)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Воронки</h1>
          <p className="text-slate-600">Управление CRM-воронками по отделам и филиалам</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Обновить
          </Button>
          {canManage && (
            <>
              <Button variant="outline" onClick={reorder} disabled={funnels.length === 0}>
                Сохранить порядок
              </Button>
              <Button onClick={openCreate} disabled={departments.length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                Создать воронку
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список воронок</CardTitle>
          <CardDescription>{funnels.length} записей</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Код</TableHead>
                <TableHead>Отдел</TableHead>
                <TableHead>Филиал</TableHead>
                <TableHead>Порядок</TableHead>
                <TableHead>Статус</TableHead>
                {canManage && <TableHead className="text-right">Действия</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {funnels.map((funnel) => (
                <TableRow key={funnel.id}>
                  <TableCell className="font-medium">{funnel.name}</TableCell>
                  <TableCell className="font-mono text-xs">{funnel.code}</TableCell>
                  <TableCell>{funnel.department?.name || funnel.department_id}</TableCell>
                  <TableCell>{funnel.branch?.name || "Все филиалы"}</TableCell>
                  <TableCell>{funnel.sort_order}</TableCell>
                  <TableCell>
                    <Badge variant={funnel.is_active ? "default" : "secondary"}>
                      {funnel.is_active ? "Активна" : "Выключена"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(funnel)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(funnel)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!isLoading && funnels.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 7 : 6} className="text-center text-slate-500">
                    Воронок пока нет
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Этапы воронки</CardTitle>
              <CardDescription>Настройка стадий канбана: цвет, тип, вероятность</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedFunnelId ?? ""}
                onChange={(event) => setSelectedFunnelId(Number(event.target.value) || null)}
              >
                {funnels.length === 0 && <option value="">Нет воронок</option>}
                {funnels.map((funnel) => (
                  <option key={funnel.id} value={funnel.id}>
                    {funnel.name}
                  </option>
                ))}
              </select>
              {canManage && (
                <Button onClick={openCreateStage} disabled={!selectedFunnelId}>
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить этап
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Название</TableHead>
                <TableHead>Код</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Вероятность</TableHead>
                <TableHead>Статус</TableHead>
                {canManage && <TableHead className="text-right">Действия</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {stages.map((stage, index) => (
                <TableRow key={stage.id}>
                  <TableCell>
                    <span
                      className="inline-block h-4 w-4 rounded-full border"
                      style={{ backgroundColor: stage.color }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{stage.name}</TableCell>
                  <TableCell className="font-mono text-xs">{stage.code}</TableCell>
                  <TableCell>
                    <Badge variant={stage.type === "won" ? "default" : stage.type === "lost" ? "destructive" : "secondary"}>
                      {STAGE_TYPE_LABELS[stage.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>{stage.probability}%</TableCell>
                  <TableCell>
                    <Badge variant={stage.is_active ? "default" : "secondary"}>
                      {stage.is_active ? "Активен" : "Выключен"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveStage(stage, -1)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveStage(stage, 1)}
                          disabled={index === stages.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => duplicateStage(stage)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditStage(stage)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => confirmRemoveStage(stage)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!stagesLoading && stages.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 7 : 6} className="text-center text-slate-500">
                    {selectedFunnelId ? "Этапов пока нет" : "Выберите воронку"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isStageDialogOpen} onOpenChange={setIsStageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStage ? "Редактировать этап" : "Создать этап"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stage_name">Название</Label>
              <Input
                id="stage_name"
                value={stageForm.name}
                onChange={(event) => setStageForm({ ...stageForm, name: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage_code">Код</Label>
              <Input
                id="stage_code"
                value={stageForm.code}
                onChange={(event) => setStageForm({ ...stageForm, code: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stage_color">Цвет</Label>
                <Input
                  id="stage_color"
                  type="color"
                  className="h-10 w-full p-1"
                  value={stageForm.color || "#94a3b8"}
                  onChange={(event) => setStageForm({ ...stageForm, color: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stage_type">Тип</Label>
                <select
                  id="stage_type"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={stageForm.type || "regular"}
                  onChange={(event) => setStageForm({ ...stageForm, type: event.target.value as FunnelStageType })}
                >
                  {Object.entries(STAGE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage_probability">Вероятность (%)</Label>
              <Input
                id="stage_probability"
                type="number"
                min={0}
                max={100}
                value={stageForm.probability ?? 0}
                onChange={(event) => setStageForm({ ...stageForm, probability: Number(event.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage_description">Описание</Label>
              <Textarea
                id="stage_description"
                value={stageForm.description || ""}
                onChange={(event) => setStageForm({ ...stageForm, description: event.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="stage_is_active">Активен</Label>
              <Switch
                id="stage_is_active"
                checked={Boolean(stageForm.is_active)}
                onCheckedChange={(checked) => setStageForm({ ...stageForm, is_active: checked })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="pr-3">
                <Label htmlFor="stage_auto_archive">Отправлять в архив</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  При переходе карточки на этот этап она автоматически уходит в архив.
                </p>
              </div>
              <Switch
                id="stage_auto_archive"
                checked={Boolean(stageForm.auto_archive)}
                onCheckedChange={(checked) => setStageForm({ ...stageForm, auto_archive: checked })}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsStageDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={saveStage}>Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reassignDialog} onOpenChange={(open) => !open && setReassignDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Перенести сделки на другой этап</DialogTitle>
          </DialogHeader>
          {reassignDialog && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                На этапе &quot;{reassignDialog.stage.name}&quot; есть сделки. Выберите этап, на который их перенести перед удалением.
              </p>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={reassignDialog.targetId}
                onChange={(event) =>
                  setReassignDialog({ ...reassignDialog, targetId: Number(event.target.value) })
                }
              >
                {stages
                  .filter((s) => s.id !== reassignDialog.stage.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setReassignDialog(null)}>
                  Отмена
                </Button>
                <Button onClick={() => removeStage(reassignDialog.stage, reassignDialog.targetId)}>
                  Перенести и удалить
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать воронку" : "Создать воронку"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название</Label>
              <Input id="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Код</Label>
              <Input id="code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Отдел</Label>
              <select
                id="department"
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.department_id}
                onChange={(event) => setForm({ ...form, department_id: Number(event.target.value) })}
              >
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort_order">Порядок</Label>
              <Input
                id="sort_order"
                type="number"
                value={form.sort_order || 0}
                onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="is_active">Активна</Label>
              <Switch
                id="is_active"
                checked={Boolean(form.is_active)}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={save}>Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
