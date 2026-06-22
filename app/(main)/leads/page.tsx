"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  UserPlus,
  Replace,
  ChevronsRight,
  RefreshCw,
  Users,
  Star,
  Activity,
  CheckCircle,
  Calendar,
  Archive,
  ArchiveRestore,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { getCurrentUser, hasPermission, getRoleCode } from "@/lib/auth";
import { ArchiveFilter, ArchiveFilterValue } from "@/components/ui/archive-filter";
import { CollapsibleFilter } from "@/components/ui/collapsible-filter";
import { getMe } from "@/src/api/auth.api";
import type { Lead } from "@/lib/types";
import * as leadsApi from "@/src/api/leads.api";
import * as ClientAPI from "@/src/api/clients.api";
import * as FeedAPI from "@/src/api/feed.api";
import * as BranchesAPI from "@/src/api/branches.api";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { PaginationControls } from "@/components/ui/pagination-controls";

type LeadStatus = "new" | "in_progress" | "confirmed" | "converted" | "cancelled";

const statusTransitions: Record<LeadStatus, LeadStatus[]> = {
  new: ["in_progress", "confirmed", "cancelled"],
  in_progress: ["confirmed", "cancelled"],
  confirmed: ["cancelled"],
  converted: [],
  cancelled: [],
};

