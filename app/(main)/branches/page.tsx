"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Plus, Edit, Trash2, Building2 } from "lucide-react"
import * as BranchesAPI from "@/src/api/branches.api"
import type { Branch } from "@/src/models/branches.model"

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  
  const [createForm, setCreateForm] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
    email: "",
    is_active: true
  })

  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
    email: "",
    is_active: true
  })

  const fetchBranches = async () => {
    setIsLoading(true)
    try {
      const res = await BranchesAPI.listBranches()
      const data = Array.isArray(res) ? res : (res as any)?.data || []
      setBranches(data)
    } catch (err: any) {
      console.error("Error loading branches:", err)
      toast.error("Ошибка при загрузке филиалов")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBranches()
  }, [])

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.code.trim()) {
      toast.error("Заполните все обязательные поля")
      return
    }
    
    try {
      await BranchesAPI.createBranch(createForm)
      toast.success("Филиал успешно создан")
      setIsCreateDialogOpen(false)
      setCreateForm({ name: "", code: "", address: "", phone: "", email: "", is_active: true })
      fetchBranches()
    } catch (err: any) {
      console.error("Error creating branch:", err)
      toast.error(err?.response?.data?.message || "Ошибка при создании филиала")
    }
  }

  const handleUpdate = async () => {
    if (!selectedBranch) return
    if (!editForm.name.trim() || !editForm.code.trim()) {
      toast.error("Заполните все обязательные поля")
      return
    }
    
    try {
      await BranchesAPI.updateBranch(editForm, { id: selectedBranch.id })
      toast.success("Филиал успешно обновлен")
      setIsEditDialogOpen(false)
      setSelectedBranch(null)
      fetchBranches()
    } catch (err: any) {
      console.error("Error updating branch:", err)
      toast.error(err?.response?.data?.message || "Ошибка при обновлении филиала")
    }
  }

  const handleDelete = async () => {
    if (!selectedBranch) return
    
    try {
      await BranchesAPI.deleteBranch({ id: selectedBranch.id })
      toast.success("Филиал успешно удален")
      setIsDeleteDialogOpen(false)
      setSelectedBranch(null)
      fetchBranches()
    } catch (err: any) {
      console.error("Error deleting branch:", err)
      toast.error(err?.response?.data?.message || "Ошибка при удалении филиала")
    }
  }

  const openEditDialog = (branch: Branch) => {
    setSelectedBranch(branch)
    setEditForm({
      name: branch.name,
      code: branch.code,
      address: branch.address ?? "",
      phone: branch.phone ?? "",
      email: branch.email ?? "",
      is_active: branch.is_active
    })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (branch: Branch) => {
    setSelectedBranch(branch)
    setIsDeleteDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className="m-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-4 w-64 bg-gray-200 rounded" />
          <div className="h-96 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between m-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Филиалы
          </h1>
          <p className="text-gray-600">
            Офисы и представительства организации
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Новый филиал
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Создать новый филиал</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Название</Label>
                <Input
                  id="name"
                  placeholder="Введите название филиала..."
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Код</Label>
                <Input
                  id="code"
                  placeholder="Введите код филиала..."
                  value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Адрес</Label>
                <Input
                  id="address"
                  placeholder="г. Алматы, ул. ..."
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  placeholder="+7 (700) 000-00-00"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="branch@company.kz"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={createForm.is_active}
                  onChange={(e) => setCreateForm({ ...createForm, is_active: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="is_active" className="cursor-pointer">Активен</Label>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Отмена</Button>
              <Button onClick={handleCreate}>Создать</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mx-6 mb-6">
        <CardHeader>
          <CardTitle>Список филиалов</CardTitle>
          <CardDescription>
            {branches.length} филиал{branches.length !== 1 ? 'ов' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <Table className="w-full min-w-[760px] table-fixed">
              <colgroup>
                <col className="w-[6%]" />
                <col className="w-[24%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">ID</TableHead>
                  <TableHead className="px-4">Название</TableHead>
                  <TableHead className="px-4">Код</TableHead>
                  <TableHead className="px-4">Адрес</TableHead>
                  <TableHead className="px-4">Телефон / Email</TableHead>
                  <TableHead className="px-4">Статус</TableHead>
                  <TableHead className="px-4 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="px-4 align-top font-mono text-sm">{branch.id}</TableCell>
                    <TableCell className="px-4 align-top">
                      <div className="flex min-w-0 items-center gap-2">
                        <Building2 className="h-4 w-4 shrink-0 text-gray-500" />
                        <span className="break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                          {branch.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 align-top break-words">{branch.code}</TableCell>
                    <TableCell className="px-4 align-top text-sm text-gray-600">{branch.address || "—"}</TableCell>
                    <TableCell className="px-4 align-top text-sm text-gray-600">
                      {branch.phone && <div>{branch.phone}</div>}
                      {branch.email && <div>{branch.email}</div>}
                      {!branch.phone && !branch.email && "—"}
                    </TableCell>
                    <TableCell className="px-4 align-top">
                      <Badge variant={branch.is_active ? "default" : "secondary"}>
                        {branch.is_active ? "Активен" : "Неактивен"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 align-top text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(branch)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openDeleteDialog(branch)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {branches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500">
                      Нет филиалов
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать филиал</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Название</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-code">Код</Label>
              <Input
                id="edit-code"
                value={editForm.code}
                onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Адрес</Label>
              <Input
                id="edit-address"
                placeholder="г. Алматы, ул. ..."
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Телефон</Label>
              <Input
                id="edit-phone"
                placeholder="+7 (700) 000-00-00"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="branch@company.kz"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-is_active"
                checked={editForm.is_active}
                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="edit-is_active" className="cursor-pointer">Активен</Label>
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleUpdate}>Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить филиал?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Филиал "{selectedBranch?.name}" будет удален.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
