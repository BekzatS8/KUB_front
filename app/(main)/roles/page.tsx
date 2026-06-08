"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PaginationControls } from "@/components/ui/pagination-controls";
import * as Models from "@/src/models/roles.model";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Users, RefreshCw } from "lucide-react";
import * as RoleAPI from "@/src/api/roles.api";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";

const EMPTY_ROLE: Models.CreateRoleRequest = {
  name: "",
  description: "",
};

export default function RolesPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [roleFormData, setRoleFormData] =
    useState<Models.CreateRoleRequest>(EMPTY_ROLE);
  const [editingRole, setEditingRole] = useState<Models.RoleWithUserCount | null>(
    null
  );
  const [roleToDelete, setRoleToDelete] = useState<Models.RoleWithUserCount | null>(null);

  const [roles, setRoles] = useState<Models.RoleWithUserCount[]>([]);
  const [totalRoles, setTotalRoles] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const currentPage = Number(searchParams.get('page')) || 1;
  const limit = 20;

  const { toast } = useToast();

  const fetchRoles = async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = { page: currentPage, limit };
      const res = await RoleAPI.listRolesWithUserCounts(params);
      const data = Array.isArray(res) ? res : (res as any)?.data || [];
      const total = (res as any)?.total || data.length;

      setRoles(Array.isArray(data) ? data : []);
      setTotalRoles(total);
    } catch (err: any) {
      const errorMessage = err?.message || "Ошибка при загрузке ролей";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    fetchRoles();
  }, [currentPage]);

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;
    setRoleFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleCreateClick = () => {
    setEditingRole(null);
    setRoleFormData(EMPTY_ROLE);
    setIsFormOpen(true);
  };

  const handleEditClick = (role: Models.RoleWithUserCount) => {
    setEditingRole(role);
    setRoleFormData({
      name: role.name,
      description: role.description,
    });
    setIsFormOpen(true);
  };

  const handleDeleteClick = (role: Models.RoleWithUserCount) => {
    setRoleToDelete(role);
  };

  const handleDeleteConfirm = async () => {
    if (!roleToDelete) return;
    try {
      await RoleAPI.deleteRole(roleToDelete.id);
      toast({ title: "Успех", description: "Роль успешно удалена." });
      void fetchRoles();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: err?.message || "Не удалось удалить роль.",
      });
    } finally {
      setRoleToDelete(null);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingRole) {
        await RoleAPI.updateRole(editingRole.id, roleFormData);
        toast({ title: "Успех", description: "Роль успешно обновлена." });
      } else {
        await RoleAPI.createRole(roleFormData);
        toast({ title: "Успех", description: "Роль успешно создана." });
      }
      void fetchRoles();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: err?.message || "Не удалось сохранить роль.",
      });
    } finally {
      setIsFormOpen(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 m-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            Управление ролями
          </h1>
          <p className="text-sm text-gray-600">
            Создание и редактирование ролей пользователей
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={fetchRoles} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
          <Button onClick={handleCreateClick}>
            <Plus className="h-4 w-4 mr-2" />
            Создать роль
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список ролей</CardTitle>
          <CardDescription>
            {roles?.length ? `Всего ролей: ${totalRoles}` : "Роли не найдены"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <Table className="w-full table-fixed">
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[24%]" />
                <col className="w-[40%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">ID</TableHead>
                  <TableHead className="px-4">Название</TableHead>
                  <TableHead className="px-4">Описание</TableHead>
                  <TableHead className="px-4">Пользователи</TableHead>
                  <TableHead className="px-4 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <Spinner />
                    </TableCell>
                  </TableRow>
                ) : (!roles || roles.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Роли не найдены.
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="px-4 align-top font-mono text-sm">{role.id}</TableCell>
                      <TableCell className="px-4 align-top">
                        <div className="break-words font-medium leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                          {role.name}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 align-top">
                        <div className="break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">
                          {role.description || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 align-top">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-2 text-gray-500" />
                          {role.user_count}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 align-top text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Редактировать"
                            onClick={() => handleEditClick(role)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                            title="Удалить"
                            onClick={() => handleDeleteClick(role)}
                            disabled={role.user_count > 0}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {totalRoles > limit && (
          <div className="pb-4">
            <PaginationControls
              currentPage={currentPage}
              totalPages={Math.ceil(totalRoles / limit)}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? "Редактировать роль" : "Создать роль"}
            </DialogTitle>
            <DialogDescription>
              {editingRole
                ? "Измените данные роли. Нажмите сохранить, когда закончите."
                : "Введите данные для новой роли."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Название</Label>
              <Input
                id="name"
                value={roleFormData.name}
                onChange={handleFormChange}
                placeholder="Введите название роли..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={roleFormData.description}
                onChange={handleFormChange}
                placeholder="Введите описание роли..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSubmit}>
              {editingRole ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!roleToDelete}
        onOpenChange={(open) => !open && setRoleToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы абсолютно уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Роль &quot;{roleToDelete?.name}&quot; будет удалена навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
