"use client";

import { useState, useEffect, useMemo } from "react";
import * as Models from "@/src/models/users.model";
import { Roles, getRoleName } from "@/src/models/roles.enum";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AuthenticatedAvatarImage } from "@/components/authenticated-avatar-image";
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
import { Check, ChevronsUpDown, Search, Plus, Edit, Trash2, Users, UserCheck, Shield, RefreshCw, Eye, KeyRound, Ban, CircleCheck } from "lucide-react";
import { getCurrentUser, getRoleCode } from "@/lib/auth";
import { cn } from "@/lib/utils";
import * as UserAPI from "@/src/api/users.api";
import * as RolesAPI from "@/src/api/roles.api";
import * as BranchesAPI from "@/src/api/branches.api";
import { getMyPermissions } from "@/src/api/permissions.api";
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
  internal_phone: "",
  iin: "",
  address: "",
  extra_info: "",
  role_id: Roles.SALES,
  branch_id: undefined,
  position: "",
  is_active: true,
  is_verified: false,
  // Legacy fields
  company_name: "",
  bin_iin: "",
};

const DetailItem = ({ label, value }: { label: string; value?: string | number | null | boolean }) => (
  <div>
    <p className="text-sm text-gray-500">{label}</p>
    <p className="font-medium">{String(value) || "-"}</p>
  </div>
);


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

const getUserInitials = (user?: Partial<Models.User> | null) => {
  const source = getUserFullName(user);
  if (!source || source === "-") return "U";
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "U") + (parts[1]?.[0] || "");
};

