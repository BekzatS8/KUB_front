"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Edit, Plus, RefreshCw, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import * as FunnelsAPI from "@/src/api/funnels.api"
import { getMyPermissions } from "@/src/api/permissions.api"
import type { Funnel, UpsertFunnelRequest } from "@/src/models/funnels.model"

const emptyForm: UpsertFunnelRequest = {
  name: "",
  code: "",
  department_id: 0,
  branch_id: null,
  is_active: true,
  sort_order: 0,
}

export default function FunnelsPage() {
  const [funnels, setFunnels] = useState<Funnel[]>([])
  const [canManage, setCanManage] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Funnel | null>(null)
  const [form, setForm] = useState<UpsertFunnelRequest>(emptyForm)

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
