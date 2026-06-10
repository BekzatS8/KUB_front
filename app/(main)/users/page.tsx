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

const ROLE_LABELS: Record<number, string> = {
  [Roles.SALES]: "РћС‚РґРµР» РїСЂРѕРґР°Р¶",
  [Roles.OPERATIONS]: "РћРїРµСЂР°С†РёРѕРЅРЅС‹Р№ РѕС‚РґРµР»",
  [Roles.CONTROL]: "РћС‚РґРµР» РєРѕРЅС‚СЂРѕР»СЏ",
  [Roles.MANAGEMENT]: "Р СѓРєРѕРІРѕРґСЃС‚РІРѕ",
  [Roles.SYSTEM_ADMIN]: "РЎРёСЃС‚РµРјРЅС‹Р№ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ",
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
  placeholder = "Р’С‹Р±РµСЂРёС‚Рµ...",
  searchPlaceholder = "РџРѕРёСЃРє...",
  emptyText = "РќРёС‡РµРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ",
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
      const errorMessage = err?.message || "РћС€РёР±РєР° РїСЂРё Р·Р°РіСЂСѓР·РєРµ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "РћС€РёР±РєР°",
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
          title: "РћС€РёР±РєР°",
          description: "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЃРїРёСЃРѕРє СЂРѕР»РµР№",
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
    return ROLE_LABELS[id] || "РќРµРёР·РІРµСЃС‚РЅР°СЏ СЂРѕР»СЊ";
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
        title: "РћС€РёР±РєР°",
        description: err?.message || "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ РїРѕР»СЊР·РѕРІР°С‚РµР»Рµ.",
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
      toast({ title: "РЈСЃРїРµС…", description: "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓСЃРїРµС€РЅРѕ СѓРґР°Р»РµРЅ." });
      void fetchUsersAndStats();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "РћС€РёР±РєР°",
        description: err?.message || "РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.",
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
    if (!roleId) return { error: "Выберите роль." };
    if (!position) return { error: "Укажите должность." };
    if (!branchId) return { error: "Выберите филиал." };
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
        title: "РџСЂРѕРІРµСЂСЊС‚Рµ РґР°РЅРЅС‹Рµ",
        description: validationError || "Р—Р°РїРѕР»РЅРёС‚Рµ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹Рµ РїРѕР»СЏ.",
      });
      return;
    }

    try {
      if (editingUser) {
        await UserAPI.updateUser(String(editingUser.id), payload as Models.UpdateUserRequest);
        toast({ title: "РЈСЃРїРµС…", description: "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓСЃРїРµС€РЅРѕ РѕР±РЅРѕРІР»РµРЅ." });
      } else {
        const createPayload = { ...payload } as Models.CreateUserRequest;
        // Auto-verify if created by Leadership or System Admin only
        if (currentUser?.role?.id === Roles.MANAGEMENT || currentUser?.role?.id === Roles.SYSTEM_ADMIN) {
          createPayload.is_verified = true;
        }
        await UserAPI.createUser(createPayload);
        toast({ title: "РЈСЃРїРµС…", description: "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓСЃРїРµС€РЅРѕ СЃРѕР·РґР°РЅ." });
      }
      void fetchUsersAndStats();
      setIsFormOpen(false);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "РћС€РёР±РєР°",
        description: err?.response?.data?.message || err?.message || "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.",
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
            РџРѕР»СЊР·РѕРІР°С‚РµР»Рё
          </h1>
          <p className="text-sm text-gray-600">
            РЈРїСЂР°РІР»РµРЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРјРё СЃРёСЃС‚РµРјС‹
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={fetchUsersAndStats} variant="outline" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            РћР±РЅРѕРІРёС‚СЊ
          </Button>
          {canCreate && (
            <Button onClick={handleCreateClick}>
              <Plus className="h-4 w-4 mr-2" />
              Р”РѕР±Р°РІРёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 px-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Р’СЃРµРіРѕ</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂС‹</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.admin}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">РњРµРЅРµРґР¶РµСЂС‹</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.manager}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">РџРѕР»СЊР·РѕРІР°С‚РµР»Рё</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.user}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>РЎРїРёСЃРѕРє РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№</CardTitle>
              <CardDescription>
                {users?.length ? `РќР°Р№РґРµРЅРѕ ${filteredUsers?.length || 0} РёР· ${users.length} РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№` : "РџРѕР»СЊР·РѕРІР°С‚РµР»Рё РЅРµ РЅР°Р№РґРµРЅС‹"}
              </CardDescription>
            </div>
            <div className="w-1/3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Р’РІРµРґРёС‚Рµ РґР°РЅРЅС‹Рµ РґР»СЏ РїРѕРёСЃРєР°..."
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
            <Table className="w-full table-fixed">
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
                  <TableHead className="px-4">Р¤РРћ</TableHead>
                  <TableHead className="px-4">Email</TableHead>
                  <TableHead className="px-4">РўРµР»РµС„РѕРЅ</TableHead>
                  <TableHead className="px-4">Р РѕР»СЊ</TableHead>
                  <TableHead className="px-4">РЎС‚Р°С‚СѓСЃ</TableHead>
                  <TableHead className="px-4 text-right">Р”РµР№СЃС‚РІРёСЏ</TableHead>
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
                      РџРѕР»СЊР·РѕРІР°С‚РµР»Рё РЅРµ РЅР°Р№РґРµРЅС‹.
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
                        <Badge variant={user.is_verified ? "default" : "outline"}>
                          {user.is_verified ? "РџРѕРґС‚РІРµСЂР¶РґРµРЅ" : "РќРµ РїРѕРґС‚РІРµСЂР¶РґРµРЅ"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 align-top text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="РџСЂРѕСЃРјРѕС‚СЂ"
                            onClick={() => handleViewClick(user)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ"
                              onClick={() => handleEditClick(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700"
                              title="РЈРґР°Р»РёС‚СЊ"
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
            <DialogTitle>{editingUser ? "Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ" : "РЎРѕР·РґР°С‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Personal Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="last_name">Р¤Р°РјРёР»РёСЏ</Label>
                  <Input id="last_name" placeholder="Р¤Р°РјРёР»РёСЏ..." value={(userFormData as any).last_name || ''} onChange={handleFormChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="first_name">РРјСЏ</Label>
                  <Input id="first_name" placeholder="РРјСЏ..." value={(userFormData as any).first_name || ''} onChange={handleFormChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middle_name">РћС‚С‡РµСЃС‚РІРѕ</Label>
                  <Input id="middle_name" placeholder="РћС‚С‡РµСЃС‚РІРѕ..." value={(userFormData as any).middle_name || ''} onChange={handleFormChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Р”РѕР»Р¶РЅРѕСЃС‚СЊ *</Label>
                <Input id="position" placeholder="Р”РѕР»Р¶РЅРѕСЃС‚СЊ..." value={(userFormData as any).position || ''} onChange={handleFormChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" placeholder="Р’РІРµРґРёС‚Рµ Email..." value={userFormData.email} onChange={handleFormChange} required />
              </div>
              {!editingUser && (
                <div className="space-y-2">
                  <Label htmlFor="password">РџР°СЂРѕР»СЊ *</Label>
                  <Input id="password" type="password" placeholder="Р’РІРµРґРёС‚Рµ РїР°СЂРѕР»СЊ..." value={(userFormData as Models.CreateUserRequest).password} onChange={handleFormChange} required={!editingUser} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="phone">РўРµР»РµС„РѕРЅ</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="+77001234567"
                  pattern="\+[1-9][0-9]{10,14}"
                  title="РўРµР»РµС„РѕРЅ РІ РјРµР¶РґСѓРЅР°СЂРѕРґРЅРѕРј С„РѕСЂРјР°С‚Рµ, РЅР°РїСЂРёРјРµСЂ +77001234567"
                  value={userFormData.phone}
                  onChange={handleFormChange}
                />
                <p className="text-xs text-muted-foreground">Р¤РѕСЂРјР°С‚: +77001234567</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role_id">Р РѕР»СЊ *</Label>
                <CustomSelect
                  value={String(userFormData.role_id)}
                  onChange={handleRoleChange}
                  placeholder={rolesLoading ? "Р—Р°РіСЂСѓР·РєР° СЂРѕР»РµР№..." : "Р’С‹Р±РµСЂРёС‚Рµ СЂРѕР»СЊ..."}
                  disabled={rolesLoading}
                  options={availableRoles.map(role => ({
                    value: String(role.id),
                    label: getRoleLabel(Number(role.id))
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch_id">Р¤РёР»РёР°Р» *</Label>
                <ComboboxSelect
                  value={userFormData.branch_id ? String(userFormData.branch_id) : ""}
                  onChange={(value) => setUserFormData(prev => ({ ...prev, branch_id: value ? Number(value) : undefined }))}
                  placeholder={branchesLoading ? "Р—Р°РіСЂСѓР·РєР° С„РёР»РёР°Р»РѕРІ..." : "Р’С‹Р±РµСЂРёС‚Рµ С„РёР»РёР°Р»..."}
                  searchPlaceholder="РџРѕРёСЃРє С„РёР»РёР°Р»Р°..."
                  emptyText="Р¤РёР»РёР°Р» РЅРµ РЅР°Р№РґРµРЅ"
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
                  <Label htmlFor="is_verified" className="cursor-pointer">Р’РµСЂРёС„РёС†РёСЂРѕРІР°РЅ</Label>
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
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>РћС‚РјРµРЅР°</Button>
              <Button type="submit">РЎРѕС…СЂР°РЅРёС‚СЊ</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog >

      {/* Delete Confirmation Dialog */}
      < AlertDialog open={!!userToDelete
      } onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Р’С‹ СѓРІРµСЂРµРЅС‹?</AlertDialogTitle>
            <AlertDialogDescription>
              Р’С‹ СѓРІРµСЂРµРЅС‹, С‡С‚Рѕ С…РѕС‚РёС‚Рµ СѓРґР°Р»РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ "{getUserFullName(userToDelete)}"? Р­С‚Рѕ РґРµР№СЃС‚РІРёРµ РЅРµР»СЊР·СЏ Р±СѓРґРµС‚ РѕС‚РјРµРЅРёС‚СЊ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>РћС‚РјРµРЅР°</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>РЈРґР°Р»РёС‚СЊ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog >

      {/* View User Details Dialog */}
      < Dialog open={!!viewingUser} onOpenChange={() => setViewingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Р”РµС‚Р°Р»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ</DialogTitle>
            <DialogDescription>{getUserFullName(viewingUser)}</DialogDescription>
          </DialogHeader>
          {isLoading ? <Spinner /> : (
            <div className="grid grid-cols-2 gap-4 py-4">
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
              <DetailItem label="Р¤РРћ" value={viewingUser?.full_name} />
              <DetailItem label="Р РѕР»СЊ" value={getRoleLabel(viewingUser?.role?.id)} />
              <DetailItem label="Email" value={viewingUser?.email} />
              <DetailItem label="РўРµР»РµС„РѕРЅ" value={viewingUser?.phone} />
              <DetailItem label="Р”РѕР»Р¶РЅРѕСЃС‚СЊ" value={viewingUser?.position} />
              <DetailItem label="Р¤РёР»РёР°Р»" value={viewingUser?.branch?.name} />
              <DetailItem label="Р‘РРќ/РРРќ" value={viewingUser?.iin || viewingUser?.bin_iin} />
              <DetailItem label="Адрес" value={viewingUser?.address} />
              <DetailItem label="Доп. информация" value={viewingUser?.extra_info} />
              <DetailItem label="Р’РµСЂРёС„РёС†РёСЂРѕРІР°РЅ" value={viewingUser?.is_verified ? 'Р”Р°' : 'РќРµС‚'} />
              <DetailItem label="РђРєС‚РёРІРµРЅ" value={viewingUser?.is_active ? 'Р”Р°' : 'РќРµС‚'} />
              <DetailItem label="Р”Р°С‚Р° СЃРѕР·РґР°РЅРёСЏ" value={viewingUser?.created_at ? new Date(viewingUser.created_at).toLocaleString() : '-'} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingUser(null)}>Р—Р°РєСЂС‹С‚СЊ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >
    </>
  );
}
