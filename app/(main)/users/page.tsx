"use client";

import { useState, useEffect, useMemo } from "react";
import * as Models from "@/src/models/users.model";
import { Roles } from "@/src/models/roles.enum";
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
import { CustomSelect } from "@/components/ui/custom-select";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Search, Plus, Edit, Trash2, Users, UserCheck, Shield, RefreshCw, Eye } from "lucide-react";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { cn } from "@/lib/utils";
import * as UserAPI from "@/src/api/users.api";
import * as RolesAPI from "@/src/api/roles.api";
import * as BranchesAPI from "@/src/api/branches.api";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { PaginationControls } from "@/components/ui/pagination-controls";

const EMPTY_USER: Models.CreateUserRequest = {
  first_name: "",
  last_name: "",
  middle_name: "",
  email: "",
  password: "",
  phone: "",
  role_id: Roles.SALES,
  branch_id: undefined,
  position: "",
  is_active: true,
  is_verified: false,
  // Legacy fields
  company_name: "",
  bin_iin: "",
  notify_tasks_telegram: false,
  telegram_chat_id: undefined,
};

const DetailItem = ({ label, value }: { label: string; value?: string | number | null | boolean }) => (
  <div>
    <p className="text-sm text-gray-500">{label}</p>
    <p className="font-medium">{String(value) || "-"}</p>
  </div>
);

const ROLE_LABELS: Record<number, string> = {
  [Roles.SALES]: "Отдел продаж",
  [Roles.OPERATIONS]: "Операционный отдел",
  [Roles.CONTROL]: "Отдел контроля",
  [Roles.MANAGEMENT]: "Руководство",
  [Roles.SYSTEM_ADMIN]: "Системный администратор",
};

const E164_PHONE_PATTERN = /^\+[1-9]\d{10,14}$/;

const getUserFullName = (user?: Partial<Models.User> | null) => {
  if (!user) return "-";
  const fullName = (
    user.full_name ||
    [user.last_name, user.first_name, user.middle_name]
      .map((part) => (part || "").trim())
      .filter(Boolean)
      .join(" ")
  ).trim();
  return fullName || user.company_name || user.email || "-";
};

const normalizePhoneToE164 = (value?: string) => {
  const raw = (value || "").trim();
  if (E164_PHONE_PATTERN.test(raw)) return raw;

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    return `+7${digits.slice(1)}`;
  }
  if (raw.startsWith("+") && digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }
  return raw;
};

const roleRequiresBranch = (roleId?: number) =>
  roleId === Roles.SALES || roleId === Roles.OPERATIONS || roleId === Roles.CONTROL;