const statusTranslations: Record<LeadStatus, string> = {
  new: "Новый",
  in_progress: "В работе",
  confirmed: "Подтвержден",
  converted: "Конвертирован",
  cancelled: "Отменен",
};
const allStatuses: LeadStatus[] = ["new", "in_progress", "confirmed", "converted", "cancelled"];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusGroupFilter, setStatusGroupFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>("active");
  const [branchFilter, setBranchFilter] = useState<number | undefined>(undefined);
  const [availableBranches, setAvailableBranches] = useState<{ id: number, name: string }[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [view, setView] = useState<"all" | "my">(() => {
    // Default to "my" only for sales users, others get "all"
    const user = getCurrentUser();
    const userRole = user ? getRoleCode(user) : undefined;
    return userRole === 'sales' ? 'my' : 'all';
  });

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isUnarchiveDialogOpen, setIsUnarchiveDialogOpen] = useState(false);
  const [leadToArchive, setLeadToArchive] = useState<Lead | null>(null);
  const [isAssignUserOpen, setIsAssignUserOpen] = useState(false);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const [newLead, setNewLead] = useState({
    title: "",
    description: "",
  });
  const [editLeadData, setEditLeadData] = useState({
    title: "",
    description: "",
    status: "new"
  });
  const [assignLeadData, setAssignLeadData] = useState({ assignee_id: 0, comment: "" });
  const [convertLeadData, setConvertLeadData] = useState({
    client_id: "",
    amount: "",
    currency: "KZT",
  });
  const [isClientSelectOpen, setIsClientSelectOpen] = useState(false);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [statusChangeData, setStatusChangeData] = useState({ to: "", comment: "" });

  const [user, setUser] = useState<any>(null);
  const [canWrite, setCanWrite] = useState(false);

  // Check if user has elevated role (leadership, control, system_admin)
  const isElevatedRole = () => {
    const roleCode = getRoleCode(user);
    return roleCode === 'leadership' || roleCode === 'control' || roleCode === 'system_admin';
  };

  // Helper function to map role_id to role name (same as sidebar)
  function getRoleFromId(roleId: number): string {
    const roleMapping: Record<number, string> = {
      50: 'system_admin',
      40: 'management',
      30: 'quality_control',
      10: 'sales',
      60: 'visa',
      70: 'partner',
      80: 'hr',
      90: 'legal',
    }
    return roleMapping[roleId] || 'user'
  }

  const getUserDisplayName = (profile: any, fallbackId?: number) => {
    if (!profile) return fallbackId ? `ID: ${fallbackId}` : "Не назначен";

    const fullName = [
      profile.last_name || profile.lastName,
      profile.first_name || profile.firstName,
      profile.middle_name || profile.middleName,
    ].filter(Boolean).join(" ").trim();

    return (
      profile.full_name ||
      fullName ||
      profile.name ||
      profile.legacy?.company_name ||
      profile.company_name ||
      profile.email ||
      (profile.id ? `ID: ${profile.id}` : "Не указано")
    );
  };

  const getUserRoleLabel = (profile: any) => {
    if (!profile) return "";
    return (
      profile.position ||
      profile.role?.name ||
      profile.role?.legacy_name ||
      profile.role?.code ||
      (profile.role_id ? getRoleFromId(Number(profile.role_id)) : "")
    );
  };

  const getUserSearchValue = (profile: any) => [
    getUserDisplayName(profile),
    profile.first_name,
    profile.last_name,
    profile.middle_name,
    profile.full_name,
    profile.email,
    profile.phone,
    profile.position,
    profile.role?.name,
    profile.role?.legacy_name,
    profile.role?.code,
    profile.id,
  ].filter(Boolean).join(" ");

  const getLeadResponsibleId = (lead: any) => Number(lead.assignee_id || lead.owner_id || 0);

  const getUserById = (id: number) => {
    if (!id) return null;
    const loadedUser = users.find((u) => Number(u.id) === Number(id));
    if (loadedUser) return loadedUser;
    if (user && Number(user.id) === Number(id)) return user;
    return null;
  };

  const renderUserMiniCard = (profile: any, fallbackId: number) => (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
          {getUserDisplayName(profile, fallbackId).charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-slate-900">{getUserDisplayName(profile, fallbackId)}</div>
          <div className="text-sm text-slate-500">{getUserRoleLabel(profile) || "Должность не указана"}</div>
        </div>
      </div>
      <div className="space-y-1 text-sm text-slate-600">
        <div><span className="text-slate-400">ID:</span> {profile?.id || fallbackId}</div>
        <div><span className="text-slate-400">Email:</span> {profile?.email || "Не указан"}</div>
        <div><span className="text-slate-400">Телефон:</span> {profile?.phone || "Не указан"}</div>
        <div><span className="text-slate-400">Филиал:</span> {profile?.branch?.name || "Не указан"}</div>
      </div>
    </div>
  );

  const renderResponsibleUser = (lead: Lead) => {
    const responsibleId = getLeadResponsibleId(lead);
    const responsible = getUserById(responsibleId);

    if (!responsibleId) {
      return <span className="text-sm text-gray-400">Не назначен</span>;
    }

    return (
      <HoverCard openDelay={150}>
        <HoverCardTrigger asChild>
          <button type="button" className="text-left font-medium text-slate-900 hover:text-blue-600">
            {getUserDisplayName(responsible, responsibleId)}
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-72" align="start">
          {renderUserMiniCard(responsible, responsibleId)}
        </HoverCardContent>
      </HoverCard>
    );
  };

  // Fetch branches for elevated roles
  useEffect(() => {
    if (isElevatedRole()) {
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
    }
  }, [user]);

  // Fetch user data like sidebar does
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userData = await getMe();
        setUser(userData);
        const userRole = getRoleCode(userData);
        const hasWriteAccess = userData && hasPermission(userRole, ["leads:write"]);
        setCanWrite(hasWriteAccess);
      } catch (error) {
        console.error("Failed to fetch user data", error);
        // Fallback to localStorage
        const localUser = getCurrentUser();
        setUser(localUser);
        const userRole = getRoleCode(localUser);
        setCanWrite(!!(localUser && hasPermission(userRole, ["leads:write"])));
      }
    };

    fetchUserData();
  }, []);

  // Force sales users to use "my" view - immediate check
  useEffect(() => {
    const userRole = getRoleCode(user);
    if (userRole === 'sales' && view === 'all') {
      setView('my');
    }
  }, [user, view]);

  // Additional safety check - force sales users immediately on mount
  useEffect(() => {
    const currentUser = getCurrentUser();
    const userRole = getRoleCode(currentUser);
    if (userRole === 'sales') {
      setView('my');
    }
  }, []);

  const [users, setUsers] = useState<any[]>([]);

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const currentPage = Number(searchParams.get('page')) || 1;
  const limit = 15;
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Initialize filter states from URL
  useEffect(() => {
    setStatusGroupFilter(searchParams.get('status_group') || 'all');
    const branchId = Number(searchParams.get('branch_id') || 0);
    setBranchFilter(branchId > 0 ? branchId : undefined);
    setSortBy(searchParams.get('sort_by') || 'created_at');
    setSortOrder((searchParams.get('order') as 'asc' | 'desc') || 'desc');
  }, [searchParams]);

  // Update URL when filters change
  const updateURL = () => {
    const params = new URLSearchParams();
    if (currentPage > 1) params.set('page', currentPage.toString());
    if (searchTerm) params.set('q', searchTerm);
    if (statusGroupFilter !== 'all') params.set('status_group', statusGroupFilter);
    if (archiveFilter !== 'active') params.set('archive', archiveFilter);
    if (branchFilter) params.set('branch_id', String(branchFilter));
    params.set('sort_by', sortBy);
    params.set('order', sortOrder);
    router.push(`${pathname}?${params.toString()}`);
  };

  // Reset filters
  const resetFilters = () => {
    setStatusGroupFilter('all');
    setSortBy('created_at');
    setSortOrder('desc');
    setSearchTerm('');
    setBranchFilter(undefined);
    setArchiveFilter('active');
    router.push(pathname);
  };

  // Reset page to 1 when filters change
  useEffect(() => {
    if (currentPage > 1) {
      const params = new URLSearchParams(searchParams);
      params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`);
    }
  }, [statusGroupFilter, archiveFilter, sortBy, sortOrder, branchFilter]);

  const fetchLeads = async () => {
    console.log('fetchLeads called with view:', view, 'user:', user);
    setIsLoading(true);
    try {
      // Default to "my" view only for sales users
      const userRole = getRoleCode(user);
      const shouldUseMyView = view === "my" || userRole === 'sales';
      const fetchFn = shouldUseMyView ? leadsApi.list_my_leads : leadsApi.list_leads;
      const params: any = { page: currentPage, size: limit };
      if (searchTerm) params.q = searchTerm;
      if (statusGroupFilter !== "all") params.status_group = statusGroupFilter;
      if (archiveFilter !== "active") params.archive = archiveFilter;
      if (branchFilter) params.branch_id = branchFilter;
      params.sort_by = sortBy;
      params.order = sortOrder;

      const res = await fetchFn(undefined, params);
      let data;
      if (res?.items && Array.isArray(res.items)) {
        data = res.items;
      } else if (Array.isArray(res)) {
        data = res;
      } else if (res?.data && Array.isArray(res.data)) {
        data = res.data;
      } else {
        data = [];
      }
      let total = res?.pagination?.total || res?.total || data.length;
      let totalPagesFromBackend = res?.pagination?.total_pages || Math.ceil(total / limit);

      setLeads(data);
      setTotalLeads(total);
      setTotalPages(totalPagesFromBackend);
      setError("");
    } catch (err: any) {
      console.log('Error in fetchLeads:', err);
      // If we get a 403 error, always switch to "my" view
      if (err?.response?.status === 403 && getRoleCode(user) === 'sales') {
        console.log('403 error detected, switching to "my" leads view...');
        setView('my');
        return; // The useEffect will trigger fetchLeads again with the new view
      }
      setError(err?.message || "Ошибка при загрузке лидов");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    // Sales users typically don't need to see all users for assignment
    const userRole = getRoleCode(user);
    if (userRole === 'sales') {
      setUsers([]);
      return;
    }

    try {
      const { listUsers } = await import("@/src/api/users.api");
      const res = await listUsers();
      const usersData = Array.isArray(res) ? res : ((res as any)?.data || (res as any)?.items || []);
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err: any) {
      // If 403 error, just set empty users array - sales users don't need this anyway
      if (err?.response?.status === 403) {
        console.log('403 error loading users, setting empty array for sales users');
        setUsers([]);
      } else {
        console.error("Error loading users:", err);
      }
    }
  };

  const fetchClients = async () => {
    try {
      const userRole = getRoleCode(user);
      const fetchFn = userRole === 'sales' ? ClientAPI.listMyClients : ClientAPI.listClients;
      const res = await fetchFn({ page: 1, size: 100 });
      const data = Array.isArray(res) ? res : ((res as any)?.items || (res as any)?.data || []);
      setClientsList(data);
    } catch (err: any) {
      console.error("Failed to fetch clients:", err);
    }
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    if (user) {
      fetchUsers();
      fetchClients();
    }
  }, [user]);

  useEffect(() => {
    console.log('useEffect triggered - user:', user, 'view:', view);
    const timer = setTimeout(() => {
      // Always try to fetch leads - let the API handle permissions
      console.log('Calling fetchLeads regardless of user data');
      fetchLeads();
    }, 300);
    return () => clearTimeout(timer);
  }, [view, currentPage, searchTerm, statusGroupFilter, archiveFilter, sortBy, sortOrder, branchFilter]);

  // Update URL when filters change
  useEffect(() => {
    updateURL();
  }, [statusGroupFilter, archiveFilter, sortBy, sortOrder]);

  const getStatusBadge = (status: LeadStatus) => {
    const statusConfig: Record<LeadStatus, { label: string; className: string }> = {
      new: { label: statusTranslations.new, className: "bg-blue-100 text-blue-800" },
      in_progress: { label: statusTranslations.in_progress, className: "bg-yellow-100 text-yellow-800" },
      confirmed: { label: statusTranslations.confirmed, className: "bg-green-100 text-green-800" },
      converted: { label: statusTranslations.converted, className: "bg-purple-100 text-purple-800" },
      cancelled: { label: statusTranslations.cancelled, className: "bg-red-100 text-red-800" },
    };

    const config = statusConfig[status] || statusConfig.new;
    return <Badge className={`${config.className} text-xs`}>{config.label}</Badge>;
  };

  // Calculate statistics (Note: reflects current page only if backend pagination is active without separate stats API)
  const stats = {
    total: totalLeads,
    new: leads.filter(l => l.status === 'new').length,
    inProgress: leads.filter(l => l.status === 'in_progress').length,
    converted: leads.filter(l => l.status === 'converted').length,
  };

  const handleCreateLead = async () => {
    console.log('handleCreateLead called');
    
    // Debug user data
    const currentUser = getCurrentUser();
    console.log('getCurrentUser() result:', currentUser);
    console.log('localStorage user data:', localStorage.getItem('current_user'));
    
    let user = currentUser;
    
    // If no user from getCurrentUser, try to get from localStorage directly
    if (!user) {
      console.log('No user found, checking localStorage directly...');
      const lsUser = localStorage.getItem('current_user');
      console.log('Raw localStorage data:', lsUser);
      if (lsUser) {
        try {
          const parsedUser = JSON.parse(lsUser);
          console.log('Parsed user from localStorage:', parsedUser);
          if (parsedUser) {
            user = parsedUser;
            console.log('Using parsed user, continuing...');
          }
        } catch (e) {
          console.error('Failed to parse user from localStorage:', e);
        }
      }
    }
    
    // TEMPORARY: For testing, create a mock user if still no user
    if (!user) {
      console.log('Still no user found, creating mock user for testing...');
      user = {
        id: '1',
        role: { id: 50, code: 'system_admin', legacy_name: 'admin' },
        full_name: 'Test User',
        email: 'test@example.com'
      };
      console.log('Using mock user:', user);
    }
    
    console.log('Final user object:', user);
    console.log('New lead data:', newLead);
    
    return createLeadWithUser(user);
  };

  const createLeadWithUser = async (user: any) => {
    if (!newLead.title.trim()) {
      alert('Пожалуйста, введите название лида');
      return;
    }

    const userRole = getRoleCode(user);

    if (userRole === 'sales') {
      // Sales users: send to admin approval feed
      try {
        const payload = {
          ...newLead,
          owner_id: user.id ? parseInt(user.id) : 0,
          status: "new",
        };
        await FeedAPI.createFeedEvent({
          type: 'pending_create_lead',
          payload,
        });
        setNewLead({ title: "", description: "" });
        toast.success('Запрос на создание лида отправлен администратору на подтверждение');
      } catch (err: any) {
        toast.error(`Ошибка отправки запроса: ${err?.message || 'Unknown error'}`);
      } finally {
        setIsCreateDialogOpen(false);
      }
      return;
    }

    // Non-sales users: create directly
    try {
      const payload = {
        ...newLead,
        owner_id: user.id ? parseInt(user.id) : 0,
        status: "new",
      };
      const res = await leadsApi.create_lead(payload);
      const created = res?.data || res;
      setLeads((prev) => [created, ...(prev || [])]);
      setNewLead({ title: "", description: "" });
      fetchLeads();
      toast.success('Лид успешно создан!');
    } catch (err: any) {
      console.error("Ошибка создания лида:", err);
      toast.error(`Ошибка создания лида: ${err?.message || err?.response?.data?.message || 'Unknown error'}`);
    } finally {
      setIsCreateDialogOpen(false);
    }
  };

  const handleUpdateLead = async () => {
    if (!selectedLead || !user) return;

    const userRole = getRoleCode(user);

    if (userRole === 'sales') {
      // Sales users: send edit request to admin approval feed
      try {
        const payload = {
          ...editLeadData,
          owner_id: selectedLead.owner_id,
        };
        await FeedAPI.createFeedEvent({
          type: 'pending_edit_lead',
          payload,
          resource_id: selectedLead.id,
        });
        toast.success('Запрос на редактирование лида отправлен администратору на подтверждение');
      } catch (err: any) {
        toast.error(`Ошибка отправки запроса: ${err?.message || 'Unknown error'}`);
      } finally {
        setIsEditDialogOpen(false);
      }
      return;
    }

    // Non-sales users: update directly
    try {
      const payload = {
        ...editLeadData,
        owner_id: selectedLead.owner_id,
      };
      const res = await leadsApi.update_lead(payload, { id: selectedLead.id });
      const updatedLead = res?.data || res;
      setLeads((prev) => (prev || []).map((l) => (l.id === updatedLead.id ? updatedLead : l)));
      fetchLeads();
      toast.success('Лид обновлен');
    } catch (err) {
      console.error("Ошибка обновления лида:", err);
      toast.error('Ошибка при обновлении лида');
    } finally {
      setIsEditDialogOpen(false);
    }
  };

  const handleDeleteLead = async (leadId: number) => {
    try {
      await leadsApi.delete_lead(undefined, { id: leadId });
      setLeads((prev) => (prev || []).filter((l) => l.id !== leadId));
      toast.success("Лид успешно удален");
    } catch (err: any) {
      console.error("Ошибка удаления лида:", err);
      const errorMsg = err?.response?.data?.message || err?.message || 'Unknown error';
      if (errorMsg.includes('foreign key') || errorMsg.includes('constraint') || errorMsg.includes('violates') || err?.response?.status === 500) {
        toast.error("Невозможно удалить лид, так как он связан со сделками. Сначала удалите связанные сделки или используйте архивацию.");
      } else {
        toast.error(`Ошибка удаления лида: ${errorMsg}`);
      }
    }
  };

  const handleAssignLead = async () => {
    if (!selectedLead) return;
    try {
      await leadsApi.assign_lead(assignLeadData, { id: selectedLead.id });
      fetchLeads();
    } catch (err) {
      console.error("Ошибка назначения лида:", err);
    } finally {
      setIsAssignDialogOpen(false);
    }
  };

  const handleConvertLead = async () => {
    if (!selectedLead) return;
    try {
      const clientId = Number(convertLeadData.client_id);
      if (!clientId) {
        alert('Пожалуйста, введите ID клиента');
        return;
      }

      // Fetch client to get client_type
      let clientType = "individual"; // default
      try {
        const clientRes = await ClientAPI.getClientById(clientId.toString());
        clientType = clientRes?.client_type || "individual";
      } catch (err) {
        console.error("Error fetching client:", err);
        // Continue with default if fetch fails
      }

      const amount = Number(convertLeadData.amount);
      if (!amount || amount <= 0) {
        alert("Введите сумму больше 0");
        return;
      }

      await leadsApi.convert_lead_to_deal({
        client_id: clientId,
        client_type: clientType,
        amount,
        currency: convertLeadData.currency || "KZT",
      } as any, { id: selectedLead.id });

      fetchLeads();
      alert('Лид успешно конвертирован в сделку!');
    } catch (err: any) {
      console.error("Ошибка конвертации лида:", err);
      alert(`Ошибка конвертации: ${err?.response?.data?.message || err?.message || 'Unknown error'}`);
    } finally {
      setIsConvertDialogOpen(false);
    }
  };

  const handleChangeStatus = async () => {
    if (!selectedLead) return;
    try {
      await leadsApi.update_lead_status(statusChangeData, { id: selectedLead.id });
      fetchLeads();
    } catch (err) {
      console.error("Ошибка смены статуса:", err);
    } finally {
      setIsStatusDialogOpen(false);
    }
  };

  const openEditDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setEditLeadData({ title: lead.title, description: lead.description, status: lead.status });
    setIsEditDialogOpen(true);
  };

  const openAssignDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setAssignLeadData({ assignee_id: getLeadResponsibleId(lead), comment: "" });
    setIsAssignDialogOpen(true);
  };

  const openConvertDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setConvertLeadData({
      client_id: "",
      amount: "",
      currency: "KZT",
    });
    setIsClientSelectOpen(false);
    setIsConvertDialogOpen(true);
  };

  const openStatusDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setStatusChangeData({ to: "", comment: "" });
    setIsStatusDialogOpen(true);
  };

  const handleArchiveLead = async () => {
    if (!leadToArchive) return;
    try {
      await leadsApi.archive_lead(undefined, { id: leadToArchive.id });
      alert('Лид успешно заархивирован');
      fetchLeads();
    } catch (err: any) {
      console.error("Ошибка архивации лида:", err);
      alert(`Ошибка архивации: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsArchiveDialogOpen(false);
      setLeadToArchive(null);
    }
  };

  const handleUnarchiveLead = async () => {
    if (!leadToArchive) return;
    try {
      await leadsApi.unarchive_lead(undefined, { id: leadToArchive.id });
      alert('Лид успешно разархивирован');
      fetchLeads();
    } catch (err: any) {
      console.error("Ошибка разархивации лида:", err);
      alert(`Ошибка разархивации: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsUnarchiveDialogOpen(false);
      setLeadToArchive(null);
    }
  };

  const isAdmin = user?.role && typeof user.role === 'object' && 'id' in user.role ? (user.role as any).id === 50 : false;
  const isSales = getRoleCode(user) === 'sales';
  const isPartner = getRoleCode(user) === 'partner';

  if (isLoading && (!leads || leads.length === 0)) {
    return (
      <>
        <div className="m-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-4 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-24 mb-6" />
          <Skeleton className="h-96" />
        </div>
      </>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between m-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Лиды
          </h1>
          <p className="text-gray-600">
            Управление потенциальными клиентами
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={fetchLeads}
            variant="outline"
            size="icon"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          {canWrite && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Новый лид
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100vw-1rem)] max-w-lg max-h-[calc(100dvh-1rem)] overflow-y-auto touch-pan-y p-4 sm:p-6 [-webkit-overflow-scrolling:touch]">
                <DialogHeader>
                  <DialogTitle>Создать новый лид</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Название лида</Label>
                    <Input id="title" placeholder="Введите название лида..." value={newLead.title} onChange={(e) => setNewLead({ ...newLead, title: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Описание</Label>
                    <Textarea id="description" placeholder="Напишите описание..." value={newLead.description} onChange={(e) => setNewLead({ ...newLead, description: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Отмена</Button>
                  <Button onClick={handleCreateLead}>
                    {isSales ? 'Отправить на подтверждение' : 'Создать'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-6 mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mx-6 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.total}
                </div>
                <p className="text-sm text-gray-600">Всего лидов</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {stats.new}
                </div>
                <p className="text-sm text-gray-600">Новые</p>
              </div>
              <Star className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.inProgress}
                </div>
                <p className="text-sm text-gray-600">В работе</p>
              </div>
              <Activity className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {stats.converted}
                </div>
                <p className="text-sm text-gray-600">Конвертированы</p>
              </div>
              <CheckCircle className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="mx-6 mb-6">
        <CollapsibleFilter defaultOpen={false}>
          <Card className="overflow-visible">
            <CardContent className="p-4 overflow-visible">
              <div className="flex flex-col sm:flex-row gap-4 overflow-visible">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Введите название или описание..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                {/* View selector - only for non-sales users */}
                {user && getRoleCode(user) !== 'sales' && (
                  <div className="w-full sm:w-48 overflow-visible">
                    <CustomSelect
                      value={view}
                      onChange={(val) => setView(val as "all" | "my")}
                      placeholder="Режим просмотра"
                      options={[
                        { value: "all", label: "Все лиды" },
                        { value: "my", label: "Мои лиды" },
                      ]}
                    />
                  </div>
                )}
                {/* Branch filter - only for elevated roles */}
                {isElevatedRole() && (
                  <div className="w-full sm:w-48 overflow-visible">
                    <CustomSelect
                      value={branchFilter ? String(branchFilter) : ""}
                      onChange={(val) => setBranchFilter(val ? Number(val) : undefined)}
                      placeholder={branchesLoading ? "Загрузка..." : "Филиал"}
                      disabled={branchesLoading}
                      options={[
                        { value: "", label: "Все филиалы" },
                        ...availableBranches.map(branch => ({
                          value: String(branch.id),
                          label: branch.name
                        }))
                      ]}
                    />
                  </div>
                )}
                <div className="w-full sm:w-48 overflow-visible">
                  <CustomSelect
                    value={statusGroupFilter}
                    onChange={setStatusGroupFilter}
                    placeholder="Группа статусов"
                    options={[
                      { value: "all", label: "Все статусы" },
                      { value: "active", label: "Активные" },
                      { value: "closed", label: "Закрытые" },
                    ]}
                  />
                </div>
                <div className="w-full sm:w-48 overflow-visible">
                  <ArchiveFilter
                    value={archiveFilter}
                    onChange={setArchiveFilter}
                  />
                </div>
                <div className="w-full sm:w-48 overflow-visible">
                  <div className="flex gap-2">
                    <CustomSelect
                      value={sortBy}
                      onChange={setSortBy}
                      placeholder="Сортировка"
                      options={[
                        { value: "created_at", label: "Дата создания" },
                        { value: "status", label: "Статус" },
                        { value: "title", label: "Название" },
                      ]}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    >
                      {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="w-full sm:w-auto">
                  <Button variant="outline" onClick={resetFilters}>
                    Сбросить
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleFilter>
      </div>

      {/* Table */}
      <Card className="mx-6 mb-6">
        <CardHeader>
          <CardTitle>Список лидов</CardTitle>
          <CardDescription>
            {leads?.length ? `Найдено ${leads.length} лидов` : "Лиды не найдены"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <Table className="w-full table-fixed">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[16%]" />
                <col className="w-[30%]" />
                <col className="w-[10%]" />
                <col className="w-[15%]" />
                <col className="w-[10%]" />
                <col className="w-[14%]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">ID</TableHead>
                  <TableHead className="px-4">Название</TableHead>
                  <TableHead className="px-4">Описание</TableHead>
                  <TableHead className="px-4">Статус</TableHead>
                  <TableHead className="px-4">Ответственный</TableHead>
                  <TableHead className="px-4">Дата</TableHead>
                  <TableHead className="px-4 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!leads || leads.length === 0) ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">Лиды не найдены</TableCell></TableRow>
                ) : (
                  leads.map((lead) => {
                    const isArchived = lead.archived || lead.is_archived;
                    return (
                      <TableRow key={lead.id} className={isArchived ? "bg-gray-200" : ""}>
                        <TableCell className="px-4 align-top font-mono text-sm">{lead.id}</TableCell>
                        <TableCell className="px-4 align-top">
                          <div className="break-words font-medium leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">
                            {lead.title}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          <div className="break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">
                            {lead.description || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          <div className="flex flex-col items-start gap-1">
                            {getStatusBadge(lead.status)}
                            {isArchived && (
                              <Badge className="bg-gray-100 text-gray-800 text-xs">Архив</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          <div className="break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                            {renderResponsibleUser(lead)}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          <div className="flex items-center whitespace-nowrap text-sm">
                            <Calendar className="mr-1 h-3 w-3 shrink-0 text-gray-400" />
                            {new Date(lead.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {canWrite && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(lead)} title="Редактировать">
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {!isSales && !isPartner && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openAssignDialog(lead)} title="Назначить">
                                <UserPlus className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openStatusDialog(lead)}
                              disabled={statusTransitions[lead.status as LeadStatus]?.length === 0}
                              title="Сменить статус"
                            >
                              <Replace className="h-4 w-4" />
                            </Button>
                            {!isPartner && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openConvertDialog(lead)}
                                disabled={lead.status === 'converted' || lead.status === 'cancelled' || !!isArchived}
                                title="Конвертировать"
                              >
                                <ChevronsRight className="h-4 w-4" />
                              </Button>
                            )}
                            {!isSales && (isArchived ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setLeadToArchive(lead);
                                  setIsUnarchiveDialogOpen(true);
                                }}
                                title="Разархивировать"
                              >
                                <ArchiveRestore className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setLeadToArchive(lead);
                                  setIsArchiveDialogOpen(true);
                                }}
                                title="Архивировать"
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            ))}
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    title="Удалить"
                                    disabled={lead.status === 'cancelled'}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Удалить лид?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Запись будет удалена без возможности восстановления.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteLead(lead.id)} className="bg-red-600 hover:bg-red-700">Удалить</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {totalPages > 1 && (
          <div className="pb-4">
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              isLoading={isLoading}
            />
          </div>
        )}
      </Card >

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать лид</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Название лида</Label>
              <Input id="edit-title" placeholder="Введите название лида..." value={editLeadData.title} onChange={(e) => setEditLeadData({ ...editLeadData, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Описание</Label>
              <Textarea id="edit-description" placeholder="Напишите описание..." value={editLeadData.description} onChange={(e) => setEditLeadData({ ...editLeadData, description: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleUpdateLead}>
              {isSales ? 'Отправить на подтверждение' : 'Сохранить'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Назначить ответственного</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assignee-id">Ответственный</Label>
              <Popover open={isAssignUserOpen} onOpenChange={setIsAssignUserOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="assignee-id"
                    type="button"
                    variant="outline"
                    className="h-auto min-h-12 w-full justify-between px-4 py-3 text-left font-normal"
                  >
                    {assignLeadData.assignee_id ? (
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-slate-900">
                          {getUserDisplayName(getUserById(assignLeadData.assignee_id), assignLeadData.assignee_id)}
                        </span>
                        <span className="truncate text-xs text-slate-500">
                          {getUserRoleLabel(getUserById(assignLeadData.assignee_id)) || `ID: ${assignLeadData.assignee_id}`}
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-500">Выберите ответственного...</span>
                    )}
                    <UserPlus className="ml-3 h-4 w-4 shrink-0 text-slate-500" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[420px] max-w-[calc(100vw-2rem)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Поиск по ФИО, email, телефону..." />
                    <CommandList>
                      <CommandEmpty>Пользователь не найден.</CommandEmpty>
                      <CommandGroup>
                        {users.map((u) => (
                          <CommandItem
                            key={u.id}
                            value={getUserSearchValue(u)}
                            onSelect={() => {
                              setAssignLeadData({ ...assignLeadData, assignee_id: Number(u.id) });
                              setIsAssignUserOpen(false);
                            }}
                          >
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate font-medium">{getUserDisplayName(u)}</span>
                              <span className="truncate text-xs text-slate-500">
                                {[getUserRoleLabel(u), u.email, u.phone].filter(Boolean).join(" • ")}
                              </span>
                            </div>
                            <span className="ml-auto shrink-0 text-xs text-gray-400">ID: {u.id}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-comment">Комментарий</Label>
              <Textarea id="assign-comment" placeholder="Напишите комментарий..." value={assignLeadData.comment} onChange={(e) => setAssignLeadData({ ...assignLeadData, comment: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleAssignLead} disabled={!assignLeadData.assignee_id}>Назначить</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Конвертировать в сделку</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client-id">Клиент</Label>
              <div className="flex w-full items-center space-x-2">
                <Input
                  id="client-id"
                  type="number"
                  placeholder="ID клиента"
                  value={convertLeadData.client_id}
                  onChange={(e) => setConvertLeadData({ ...convertLeadData, client_id: e.target.value })}
                  className="flex-1"
                />
                <Popover open={isClientSelectOpen} onOpenChange={setIsClientSelectOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Users className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Поиск клиента..." />
                      <CommandList>
                        <CommandEmpty>Клиент не найден.</CommandEmpty>
                        <CommandGroup>
                          {clientsList.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.first_name || ""} ${c.last_name || ""} ${c.legal_profile?.company_name || ""} ${c.id}`}
                              onSelect={() => {
                                setConvertLeadData({ ...convertLeadData, client_id: c.id.toString() });
                                setIsClientSelectOpen(false);
                              }}
                            >
                              <span>
                                {c.first_name
                                  ? `${c.first_name} ${c.last_name || ""}`
                                  : (c.legal_profile?.company_name || c.name || `Client ${c.id}`)}
                              </span>
                              <span className="ml-auto text-xs text-gray-400">ID: {c.id}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Сумма</Label>
              <Input id="amount" type="number" placeholder="Введите сумму..." value={convertLeadData.amount} onChange={(e) => setConvertLeadData({ ...convertLeadData, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Валюта</Label>
              <CustomSelect
                value={convertLeadData.currency}
                onChange={(value) => setConvertLeadData({ ...convertLeadData, currency: value })}
                placeholder="Выберите валюту"
                options={[
                  { value: "KZT", label: "KZT - Тенге" },
                  { value: "USD", label: "USD - Доллар США" },
                  { value: "EUR", label: "EUR - Евро" },
                  { value: "RUB", label: "RUB - Рубль" },
                  { value: "CNY", label: "CNY - Юань" },
                ]}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setIsConvertDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleConvertLead}>Конвертировать</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изменить статус</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Текущий статус: {selectedLead && getStatusBadge(selectedLead.status)}</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-status">Новый статус</Label>
              <CustomSelect
                value={statusChangeData.to}
                onChange={(value) => setStatusChangeData({ ...statusChangeData, to: value })}
                placeholder="Выберите новый статус"
                options={selectedLead ? (statusTransitions[selectedLead.status as LeadStatus] || []).map((status) => ({
                  value: status,
                  label: statusTranslations[status]
                })) : []}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-comment">Комментарий</Label>
              <Textarea id="status-comment" placeholder="Напишите комментарий..." value={statusChangeData.comment} onChange={(e) => setStatusChangeData({ ...statusChangeData, comment: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleChangeStatus}>Изменить</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архивировать лид?</AlertDialogTitle>
            <AlertDialogDescription>
              Запись будет перемещена в архив. Её можно восстановить позже.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveLead}>Архивировать</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isUnarchiveDialogOpen} onOpenChange={setIsUnarchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Разархивировать лид?</AlertDialogTitle>
            <AlertDialogDescription>
              Запись будет возвращена из архива в активный список.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnarchiveLead}>Разархивировать</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Toaster />
    </>
  );
}