const getAvatarUrl = (user?: Partial<Models.User> | null) =>
  user?.avatar_url || user?.avatar?.url || "";

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
  // по умолчанию показываем только активных: во «Все» попадают ещё и
  // заблокированные с мягко удалёнными, из-за чего список расходился со
  // счётчиками по ролям (они считают активных)
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked" | "deleted">("active");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [userFormData, setUserFormData] = useState<
    Models.CreateUserRequest | Models.UpdateUserRequest
  >(EMPTY_USER);
  const [editingUser, setEditingUser] = useState<Models.User | null>(null);
  const [userToDelete, setUserToDelete] = useState<Models.User | null>(null);
  const [viewingUser, setViewingUser] = useState<Models.User | null>(null);
  const [passwordChangeUser, setPasswordChangeUser] = useState<Models.User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);

  const [users, setUsers] = useState<Models.User[]>([]);
  const [stats, setStats] = useState({ total: 0, admin: 0, manager: 0, user: 0 });
  // счётчики по всем ролям для компактных кликабельных плиток (ТЗ п.7.3)
  const [roleCounts, setRoleCounts] = useState<Record<number, number>>({});
  const [roleFilter, setRoleFilter] = useState<number | null>(null);
  const [branchViewFilter, setBranchViewFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [availableRoles, setAvailableRoles] = useState<{ id: number, name: string }[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [availableBranches, setAvailableBranches] = useState<{ id: number, name: string }[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [permissionScopes, setPermissionScopes] = useState<Record<string, string>>({});

  const { toast } = useToast();
  const currentUser = useMemo(() => getCurrentUser(), []);
  const canCreate = Boolean(permissionScopes["users.create"]);
  const canEdit = Boolean(permissionScopes["users.update"]);
  const canDelete = Boolean(permissionScopes["users.delete"]);
  // Блокировка пользователя выполняется напрямую (без подтверждения админа) —
  // HR/юрист/руководство/админ имеют users.block.
  const canBlock = Boolean(permissionScopes["users.block"]);
  // Смена пароля другого сотрудника доступна только администратору (бэкенд:
  // CanAssignRoles = system_admin). Гейтим по admin-only праву users.move_branch
  // из permissionScopes — тот же надёжный источник, что и users.update (кнопка
  // «редактировать»). Прежний гейт по role.id из localStorage не срабатывал —
  // роль оттуда не резолвилась (обратная связь 31.07.2026). Роль-код оставляем
  // запасным вариантом.
  const canChangePasswordRoleCode = getRoleCode(currentUser);
  const canChangePassword =
    Boolean(permissionScopes["users.move_branch"]) ||
    Boolean(permissionScopes["users.move_department"]) ||
    canChangePasswordRoleCode === "system_admin" ||
    canChangePasswordRoleCode === "admin";
  // HR, юрист и руководство управляют пользователями только через заявку на подтверждение админу
  const userActionsNeedApproval = [Roles.HR, Roles.LEGAL, Roles.MANAGEMENT].includes(currentUser?.role?.id as number);

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const currentPage = Number(searchParams.get('page')) || 1;
  const limit = 20;

  const fetchUsersAndStats = async () => {
    setIsLoading(true);
    setError("");
    try {
      // сервер отдаёт активных по умолчанию; заблокированные/удалённые
      // приходят только по явному статусу (ТЗ п.7.2)
      const usersResponse = await UserAPI.listUsers(currentPage, limit, statusFilter);
      const usersData = Array.isArray(usersResponse) ? usersResponse : (usersResponse as any).data || [];
      const totalFromResponse = (usersResponse as any).total;
      setUsers(usersData);

      // Stats fetched independently — 403 on any stat does not break the user list
      const statRoles = [
        Roles.SYSTEM_ADMIN, Roles.MANAGEMENT, Roles.SALES, Roles.VISA,
        Roles.PARTNER, Roles.HR, Roles.LEGAL, Roles.QUALITY_CONTROL,
      ];
      const [totalResult, ...roleResults] = await Promise.allSettled([
        UserAPI.getUsersCount(),
        ...statRoles.map((r) => UserAPI.getUsersCountByRole(r)),
      ]);

      const counts: Record<number, number> = {};
      statRoles.forEach((r, i) => {
        const res = roleResults[i];
        counts[r] = res.status === "fulfilled" ? (res.value as any).count : 0;
      });
      setRoleCounts(counts);
      setStats({
        total: totalFromResponse ??
          (totalResult.status === "fulfilled" ? (totalResult.value as any).count : usersData.length),
        admin: counts[Roles.SYSTEM_ADMIN] || 0,
        manager: counts[Roles.MANAGEMENT] || 0,
        user: counts[Roles.SALES] || 0,
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
  }, [currentPage, statusFilter]);

  useEffect(() => {
    getMyPermissions()
      .then((data) => setPermissionScopes(data.scopes || {}))
      .catch(() => setPermissionScopes({}));
  }, []);

  useEffect(() => {
    const fetchRoles = async () => {
      setRolesLoading(true);
      try {
        const res = await RolesAPI.listRoles({ limit: 100 });
        const rolesData = Array.isArray(res) ? res : res.data || [];
        
        // Filter out invalid roles and only keep valid ones
        const validRoles = rolesData.filter(role => {
          const roleId = Number(role.id);
          return [10, 30, 40, 50, 60, 70, 80, 90].includes(roleId); // Only active role IDs
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
    return getRoleName(id);
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
      internal_phone: (user as any).internal_phone || "",
      iin: user.iin || user.bin_iin || "",
      address: user.address || "",
      extra_info: user.extra_info || "",
      role_id: user.role?.id,
      branch_id: user.branch?.id,
      position: user.position,
      is_verified: user.is_verified,
      is_active: user.is_active,
      // Legacy fields
      company_name: user.company_name,
      bin_iin: user.bin_iin,
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

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordChangeUser || !newPassword.trim()) return;
    setPasswordChangeLoading(true);
    try {
      await UserAPI.changeUserPassword(String(passwordChangeUser.id), newPassword.trim());
      toast({ title: "Успех", description: "Пароль успешно изменён." });
      setPasswordChangeUser(null);
      setNewPassword("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Ошибка", description: err?.message || "Не удалось изменить пароль." });
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  const handleToggleBlock = async (user: Models.User) => {
    try {
      if (user.is_active) {
        await UserAPI.blockUser(String(user.id));
        toast({ title: "Пользователь заблокирован", description: `${getUserFullName(user)} больше не может входить в систему.` });
      } else {
        await UserAPI.unblockUser(String(user.id));
        toast({ title: "Пользователь разблокирован", description: `${getUserFullName(user)} снова имеет доступ.` });
      }
      void fetchUsersAndStats();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: err?.message || "Не удалось изменить статус пользователя.",
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      const result = await UserAPI.deleteUser(String(userToDelete.id));
      if (result && (result as any).pending) {
        toast({ title: "Заявка отправлена", description: (result as any).message || "Заявка на удаление отправлена администратору на рассмотрение." });
      } else {
        toast({ title: "Успех", description: "Пользователь успешно удален." });
      }
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
    const iin = String((userFormData as any).iin || (userFormData as any).bin_iin || "").trim();
    const address = String((userFormData as any).address || "").trim();
    const extraInfo = String((userFormData as any).extra_info || "").trim();
    const roleId = Number((userFormData as any).role_id || 0);
    const branchId = (userFormData as any).branch_id ? Number((userFormData as any).branch_id) : undefined;
    const position = String((userFormData as any).position || "").trim();
    const password = String((userFormData as Models.CreateUserRequest).password || "").trim();

    if (!email) return { error: "Заполните email." };
    if (!editingUser && !password) return { error: "Введите пароль." };
    if (!firstName) return { error: "Укажите имя." };
    if (!roleId) return { error: "Выберите роль." };
    if (!position) return { error: "Укажите должность." };
    if (roleId !== Roles.SYSTEM_ADMIN && !branchId) return { error: "Выберите филиал." };
    if (phone && !E164_PHONE_PATTERN.test(phone)) {
      return { error: "Телефон должен быть в международном формате: +77001234567." };
    }

    return {
      payload: {
        ...userFormData,
        first_name: firstName,
        last_name: lastName,
        middle_name: middleName,
        email,
        phone,
        internal_phone: String((userFormData as any).internal_phone || "").trim(),
        iin,
        bin_iin: iin,
        address,
        extra_info: extraInfo,
        role_id: roleId,
        branch_id: branchId,
        position,
        ...(!editingUser ? { password } : {}),
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
        const result = await UserAPI.updateUser(String(editingUser.id), payload as Models.UpdateUserRequest);
        if (result && (result as any).pending) {
          toast({ title: "Заявка отправлена", description: (result as any).message || "Заявка на редактирование отправлена администратору на рассмотрение." });
        } else {
          toast({ title: "Успех", description: "Пользователь успешно обновлен." });
        }
      } else {
        const createPayload = { ...payload } as Models.CreateUserRequest;
        // Auto-verify if created by Leadership or System Admin only
        if (currentUser?.role?.id === Roles.MANAGEMENT || currentUser?.role?.id === Roles.SYSTEM_ADMIN) {
          createPayload.is_verified = true;
        }
        const result = await UserAPI.createUser(createPayload);
        if (result && (result as any).pending) {
          toast({ title: "Заявка отправлена", description: (result as any).message || "Заявка на создание пользователя отправлена администратору на рассмотрение." });
        } else {
          toast({ title: "Успех", description: "Пользователь успешно создан." });
        }
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
    if (statusFilter === "active" && !user.is_active) return false;
    if (statusFilter === "blocked" && user.is_active) return false;
    // для "deleted" сервер уже вернул только удалённых
    // фильтры по роли (клик по плитке) и филиалу (ТЗ п.7.3)
    if (roleFilter !== null && user.role?.id !== roleFilter) return false;
    if (branchViewFilter && String(user.branch?.id || "") !== branchViewFilter) return false;

    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
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
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 m-3 sm:m-6">
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

      {/* Компактные кликабельные плитки по ролям (ТЗ п.7.3): клик — фильтр списка */}
      <div className="flex flex-wrap gap-2 mb-4 px-2">
        <button
          type="button"
          onClick={() => setRoleFilter(null)}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
            roleFilter === null ? "border-blue-600 bg-blue-50 text-blue-700" : "bg-white hover:bg-slate-50"
          )}
        >
          <Users className="h-4 w-4" />
          Всего
          <span className="font-bold">{stats.total}</span>
        </button>
        {[
          { id: Roles.SYSTEM_ADMIN, label: "Администраторы" },
          { id: Roles.MANAGEMENT, label: "Руководство" },
          { id: Roles.SALES, label: "Менеджеры (МОП)" },
          { id: Roles.VISA, label: "Визовый отдел" },
          { id: Roles.PARTNER, label: "Партнёрский" },
          { id: Roles.HR, label: "Отдел кадров" },
          { id: Roles.LEGAL, label: "Юристы" },
          { id: Roles.QUALITY_CONTROL, label: "Контроль качества" },
        ].map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRoleFilter(roleFilter === r.id ? null : r.id)}
            title={`Показать: ${r.label}`}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
              roleFilter === r.id ? "border-blue-600 bg-blue-50 text-blue-700" : "bg-white hover:bg-slate-50"
            )}
          >
            {r.label}
            <span className="font-bold">{roleCounts[r.id] ?? 0}</span>
          </button>
        ))}
        {availableBranches.length > 0 && (
          <select
            value={branchViewFilter}
            onChange={(e) => setBranchViewFilter(e.target.value)}
            className="ml-auto rounded-lg border bg-white px-3 py-1.5 text-sm"
            title="Фильтр по филиалу"
          >
            <option value="">Все филиалы</option>
            {availableBranches.map((b) => (
              <option key={b.id} value={String(b.id)}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <div>
              <CardTitle>Список пользователей</CardTitle>
              <CardDescription>
                {users?.length ? `Найдено ${filteredUsers?.length || 0} из ${users.length} пользователей` : "Пользователи не найдены"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex overflow-x-auto rounded-md border">
                {(["all", "active", "blocked", "deleted"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStatusFilter(f)}
                    className={cn(
                      "whitespace-nowrap shrink-0 px-3 py-1.5 text-sm font-medium transition-colors",
                      statusFilter === f
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {f === "all"
                      ? "Все"
                      : f === "active"
                        ? "Активные"
                        : f === "blocked"
                          ? "Заблокированные"
                          : "Удалённые"}
                  </button>
                ))}
              </div>
              <div className="relative w-64">
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
          <div className="overflow-hidden rounded-md border">
            <Table className="w-full min-w-[760px] table-fixed">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[24%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">ФИО</TableHead>
                  <TableHead className="px-4">Email</TableHead>
                  <TableHead className="px-4">Телефон</TableHead>
                  <TableHead className="px-4">Роль</TableHead>
                  <TableHead className="px-4">Статус</TableHead>
                  <TableHead className="px-4 text-right">Действия</TableHead>
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
                      <TableCell className="px-4 align-top">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AuthenticatedAvatarImage
                              src={getAvatarUrl(user)}
                              alt={getUserFullName(user)}
                              className="h-full w-full object-cover"
                            />
                            <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
                          </Avatar>
                          <div className="break-words font-medium leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                            {getUserFullName(user)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 align-top">
                        <div className="break-all leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 align-top break-words">{user.phone || "-"}</TableCell>
                      <TableCell className="px-4 align-top">
                        <div className="break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                          {getRoleLabel(user.role?.id)}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 align-top">
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={user.is_verified ? "default" : "outline"}>
                            {user.is_verified ? "Подтвержден" : "Не подтвержден"}
                          </Badge>
                          {!user.is_active && (
                            <Badge variant="destructive">Заблокирован</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 align-top text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Просмотр"
                            onClick={() => handleViewClick(user)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Редактировать"
                              onClick={() => handleEditClick(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canChangePassword && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-blue-600"
                              title="Сменить пароль"
                              onClick={() => { setPasswordChangeUser(user); setNewPassword(""); }}
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                          )}
                          {canBlock && String(user.id) !== String(currentUser?.id) && (
                            user.is_active ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-600 hover:text-amber-700"
                                title="Заблокировать"
                                onClick={() => handleToggleBlock(user)}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700"
                                title="Разблокировать"
                                onClick={() => handleToggleBlock(user)}
                              >
                                <CircleCheck className="h-4 w-4" />
                              </Button>
                            )
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700"
                              title="Удалить"
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
            <DialogTitle>
              {editingUser
                ? userActionsNeedApproval
                  ? "Заявка на редактирование пользователя"
                  : "Редактировать пользователя"
                : userActionsNeedApproval
                  ? "Заявка на создание пользователя"
                  : "Создать пользователя"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Personal Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="last_name">Фамилия</Label>
                  <Input id="last_name" placeholder="Фамилия..." value={(userFormData as any).last_name || ''} onChange={handleFormChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="first_name">Имя</Label>
                  <Input id="first_name" placeholder="Имя..." value={(userFormData as any).first_name || ''} onChange={handleFormChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middle_name">Отчество</Label>
                  <Input id="middle_name" placeholder="Отчество..." value={(userFormData as any).middle_name || ''} onChange={handleFormChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Должность *</Label>
                <Input id="position" placeholder="Должность..." value={(userFormData as any).position || ''} onChange={handleFormChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" placeholder="Введите Email..." value={userFormData.email} onChange={handleFormChange} required />
              </div>
              {!editingUser && (
                <div className="space-y-2">
                  <Label htmlFor="password">Пароль *</Label>
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
                />
                <p className="text-xs text-muted-foreground">Формат: +77001234567</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="internal_phone">Внутренний номер (Binotel)</Label>
                <Input
                  id="internal_phone"
                  placeholder="Например: 113"
                  value={(userFormData as any).internal_phone || ""}
                  onChange={handleFormChange}
                />
                <p className="text-xs text-muted-foreground">
                  Внутренний номер сотрудника в Binotel — по нему звонки привязываются к менеджеру
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role_id">Роль *</Label>
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
                <Label htmlFor="branch_id">Филиал *</Label>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="iin">ИИН</Label>
                  <Input id="iin" placeholder="ИИН..." value={(userFormData as any).iin || (userFormData as any).bin_iin || ''} onChange={handleFormChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Адрес</Label>
                  <Input id="address" placeholder="Адрес..." value={(userFormData as any).address || ''} onChange={handleFormChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="extra_info">Дополнительная информация</Label>
                <Textarea id="extra_info" placeholder="Дополнительная информация..." value={(userFormData as any).extra_info || ''} onChange={handleFormChange} />
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
            <AlertDialogTitle>Подтвердите действие</AlertDialogTitle>
            <AlertDialogDescription>
              {userActionsNeedApproval
                ? `Заявка на удаление пользователя "${getUserFullName(userToDelete)}" будет отправлена администратору на рассмотрение.`
                : `Вы уверены, что хотите удалить пользователя "${getUserFullName(userToDelete)}"? Это действие нельзя будет отменить.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {userActionsNeedApproval ? "Отправить заявку" : "Удалить"}
            </AlertDialogAction>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="col-span-2 flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  <AuthenticatedAvatarImage src={getAvatarUrl(viewingUser)} alt={getUserFullName(viewingUser)} className="h-full w-full object-cover" />
                  <AvatarFallback>{getUserInitials(viewingUser)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{getUserFullName(viewingUser)}</p>
                  <p className="text-sm text-muted-foreground">{viewingUser?.email}</p>
                </div>
              </div>
              <DetailItem label="ID" value={viewingUser?.id} />
              <DetailItem label="ФИО" value={viewingUser?.full_name} />
              <DetailItem label="Роль" value={getRoleLabel(viewingUser?.role?.id)} />
              <DetailItem label="Email" value={viewingUser?.email} />
              <DetailItem label="Телефон" value={viewingUser?.phone} />
              <DetailItem label="Должность" value={viewingUser?.position} />
              <DetailItem label="Филиал" value={viewingUser?.branch?.name} />
              <DetailItem label="БИН/ИИН" value={viewingUser?.iin || viewingUser?.bin_iin} />
              <DetailItem label="Адрес" value={viewingUser?.address} />
              <DetailItem label="Доп. информация" value={viewingUser?.extra_info} />
              <DetailItem label="Верифицирован" value={viewingUser?.is_verified ? 'Да' : 'Нет'} />
              <DetailItem label="Активен" value={viewingUser?.is_active ? 'Да' : 'Нет'} />
              <DetailItem label="Дата создания" value={viewingUser?.created_at ? new Date(viewingUser.created_at).toLocaleString() : '-'} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingUser(null)}>Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Change Password Dialog */}
      <Dialog open={!!passwordChangeUser} onOpenChange={(open) => { if (!open) { setPasswordChangeUser(null); setNewPassword(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Сменить пароль</DialogTitle>
            <DialogDescription>{getUserFullName(passwordChangeUser)}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordChangeSubmit}>
            <div className="py-4 space-y-2">
              <Label htmlFor="new_password">Новый пароль</Label>
              <Input
                id="new_password"
                type="password"
                placeholder="Введите новый пароль..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setPasswordChangeUser(null); setNewPassword(""); }}>Отмена</Button>
              <Button type="submit" disabled={passwordChangeLoading || !newPassword.trim()}>
                {passwordChangeLoading ? "Сохранение..." : "Сохранить"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