// ComboboxSelect component for searchable dropdowns
function ComboboxSelect({
  value,
  onChange,
  options,
  placeholder = "Выберите...",
  searchPlaceholder = "Поиск...",
  emptyText = "Ничего не найдено",
  disabled = false,
}: {
  value: string | number
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {value
            ? options.find((option) => option.value === String(value))?.label
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [userFormData, setUserFormData] = useState<
    Models.CreateUserRequest | Models.UpdateUserRequest
  >(EMPTY_USER);
  const [editingUser, setEditingUser] = useState<Models.User | null>(null);
  const [userToDelete, setUserToDelete] = useState<Models.User | null>(null);
  const [viewingUser, setViewingUser] = useState<Models.User | null>(null);

  const [users, setUsers] = useState<Models.User[]>([]);
  const [stats, setStats] = useState({ total: 0, admin: 0, manager: 0, user: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [availableRoles, setAvailableRoles] = useState<{ id: number, name: string }[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [availableBranches, setAvailableBranches] = useState<{ id: number, name: string }[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  const { toast } = useToast();
  const currentUser = useMemo(() => getCurrentUser(), []);
  // TODO: Replace with actual permissions
  const canCreate = true; // user && hasPermission(user.role, ["users:write"]);
  const canEdit = true; // user && hasPermission(user.role, ["users:write"]);
  const canDelete = true; // user && hasPermission(user.role, ["users:write"]);

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const currentPage = Number(searchParams.get('page')) || 1;
  const limit = 20;

  const fetchUsersAndStats = async () => {
    setIsLoading(true);
    setError("");
    try {
      const [usersResponse, totalCount, systemAdmin, leadership, sales] = await Promise.all([
        UserAPI.listUsers(currentPage, limit),
        UserAPI.getUsersCount(), // We might use this or response total
        UserAPI.getUsersCountByRole(Roles.SYSTEM_ADMIN),
        UserAPI.getUsersCountByRole(Roles.MANAGEMENT),
        UserAPI.getUsersCountByRole(Roles.SALES),
      ]);

      const usersData = Array.isArray(usersResponse) ? usersResponse : (usersResponse as any).data || [];
      const totalUsers = (usersResponse as any).total || totalCount.count;

      setUsers(usersData);
      setStats({
        total: totalUsers,
        admin: systemAdmin.count,
        manager: leadership.count,
        user: sales.count
      });
    } catch (err: any) {
      const errorMessage = err?.message || "Ошибка при загрузке пользователей";
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

  useEffect(() => {
    void fetchUsersAndStats();
  }, [currentPage]);

  useEffect(() => {
    const fetchRoles = async () => {
      setRolesLoading(true);
      try {
        const res = await RolesAPI.listRoles({ limit: 100 });
        const rolesData = Array.isArray(res) ? res : res.data || [];
        
        // Filter out invalid roles and only keep valid ones
        const validRoles = rolesData.filter(role => {
          const roleId = Number(role.id);
          return [10, 20, 30, 40, 50].includes(roleId); // Only valid role IDs
        });
        
        console.log('Filtered roles:', validRoles);
        setAvailableRoles(validRoles);
      } catch (e) {
        console.error("Failed to load roles", e);
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Не удалось загрузить список ролей",
        });
      } finally {
        setRolesLoading(false);
      }
    };
    fetchRoles();
  }, []);

  useEffect(() => {
    const fetchBranches = async () => {
      setBranchesLoading(true);
      try {
        const res = await BranchesAPI.listBranches();
        const branchesData = Array.isArray(res) ? res : (res as any)?.data || [];
        setAvailableBranches(branchesData.map((b: any) => ({ id: b.id, name: b.name })));
      } catch (e) {
        console.error("Failed to load branches", e);
      } finally {
        setBranchesLoading(false);
      }
    };
    fetchBranches();
  }, []);

  const getRoleLabel = (id?: number) => {
    if (!id) return "-";
    return ROLE_LABELS[id] || "Неизвестная роль";
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;
    setUserFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSwitchChange = (id: keyof Models.UpdateUserRequest, checked: boolean) => {
    setUserFormData((prev) => ({ ...prev, [id]: checked }));
  }

  const handleRoleChange = (value: string) => {
    setUserFormData((prev) => ({ ...prev, role_id: Number(value) }));
  };

  const handleCreateClick = () => {
    setEditingUser(null);
    setUserFormData(EMPTY_USER);
    setIsFormOpen(true);
  };

  const handleEditClick = (user: Models.User) => {
    setEditingUser(user);
    setUserFormData({
      first_name: user.first_name,
      last_name: user.last_name,
      middle_name: user.middle_name,
      email: user.email,
      phone: user.phone,
      role_id: user.role?.id,
      branch_id: user.branch?.id,
      position: user.position,
      is_verified: user.is_verified,
      is_active: user.is_active,
      // Legacy fields
      company_name: user.company_name,
      bin_iin: user.bin_iin,
      notify_tasks_telegram: user.telegram?.notify_tasks,
      telegram_chat_id: user.telegram?.chat_id,
    });
    setIsFormOpen(true);
  };

  const handleViewClick = async (user: Models.User) => {
    setIsLoading(true);
    try {
      const fullUserData = await UserAPI.getUserById(String(user.id));
      setViewingUser(fullUserData);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: err?.message || "Не удалось загрузить информацию о пользователе.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const handleDeleteClick = (user: Models.User) => {
    setUserToDelete(user);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      await UserAPI.deleteUser(String(userToDelete.id));
      toast({ title: "Успех", description: "Пользователь успешно удален." });
      void fetchUsersAndStats();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: err?.message || "Не удалось удалить пользователя.",
      });
    } finally {
      setUserToDelete(null);
    }
  };

  const validateUserForm = (): {
    payload?: Models.CreateUserRequest | Models.UpdateUserRequest;
    error?: string;
  } => {
    const firstName = String((userFormData as any).first_name || "").trim();
    const lastName = String((userFormData as any).last_name || "").trim();
    const middleName = String((userFormData as any).middle_name || "").trim();
    const email = String((userFormData as any).email || "").trim();
    const phone = normalizePhoneToE164((userFormData as any).phone);
    const roleId = Number((userFormData as any).role_id || 0);
    const branchId = (userFormData as any).branch_id ? Number((userFormData as any).branch_id) : undefined;

    if (!lastName) return { error: "Укажите фамилию." };
    if (!firstName) return { error: "Укажите имя." };
    if (!middleName) return { error: "Укажите отчество." };
    if (!email) return { error: "Укажите email." };
    if (!phone) return { error: "Укажите телефон." };
    if (!E164_PHONE_PATTERN.test(phone)) {
      return { error: "Телефон должен быть в международном формате: +77001234567." };
    }
    if (!roleId) return { error: "Выберите роль." };
    if (roleRequiresBranch(roleId) && !branchId) {
      return { error: "Выберите филиал для этой роли." };
    }
    if (!editingUser && !String((userFormData as Models.CreateUserRequest).password || "").trim()) {
      return { error: "Укажите пароль." };
    }

    return {
      payload: {
        ...userFormData,
        first_name: firstName,
        last_name: lastName,
        middle_name: middleName,
        email,
        phone,
        role_id: roleId,
        branch_id: branchId,
        position: String((userFormData as any).position || "").trim(),
      },
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { payload, error: validationError } = validateUserForm();
    if (!payload) {
      toast({
        variant: "destructive",
        title: "Проверьте данные",
        description: validationError || "Заполните обязательные поля.",
      });
      return;
    }

    try {
      if (editingUser) {
        await UserAPI.updateUser(String(editingUser.id), payload as Models.UpdateUserRequest);
        toast({ title: "Успех", description: "Пользователь успешно обновлен." });
      } else {
        const createPayload = { ...payload } as Models.CreateUserRequest;
        // Auto-verify if created by Leadership or System Admin only
        if (currentUser?.role?.id === Roles.MANAGEMENT || currentUser?.role?.id === Roles.SYSTEM_ADMIN) {
          createPayload.is_verified = true;
        }
        await UserAPI.createUser(createPayload);
        toast({ title: "Успех", description: "Пользователь успешно создан." });
      }
      void fetchUsersAndStats();
      setIsFormOpen(false);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: err?.response?.data?.message || err?.message || "Не удалось сохранить пользователя.",
      });
    }
  };

  const filteredUsers = users.filter((user) => {
    const query = searchTerm.trim().toLowerCase();
    const searchableText = [
      getUserFullName(user),
      user.email,
      user.phone,
      user.position,
      user.branch?.name,
      getRoleLabel(user.role?.id),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(query);
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 m-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            Пользователи
          </h1>
          <p className="text-sm text-gray-600">
            Управление пользователями системы
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={fetchUsersAndStats} variant="outline" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
          {canCreate && (
            <Button onClick={handleCreateClick}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить пользователя
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 px-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Администраторы</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.admin}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Менеджеры</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.manager}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Пользователи</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.user}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Список пользователей</CardTitle>
              <CardDescription>
                {users?.length ? `Найдено ${filteredUsers?.length || 0} из ${users.length} пользователей` : "Пользователи не найдены"}
              </CardDescription>
            </div>
            <div className="w-1/3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Введите данные для поиска..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Фамилия, Имя, Отчество</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (!users || users.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Spinner />
                    </TableCell>
                  </TableRow>
                ) : (!filteredUsers || filteredUsers.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Пользователи не найдены.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{getUserFullName(user)}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phone}</TableCell>
                      <TableCell>{getRoleLabel(user.role?.id)}</TableCell>
                      <TableCell>
                        <Badge variant={user.is_verified ? "default" : "outline"}>
                          {user.is_verified ? "Подтвержден" : "Не подтвержден"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Просмотр"
                            onClick={() => handleViewClick(user)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Редактировать"
                              onClick={() => handleEditClick(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Удалить"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteClick(user)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {stats.total > limit && (
          <div className="pb-4">
            <PaginationControls
              currentPage={currentPage}
              totalPages={Math.ceil(stats.total / limit)}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </Card >

      {/* Create/Edit Dialog */}
      < Dialog open={isFormOpen} onOpenChange={setIsFormOpen} >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Редактировать пользователя" : "Создать пользователя"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Personal Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="last_name">Фамилия</Label>
                  <Input id="last_name" placeholder="Фамилия..." value={(userFormData as any).last_name || ''} onChange={handleFormChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="first_name">Имя</Label>
                  <Input id="first_name" placeholder="Имя..." value={(userFormData as any).first_name || ''} onChange={handleFormChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middle_name">Отчество</Label>
                  <Input id="middle_name" placeholder="Отчество..." value={(userFormData as any).middle_name || ''} onChange={handleFormChange} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Должность</Label>
                <Input id="position" placeholder="Должность..." value={(userFormData as any).position || ''} onChange={handleFormChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="Введите Email..." value={userFormData.email} onChange={handleFormChange} required />
              </div>
              {!editingUser && (
                <div className="space-y-2">
                  <Label htmlFor="password">Пароль</Label>
                  <Input id="password" type="password" placeholder="Введите пароль..." value={(userFormData as Models.CreateUserRequest).password} onChange={handleFormChange} required={!editingUser} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="+77001234567"
                  pattern="\+[1-9][0-9]{10,14}"
                  title="Телефон в международном формате, например +77001234567"
                  value={userFormData.phone}
                  onChange={handleFormChange}
                  required
                />
                <p className="text-xs text-muted-foreground">Формат: +77001234567</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role_id">Роль</Label>
                <CustomSelect
                  value={String(userFormData.role_id)}
                  onChange={handleRoleChange}
                  placeholder={rolesLoading ? "Загрузка ролей..." : "Выберите роль..."}
                  disabled={rolesLoading}
                  options={availableRoles.map(role => ({
                    value: String(role.id),
                    label: getRoleLabel(Number(role.id))
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch_id">Филиал</Label>
                <ComboboxSelect
                  value={userFormData.branch_id ? String(userFormData.branch_id) : ""}
                  onChange={(value) => setUserFormData(prev => ({ ...prev, branch_id: value ? Number(value) : undefined }))}
                  placeholder={branchesLoading ? "Загрузка филиалов..." : "Выберите филиал..."}
                  searchPlaceholder="Поиск филиала..."
                  emptyText="Филиал не найден"
                  disabled={branchesLoading}
                  options={availableBranches.map(branch => ({
                    value: String(branch.id),
                    label: branch.name
                  }))}
                />
              </div>

              {/* Verification Switch: Visible for editing, or for Leadership/System Admin when creating (disabled/checked) */}
              {(editingUser || currentUser?.role?.id === Roles.MANAGEMENT || currentUser?.role?.id === Roles.SYSTEM_ADMIN) && (
                <div className="flex items-center space-x-2">
                  <Label htmlFor="is_verified" className="cursor-pointer">Верифицирован</Label>
                  <Switch
                    id="is_verified"
                    checked={
                      editingUser
                        ? (userFormData as Models.UpdateUserRequest).is_verified
                        : (currentUser?.role?.id === Roles.MANAGEMENT || currentUser?.role?.id === Roles.SYSTEM_ADMIN) // Auto-checked for Leadership/System Admin on creation
                    }
                    disabled={!editingUser && (currentUser?.role?.id === Roles.MANAGEMENT || currentUser?.role?.id === Roles.SYSTEM_ADMIN)} // Disabled on creation for Leadership
                    onCheckedChange={(c) => handleSwitchChange('is_verified', c)}
                  />
                </div>
              )}

              {editingUser && (
                <>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="notify_tasks_telegram" className="cursor-pointer">Уведомления в Telegram</Label>
                    <Switch id="notify_tasks_telegram" checked={(userFormData as Models.UpdateUserRequest).notify_tasks_telegram} onCheckedChange={(c) => handleSwitchChange('notify_tasks_telegram', c)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telegram_chat_id">Telegram Chat ID</Label>
                    <Input id="telegram_chat_id" placeholder="Введите Telegram Chat ID..." value={(userFormData as Models.UpdateUserRequest).telegram_chat_id || ''} onChange={handleFormChange} />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Отмена</Button>
              <Button type="submit">Сохранить</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog >

      {/* Delete Confirmation Dialog */}
      < AlertDialog open={!!userToDelete
      } onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить пользователя "{getUserFullName(userToDelete)}"? Это действие нельзя будет отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog >

      {/* View User Details Dialog */}
      < Dialog open={!!viewingUser} onOpenChange={() => setViewingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Детали пользователя</DialogTitle>
            <DialogDescription>{getUserFullName(viewingUser)}</DialogDescription>
          </DialogHeader>
          {isLoading ? <Spinner /> : (
            <div className="grid grid-cols-2 gap-4 py-4">
              <DetailItem label="ID" value={viewingUser?.id} />
              <DetailItem label="ФИО" value={viewingUser?.full_name} />
              <DetailItem label="Роль" value={getRoleLabel(viewingUser?.role?.id)} />
              <DetailItem label="Email" value={viewingUser?.email} />
              <DetailItem label="Телефон" value={viewingUser?.phone} />
              <DetailItem label="Должность" value={viewingUser?.position} />
              <DetailItem label="Филиал" value={viewingUser?.branch?.name} />
              <DetailItem label="БИН/ИИН" value={viewingUser?.bin_iin} />
              <DetailItem label="Верифицирован" value={viewingUser?.is_verified ? 'Да' : 'Нет'} />
              <DetailItem label="Активен" value={viewingUser?.is_active ? 'Да' : 'Нет'} />
              <DetailItem label="Уведомления в TG" value={viewingUser?.telegram?.notify_tasks ? 'Да' : 'Нет'} />
              <DetailItem label="TG Chat ID" value={viewingUser?.telegram?.chat_id} />
              <DetailItem label="Дата создания" value={viewingUser?.created_at ? new Date(viewingUser.created_at).toLocaleString() : '-'} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingUser(null)}>Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >
    </>
  );
}
