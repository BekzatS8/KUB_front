"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { User } from "@/src/models/users.model";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomSelect } from "@/components/ui/custom-select";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Handshake,
  Plus,
  Search,
  Phone,
  Mail,
  Building,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Edit,
  Trash2,
  RefreshCw,
  Eye,
  Archive,
  ArchiveRestore,
  ChevronUp,
  ChevronsUpDown,
  Check,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  List,
} from "lucide-react";
import { getCurrentUser, getCurrentCompany, hasPermission, getRoleCode } from "@/lib/auth";
import { ArchiveFilter, ArchiveFilterValue } from "@/components/ui/archive-filter";
import { CollapsibleFilter } from "@/components/ui/collapsible-filter";
import { getMe } from "@/src/api/auth.api";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import * as ClientAPI from "@/src/api/clients.api"; // Import all as ClientAPI
import * as BranchesAPI from "@/src/api/branches.api";
import * as FeedAPI from "@/src/api/feed.api";
import * as FunnelsAPI from "@/src/api/funnels.api";
import { getMyPermissions } from "@/src/api/permissions.api";
import { KanbanBoard } from "@/components/deals/kanban-board";
import type { Funnel } from "@/src/models/funnels.model";
import type { FunnelBoardDeal } from "@/src/models/funnel-stages.model";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function DealsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusGroupFilter, setStatusGroupFilter] = useState("all");
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>("active");
  const [branchFilter, setBranchFilter] = useState<number | undefined>(undefined);
  const [availableBranches, setAvailableBranches] = useState<{ id: number, name: string }[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [deals, setDeals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [canWrite, setCanWrite] = useState(false);

  // Check if user has elevated role (leadership, control, system_admin)
  const isElevatedRole = () => {
    const roleCode = getRoleCode(user);
    return roleCode === 'leadership' || roleCode === 'control' || roleCode === 'system_admin';
  };
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  // Kanban view state
  const [viewMode, setViewMode] = useState<"kanban" | "table">("table");
  const [canViewFunnels, setCanViewFunnels] = useState(false);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);
  const [kanbanRefreshKey, setKanbanRefreshKey] = useState(0);

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isUnarchiveDialogOpen, setIsUnarchiveDialogOpen] = useState(false);
  const [dealToArchive, setDealToArchive] = useState<any>(null);

  // Current deal states
  const [currentDeal, setCurrentDeal] = useState<any>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  // Stage move from modal
  const [modalStages, setModalStages] = useState<any[]>([]);
  const [modalMoveStageId, setModalMoveStageId] = useState<string>("");
  const [isMovingStage, setIsMovingStage] = useState(false);

  // Form states
  const [newDeal, setNewDeal] = useState({
    lead_id: 0,
    client_id: 0,
    client_type: "individual",
    owner_id: 0,
    funnel_id: 0,
    amount: 0,
    currency: "KZT",
    status: "new",
  });

  const [editDeal, setEditDeal] = useState({
    lead_id: 0,
    client_id: 0,
    client_type: "individual",
    owner_id: 0,
    amount: 0,
    currency: "KZT",
    status: "new",
  });

  const extractList = (res: any): any[] => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.items)) return res.items;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.items)) return res.data.items;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    return [];
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

  // Fetch funnels + funnel permission for the kanban view
  useEffect(() => {
    if (!user) return;
    const loadFunnelsData = async () => {
      try {
        const permissionData = await getMyPermissions();
        const canView = Boolean(permissionData?.scopes?.["funnels.view"]);
        setCanViewFunnels(canView);
        if (!canView) return;

        const funnelData = await FunnelsAPI.listFunnels();
        const activeFunnels = (funnelData || []).filter((f) => f.is_active);
        setFunnels(activeFunnels.length ? activeFunnels : funnelData || []);

        const list = activeFunnels.length ? activeFunnels : funnelData || [];
        if (list.length > 0) {
          setSelectedFunnelId((prev) => prev ?? list[0].id);
          setViewMode("kanban");
        }
      } catch (err) {
        console.error("Error loading funnels for kanban view:", err);
        setCanViewFunnels(false);
      }
    };
    loadFunnelsData();
  }, [user]);

  // Fetch user data like sidebar does
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userData = await getMe();
        setUser(userData);
        // Use role.id and map it to role name like the sidebar does
        const userRole = getRoleCode(userData);
        const hasWriteAccess = userData && hasPermission(userRole, ["deals:write"]);
        setCanWrite(hasWriteAccess);
      } catch (error) {
        console.error("Failed to fetch user data", error);
        // Fallback to localStorage
        const localUser = getCurrentUser();
        setUser(localUser);
        const userRole = getRoleCode(localUser);
        setCanWrite(!!(localUser && hasPermission(userRole, ["deals:write"])));
      }
    };

    fetchUserData();
  }, []);

  const [statusUpdate, setStatusUpdate] = useState({
    to: "",
    comment: "",
  });

  // ─── Status transition rules ────────────────────────────────
  const FINAL_STATUSES = ["won", "lost", "cancelled"];

  const allowedTransitions: Record<string, string[]> = {
    new: ["in_progress", "negotiation", "won", "lost", "cancelled"],
    in_progress: ["negotiation", "won", "lost", "cancelled"],
    negotiation: ["won", "lost", "cancelled"],
    // won, lost, cancelled are final — no transitions
  };

  const statusLabelMap: Record<string, string> = {
    new: "Новая",
    in_progress: "В работе",
    negotiation: "Переговоры",
    won: "Выиграна",
    lost: "Проиграна",
    cancelled: "Отменена",
  };

  const isFinalStatus = (status: string) => FINAL_STATUSES.includes(status);

  const getTransitionOptions = (currentStatus: string) => {
    const allowed = allowedTransitions[currentStatus] || [];
    return allowed.map((s) => ({ value: s, label: statusLabelMap[s] || s }));
  };

  // Pagination & Search params
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const currentPage = Number(searchParams.get('page')) || 1;
  const limit = 15;
  const [totalDeals, setTotalDeals] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Initialize filter states from URL
  useEffect(() => {
    setStatusFilter(searchParams.get('status') || 'all');
    setStatusGroupFilter(searchParams.get('status_group') || 'all');
    setArchiveFilter((searchParams.get('archive') as ArchiveFilterValue) || 'active');
    setAmountMin(searchParams.get('amount_min') || '');
    setAmountMax(searchParams.get('amount_max') || '');
    setCurrencyFilter(searchParams.get('currency') || '');
    setClientFilter(searchParams.get('client_id') || '');
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
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (statusGroupFilter !== 'all') params.set('status_group', statusGroupFilter);
    if (archiveFilter !== 'active') params.set('archive', archiveFilter);
    if (amountMin) params.set('amount_min', amountMin);
    if (amountMax) params.set('amount_max', amountMax);
    if (currencyFilter) params.set('currency', currencyFilter);
    if (clientFilter) params.set('client_id', clientFilter);
    if (branchFilter) params.set('branch_id', String(branchFilter));
    params.set('sort_by', sortBy);
    params.set('order', sortOrder);
    router.push(`${pathname}?${params.toString()}`);
  };

  // Reset filters
  const resetFilters = () => {
    setStatusFilter('all');
    setStatusGroupFilter('all');
    setAmountMin('');
    setAmountMax('');
    setCurrencyFilter('');
    setClientFilter('');
    setBranchFilter(undefined);
    setSortBy('created_at');
    setSortOrder('desc');
    setSearchTerm('');
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
  }, [statusFilter, statusGroupFilter, archiveFilter, amountMin, amountMax, currencyFilter, clientFilter, sortBy, sortOrder, branchFilter]);

  const fetchDeals = async () => {
    setIsLoading(true);
    try {
      const { list_deals, list_my_deals } = await import("@/src/api/deals.api");
      const params: any = { page: currentPage, size: limit };
      if (searchTerm) params.q = searchTerm;
      if (statusFilter !== "all") params.status = statusFilter;
      if (statusGroupFilter !== "all") params.status_group = statusGroupFilter;
      if (archiveFilter !== "active") params.archive = archiveFilter;
      if (amountMin) params.amount_min = amountMin;
      if (amountMax) params.amount_max = amountMax;
      if (currencyFilter) params.currency = currencyFilter;
      if (clientFilter) params.client_id = clientFilter;
      if (branchFilter) params.branch_id = branchFilter;
      params.sort_by = sortBy;
      params.order = sortOrder;

      // Get current user data directly to ensure we have the latest role
      const currentUser = getCurrentUser();
      const userRole = getRoleCode(currentUser) || getRoleCode(user);

      console.log('User role check:', {
        currentUser,
        currentUserRole: getRoleCode(currentUser),
        currentUserRoleId: currentUser?.role_id,
        stateUserRole: getRoleCode(user),
        stateUserId: user?.role_id,
        userRole
      });

      // Backend allows the full deals endpoint for every non-sales role; sales must use /deals/my.
      const effectiveView = userRole === 'sales' ? 'my' : 'all';

      console.log('fetchDeals called:', {
        userRole,
        currentUserRole: getRoleCode(currentUser),
        stateUserRole: getRoleCode(user),
        effectiveView,
        endpoint: effectiveView === "all" ? '/deals' : '/deals/my'
      });

      // Use effectiveView as finalView (no extra safeguard needed)
      const finalView = effectiveView;

      const res = finalView === "all"
        ? await list_deals(undefined, params)
        : await list_my_deals(undefined, params);
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

      setDeals(data);
      setTotalDeals(total);
      setTotalPages(totalPagesFromBackend);
    } catch (err: any) {
      console.error("Error loading deals:", err);
      setError(err?.message || "Ошибка при загрузке сделок");
      toast.error("Ошибка при загрузке сделок");
    } finally {
      setIsLoading(false);
    }
  };

  const ComboboxSelect = ({
    value,
    onChange,
    options,
    placeholder = "Выберите...",
    searchPlaceholder = "Поиск...",
    emptyText = "Ничего не найдено",
    disabled = false
  }: {
    value: string | number;
    onChange: (value: string) => void;
    options: { value: string; label: string; searchValue?: string }[];
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    disabled?: boolean;
  }) => {
    const [open, setOpen] = useState(false);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between font-normal bg-background px-3 py-2 text-sm border-input border rounded-xl h-10 hover:bg-accent hover:text-accent-foreground", !value && "text-muted-foreground")}
            disabled={disabled}
          >
            <span className="truncate">
              {value
                ? options.find((option) => option.value === value.toString())?.label
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-white p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-[min(18rem,calc(100vh-8rem))] touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]">
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.searchValue || option.label}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.toString() === option.value ? "opacity-100" : "opacity-0"
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
    );
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  // Fetch meta data (dictionaries) on component mount
  useEffect(() => {
    const loadMeta = async () => {
      try {
        console.log('=== LOAD META START ===');
        let userData = getCurrentUser();
        const companyData = getCurrentCompany();
        
        console.log('loadMeta - userData:', userData);
        console.log('loadMeta - companyData:', companyData);

        // Temporary fix: if user data is missing but token exists, try to get user data
        if (!userData) {
          console.log('User data is null, checking for token...');
          const token = localStorage.getItem("auth_token");
          console.log('Token exists:', !!token);
          if (token && companyData) {
            // Create minimal user data from company data
            const tempUser = {
              id: companyData.id.toString(),
              full_name: companyData.name,
              email: companyData.email || '',
              phone: companyData.phone || '',
              role: { id: 10, code: 'sales', legacy_name: 'sales' },
              company_name: companyData.name,
              role_id: 10,
              is_verified: true,
              status: 'active'
            };
            userData = tempUser; // Use this data for API calls
          }
        }

        if (!userData) {
          // router.push("/auth/login"); // Temporarily disabled to test redirect issue
          console.log("User data missing, but continuing anyway for testing");
          return;
        }

        console.log("User data found, proceeding with API calls...");
        setUser(userData);
        setCompany(companyData);

        // Load clients (for dropdown)
        try {
          // Apply same safety fix: default to listMyClients for sales users or undefined roles
          const userRole = getRoleCode(userData);
          const isSalesRole = userRole === 'sales';
          
          console.log('Loading clients for user:', { userRole, isSalesRole });
          
          const res = isSalesRole
            ? await ClientAPI.listMyClients({ page: 1, size: 1000 })
            : await ClientAPI.listClients({ page: 1, size: 1000 });
          console.log('Clients API response:', res);
          const clientsData = extractList(res);
          setClients(clientsData);
          console.log('Clients loaded:', clientsData.length);
        } catch (err: any) {
          console.error("Error loading clients:", err);
          console.error("Client error details:", {
            message: err?.message,
            status: err?.response?.status,
            statusText: err?.response?.statusText,
            data: err?.response?.data
          });
          // Fallback to listMyClients if listClients fails
          try {
            console.log('Falling back to listMyClients');
            const res = await ClientAPI.listMyClients({ page: 1, size: 1000 });
            console.log('Fallback clients API response:', res);
            const clientsData = extractList(res);
            setClients(clientsData);
            console.log('Clients loaded via fallback:', clientsData.length);
          } catch (fallbackErr: any) {
            console.error("Fallback also failed:", fallbackErr);
            console.error("Fallback error details:", {
              message: fallbackErr?.message,
              status: fallbackErr?.response?.status,
              statusText: fallbackErr?.response?.statusText,
              data: fallbackErr?.response?.data
            });
          }
        }

        // Load leads (for dropdown)
        try {
          console.log('=== DEALS PAGE: Starting leads load ===');
          const { list_leads, list_my_leads } = await import("@/src/api/leads.api");
          
          // Get current user to determine which API to use
          const currentUser = getCurrentUser();
          console.log('Deals page - loading leads for user:', currentUser?.role);
          console.log('Current user object:', currentUser);
          
          // Use list_my_leads for non-system_admin/leadership users, with fallback for 403 errors
          let leadsRes;
          const roleCode = getRoleCode(currentUser) || getRoleCode(userData);
          if (roleCode === 'system_admin' || roleCode === 'leadership') {
            try {
              console.log('Attempting to use list_leads for system_admin/leadership user');
              leadsRes = await list_leads(undefined, { page: 1, size: 1000, status_group: "active" });
              console.log('list_leads response:', leadsRes);
            } catch (leadsError: any) {
              if (leadsError?.response?.status === 403) {
                console.log('list_leads returned 403, falling back to list_my_leads for restricted user');
                leadsRes = await list_my_leads(undefined, { page: 1, size: 1000, status_group: "active" });
                console.log('Fallback list_my_leads response:', leadsRes);
              } else {
                throw leadsError;
              }
            }
          } else {
            console.log('Using list_my_leads for non-system_admin/leadership user (sales/restricted)');
            leadsRes = await list_my_leads(undefined, { page: 1, size: 1000, status_group: "active" });
            console.log('list_my_leads response:', leadsRes);
          }
            
          const leadsData = extractList(leadsRes);
          console.log('Processed leads data:', leadsData);
          console.log('Leads data type:', Array.isArray(leadsData) ? 'array' : typeof leadsData);
          console.log('Leads data length:', leadsData.length);
          
          setLeads(leadsData);
          console.log('Leads loaded:', leadsData.length, 'leads');
          console.log('=== DEALS PAGE: Leads load completed ===');
        } catch (err) {
          console.error("Error loading leads:", err);
        }

        // Load users (for responsible) - only for system_admin/leadership
        const metaRoleCode = getRoleCode(userData);
        if (userData && (metaRoleCode === "system_admin" || metaRoleCode === "leadership")) {
          try {
            const { listUsers } = await import("@/src/api/users.api");
            const res = await listUsers();
            console.log('Users API response:', res);
            const usersData = extractList(res);
            setUsers(usersData);
            console.log('Users loaded:', usersData.length);
          } catch (err: any) {
            console.error("Error loading users:", err);
            console.error("Users error details:", {
              message: err?.message,
              status: err?.response?.status,
              statusText: err?.response?.statusText,
              data: err?.response?.data
            });
            // Fallback: at least include the current user
            if (userData) {
              const currentUserForDropdown = {
                id: typeof userData.id === 'string' ? parseInt(userData.id) : userData.id,
                full_name: userData.full_name || userData.company_name || '',
                first_name: userData.first_name || '',
                last_name: userData.last_name || '',
                middle_name: userData.middle_name || '',
                company_name: userData.company_name || '',
                email: userData.email,
                role: userData.role
              };
              setUsers([currentUserForDropdown]);
              console.log('Using current user as fallback for responsible dropdown');
            }
          }
        } else {
          // For non-system_admin/leadership users, only include current user in dropdown
          if (userData) {
            const currentUserForDropdown = {
              id: typeof userData.id === 'string' ? parseInt(userData.id) : userData.id,
              full_name: userData.full_name || userData.company_name || '',
              first_name: userData.first_name || '',
              last_name: userData.last_name || '',
              middle_name: userData.middle_name || '',
              company_name: userData.company_name || '',
              email: userData.email,
              role: userData.role
            };
            setUsers([currentUserForDropdown]);
            console.log('Using current user only for responsible dropdown (role-based restriction)');
          }
        }

      } catch (error) {
        console.error("Error in loadMeta:", error);
      }
    };

    loadMeta();
  }, [router]);

  // Fetch deals on params change
  useEffect(() => {
    // Only fetch deals if we have a user
    if (user) {
      fetchDeals();
    }
  }, [currentPage, statusFilter, statusGroupFilter, archiveFilter, amountMin, amountMax, currencyFilter, clientFilter, branchFilter, sortBy, sortOrder, user]);

  // Update URL when filters change
  useEffect(() => {
    updateURL();
  }, [statusFilter, statusGroupFilter, archiveFilter, amountMin, amountMax, currencyFilter, clientFilter, branchFilter, sortBy, sortOrder]);

  // Debug state changes
  useEffect(() => {
    console.log('=== STATE DEBUG ===');
    console.log('Clients:', clients);
    console.log('Users:', users);
    console.log('Leads:', leads);
    console.log('Clients length:', clients.length);
    console.log('Users length:', users.length);
    console.log('Leads length:', leads.length);
    console.log('=== STATE DEBUG END ===');
  }, [clients, users, leads]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      // Only fetch if user is loaded
      if (user) {
        fetchDeals();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, user]);

  // Reset new deal form
  const resetNewDealForm = () => {
    setNewDeal({
      lead_id: 0,
      client_id: 0,
      client_type: "individual",
      owner_id: user?.id ? parseInt(user.id) : 0,
      funnel_id: selectedFunnelId || 0,
      amount: 0,
      currency: "KZT",
      status: "new",
    });
  };

  // Refresh leads function
  const refreshLeads = async () => {
    console.log('=== MANUAL LEADS REFRESH ===');
    try {
      const { list_leads, list_my_leads } = await import("@/src/api/leads.api");
      
      const currentUser = getCurrentUser();
      console.log('Manual refresh - current user role:', currentUser?.role);
      
      // Use list_my_leads for non-system_admin/leadership users to avoid 403 errors
      let leadsRes;
      const roleCode = getRoleCode(currentUser) || getRoleCode(user);
      if (roleCode === 'system_admin' || roleCode === 'leadership') {
        console.log('MANUAL REFRESH: Using list_leads for system_admin/leadership user');
        leadsRes = await list_leads(undefined, { page: 1, size: 1000, status_group: "active" });
      } else {
        console.log('MANUAL REFRESH: Using list_my_leads for non-system_admin/leadership user (sales/restricted)');
        leadsRes = await list_my_leads(undefined, { page: 1, size: 1000, status_group: "active" });
      }
        
      const leadsData = extractList(leadsRes);
      console.log('Manual refresh - leads loaded:', leadsData.length);
      setLeads(leadsData);
    } catch (err) {
      console.error("Manual refresh error:", err);
    }
  };

  // Open create dialog
  const openCreateDialog = () => {
    resetNewDealForm();
    setIsCreateDialogOpen(true);
    // Debug: check current state when opening dialog
    console.log('=== OPENING CREATE DIALOG ===');
    console.log('Current clients state:', clients);
    console.log('Current users state:', users);
    console.log('Current leads state:', leads);
    console.log('Clients length:', clients.length);
    console.log('Users length:', users.length);
    console.log('Leads length:', leads.length);
    console.log('=== OPENING CREATE DIALOG END ===');
    
    // Debug: manually refresh leads when opening dialog
    console.log('Opening create dialog - refreshing leads...');
    refreshLeads();
  };

  // Open edit dialog
  const openEditDialog = (deal: any) => {
    const dealClient = clients.find(c => String(c.id) === String(deal.client_id));
    setCurrentDeal(deal);
    setEditDeal({
      lead_id: deal.lead_id || 0,
      client_id: deal.client_id || 0,
      client_type: deal.client_type || getClientType(dealClient) || "individual",
      owner_id: deal.owner_id || (user?.id ? parseInt(user.id) : 0),
      amount: Number(deal.amount) || 0,
      currency: deal.currency || "KZT",
      status: deal.status || "new",
    });
    setIsEditDialogOpen(true);
  };

  // Open view dialog
  const openViewDialog = (deal: any) => {
    setCurrentDeal(deal);
    setModalMoveStageId("");
    setModalStages([]);
    setIsViewDialogOpen(true);
    if (deal?.funnel_id) {
      import("@/src/api/funnel-stages.api").then(({ listFunnelStages }) => {
        listFunnelStages(deal.funnel_id).then((stages) => {
          setModalStages(stages || []);
        }).catch(() => {});
      });
    }
  };

  const handleModalMoveStage = async () => {
    if (!currentDeal?.id || !modalMoveStageId) return;
    setIsMovingStage(true);
    try {
      const { move_deal_stage } = await import("@/src/api/deals.api");
      await move_deal_stage({ stage_id: Number(modalMoveStageId) }, { id: currentDeal.id });
      toast.success("Сделка перемещена на новый этап");
      setIsViewDialogOpen(false);
      setKanbanRefreshKey((k) => k + 1);
      fetchDeals();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Ошибка при перемещении");
    } finally {
      setIsMovingStage(false);
    }
  };

  // Open status update dialog
  const openStatusDialog = (deal: any) => {
    setSelectedDealId(deal.id);
    setCurrentDeal(deal);
    setStatusUpdate({
      to: "",
      comment: "",
    });
    setIsStatusDialogOpen(true);
  };

  const handleArchiveDeal = async () => {
    if (!dealToArchive) return;
    try {
      const { archive_deal } = await import("@/src/api/deals.api");
      await archive_deal(undefined, { id: dealToArchive.id });
      toast.success("Сделка успешно заархивирована");
      await fetchDeals();
    } catch (err: any) {
      console.error("Ошибка архивации сделки:", err);
      toast.error(err?.message || "Ошибка при архивации");
    } finally {
      setIsArchiveDialogOpen(false);
      setDealToArchive(null);
    }
  };

  const handleUnarchiveDeal = async () => {
    if (!dealToArchive) return;
    try {
      const { unarchive_deal } = await import("@/src/api/deals.api");
      await unarchive_deal(undefined, { id: dealToArchive.id });
      toast.success("Сделка успешно разархивирована");
      await fetchDeals();
    } catch (err: any) {
      console.error("Ошибка разархивации сделки:", err);
      toast.error(err?.message || "Ошибка при разархивации");
    } finally {
      setIsUnarchiveDialogOpen(false);
      setDealToArchive(null);
    }
  };

  const isAdmin = getRoleCode(user) === 'system_admin';
  const isSales = getRoleCode(user) === 'sales';

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      new: { label: "Новая", className: "bg-blue-100 text-blue-800" },
      in_progress: { label: "В работе", className: "bg-yellow-100 text-yellow-800" },
      negotiation: { label: "Переговоры", className: "bg-purple-100 text-purple-800" },
      won: { label: "Выиграна", className: "bg-green-100 text-green-800" },
      lost: { label: "Проиграна", className: "bg-red-100 text-red-800" },
      cancelled: { label: "Отменена", className: "bg-gray-100 text-gray-800" },
    };

    const config = statusConfig[status] || { label: status, className: "bg-gray-100 text-gray-700" };
    return (
      <Badge className={`${config.className} text-xs`}>
        {config.label}
      </Badge>
    );
  };

  // Get status color for progress
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-blue-500",
      in_progress: "bg-yellow-500",
      won: "bg-green-500",
      lost: "bg-red-500",
      cancelled: "bg-gray-500",
    };
    return colors[status] || "bg-blue-500";
  };

  // Handle create deal
  const handleCreateDeal = async () => {
    if (!newDeal.lead_id) {
      toast.error("Выберите лид");
      return;
    }
    if (!newDeal.client_id) {
      toast.error("Выберите клиента");
      return;
    }
    if (!newDeal.amount || newDeal.amount <= 0) {
      toast.error("Введите сумму больше 0");
      return;
    }

    const payload = {
      lead_id: Number(newDeal.lead_id),
      client_id: Number(newDeal.client_id),
      client_type: newDeal.client_type || "individual",
      owner_id: newDeal.owner_id ? Number(newDeal.owner_id) : undefined,
      funnel_id: newDeal.funnel_id ? Number(newDeal.funnel_id) : undefined,
      amount: Number(newDeal.amount),
      currency: newDeal.currency || "KZT",
      status: newDeal.status || "new",
    };

    if (isSales) {
      // Sales users: send to admin approval feed
      try {
        await FeedAPI.createFeedEvent({ type: 'pending_create_deal', payload });
        resetNewDealForm();
        toast.success("Запрос на создание сделки отправлен администратору на подтверждение");
      } catch (err: any) {
        toast.error(`Ошибка отправки запроса: ${err?.message || 'Unknown error'}`);
      } finally {
        setIsCreateDialogOpen(false);
      }
      return;
    }

    // Non-sales: create directly
    try {
      setIsLoading(true);
      const { create_deal } = await import("@/src/api/deals.api");
      const res = await create_deal(payload as any);
      const createdDeal = res?.data || res;
      setDeals(prev => [createdDeal, ...prev]);
      resetNewDealForm();
      toast.success("Сделка успешно создана");
    } catch (err: any) {
      console.error("Error creating deal:", err);
      const errorMsg = err?.response?.data?.message || err?.message || "Ошибка при создании сделки";
      if (err?.response?.status === 409) {
        toast.error("Этот лид уже имеет связанную сделку. Выберите другой лид.");
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setIsCreateDialogOpen(false);
      setIsLoading(false);
    }
  };

  // Handle update deal
  const handleUpdateDeal = async () => {
    if (!currentDeal?.id) return;

    const payload = {
      lead_id: editDeal.lead_id ? Number(editDeal.lead_id) : undefined,
      client_id: editDeal.client_id ? Number(editDeal.client_id) : undefined,
      client_type: editDeal.client_type || "individual",
      owner_id: editDeal.owner_id ? Number(editDeal.owner_id) : undefined,
      amount: Number(editDeal.amount),
      currency: editDeal.currency || "KZT",
      status: editDeal.status || "new",
    };

    if (isSales) {
      // Sales users: send edit request to admin approval feed
      try {
        await FeedAPI.createFeedEvent({
          type: 'pending_edit_deal',
          payload,
          resource_id: currentDeal.id,
        });
        setCurrentDeal(null);
        toast.success("Запрос на редактирование сделки отправлен администратору на подтверждение");
      } catch (err: any) {
        toast.error(`Ошибка отправки запроса: ${err?.message || 'Unknown error'}`);
      } finally {
        setIsEditDialogOpen(false);
      }
      return;
    }

    // Non-sales: update directly
    try {
      setIsLoading(true);
      const { update_deal } = await import("@/src/api/deals.api");
      await update_deal(payload as any, { id: currentDeal.id });
      setDeals(prev => prev.map(deal =>
        deal.id === currentDeal.id ? { ...deal, ...payload } : deal
      ));
      setCurrentDeal(null);
      toast.success("Сделка успешно обновлена");
    } catch (err: any) {
      console.error("Error updating deal:", err);
      toast.error(err?.message || "Ошибка при обновлении сделки");
    } finally {
      setIsEditDialogOpen(false);
      setIsLoading(false);
    }
  };

  // Handle delete deal
  const handleDeleteDeal = async (dealId: string) => {
    try {
      setIsLoading(true);
      const { delete_deal } = await import("@/src/api/deals.api");

      await delete_deal(undefined, { id: dealId });

      // Update local state
      setDeals(prev => prev.filter(deal => deal.id !== dealId));
      toast.success("Сделка успешно удалена");
    } catch (err: any) {
      console.error("Error deleting deal:", err);
      const errorMsg = err?.response?.data?.message || err?.message || 'Unknown error';
      if (errorMsg.includes('foreign key') || errorMsg.includes('constraint') || errorMsg.includes('violates') || err?.response?.status === 500) {
        toast.error("Невозможно удалить сделку, так как она связана с другими записями (документы, задачи). Сначала удалите связанные записи или используйте архивацию.");
      } else {
        toast.error(`Ошибка при удалении сделки: ${errorMsg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle status update
  const handleStatusUpdate = async () => {
    if (!selectedDealId || !statusUpdate.to) return;

    try {
      setIsLoading(true);
      const { update_deal_status } = await import("@/src/api/deals.api");

      const payload: { to: string; comment?: string } = {
        to: statusUpdate.to,
      };
      if (statusUpdate.comment?.trim()) {
        payload.comment = statusUpdate.comment.trim();
      }

      await update_deal_status(payload as any, { id: selectedDealId });

      setSelectedDealId(null);
      setStatusUpdate({ to: "", comment: "" });
      toast.success("Статус сделки обновлен");

      // Re-fetch deals to pick up the new status from the server
      await fetchDeals();
    } catch (err: any) {
      console.error("Error updating deal status:", err);
      toast.error(err?.message || "Ошибка при обновлении статуса");
    } finally {
      setIsStatusDialogOpen(false);
      setIsLoading(false);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    // Get current user data directly
    const currentUser = getCurrentUser();
    const userRole = currentUser?.role || user?.role;
    
    console.log('handleRefresh called:', { 
      userRole,
      currentUserRole: currentUser?.role,
      stateUserRole: user?.role,
      userLoaded: !!(currentUser || user)
    });
    
    // Ensure user is loaded before refreshing
    if (!currentUser && !user) {
      console.log('User not loaded, skipping refresh');
      return;
    }
    
    fetchDeals();
    // Refresh meta if needed
    try {
      const userData = getCurrentUser();
      if (userData) {
        const roleCode = getRoleCode(userData);
        const res = roleCode === "system_admin" || roleCode === "leadership"
          ? await ClientAPI.listClients({ page: 1, size: 1000 })
          : await ClientAPI.listMyClients({ page: 1, size: 1000 });
        const clientsData = extractList(res);
        setClients(clientsData);
      }
      toast.success("Данные обновлены");
    } catch (err) {
      console.error(err);
    }
  };

  const getCleanText = (value: unknown) => {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  };

  const getClientType = (client?: Record<string, any>) => {
    return getCleanText(client?.client_type) || "individual";
  };

  const getClientDisplayName = (client?: Record<string, any>) => {
    if (!client) return "";

    if (getClientType(client) === "legal") {
      return (
        getCleanText(client.legal_profile?.company_name) ||
        getCleanText(client.name) ||
        getCleanText(client.display_name) ||
        getCleanText(client.contact_info) ||
        getCleanText(client.email) ||
        getCleanText(client.id)
      );
    }

    const nameParts = [
      client.individual_profile?.last_name || client.last_name,
      client.individual_profile?.first_name || client.first_name,
      client.individual_profile?.middle_name || client.middle_name,
    ].map(getCleanText).filter(Boolean);

    if (nameParts.length) return nameParts.join(" ");

    return (
      getCleanText(client.display_name) ||
      getCleanText(client.name) ||
      getCleanText(client.email) ||
      getCleanText(client.phone) ||
      getCleanText(client.id)
    );
  };

  const getClientSearchValue = (client: Record<string, any>) => [
    getClientDisplayName(client),
    client.display_name,
    client.name,
    client.legal_profile?.company_name,
    client.legal_profile?.contact_person_name,
    client.individual_profile?.last_name,
    client.individual_profile?.first_name,
    client.individual_profile?.middle_name,
    client.last_name,
    client.first_name,
    client.middle_name,
    client.bin_iin,
    client.legal_profile?.bin,
    client.iin,
    client.individual_profile?.iin,
    client.phone,
    client.primary_phone,
    client.email,
    client.primary_email,
  ].map(getCleanText).filter(Boolean).join(" ");

  const getClientOptions = (clientType?: string) => clients
    .filter((client) => !clientType || getClientType(client) === clientType)
    .map((client) => ({
      value: client.id.toString(),
      label: getClientDisplayName(client),
      searchValue: getClientSearchValue(client),
    }));

  // Get client name by ID
  const getClientName = (clientId: number) => {
    const client = clients.find(c => String(c.id) === String(clientId));
    return client ? getClientDisplayName(client) : `Клиент #${clientId}`;
  };

  const getUserDisplayName = (u?: Partial<User> & Record<string, any>) => {
    if (!u) return "";

    const fullName = getCleanText(u.full_name || u.fullName);
    if (fullName) return fullName;

    const nameParts = [
      u.last_name || u.lastName,
      u.first_name || u.firstName,
      u.middle_name || u.middleName,
    ].map(getCleanText).filter(Boolean);

    if (nameParts.length) return nameParts.join(" ");

    return (
      getCleanText(u.company_name || u.legacy?.company_name) ||
      getCleanText(u.email) ||
      getCleanText(u.id)
    );
  };

  const getUserSearchValue = (u: Partial<User> & Record<string, any>) => [
    getUserDisplayName(u),
    u.email,
    u.company_name,
    u.legacy?.company_name,
  ].map(getCleanText).filter(Boolean).join(" ");

  const getUserLabel = (userId: number) => {
    const u = users.find(user => String(user.id) === String(userId));
    return u ? getUserDisplayName(u) : `Пользователь #${userId}`;
  };

  // Get lead title by ID
  const getLeadTitle = (leadId: number) => {
    const lead = leads.find(l => l.id === leadId);
    return lead ? lead.title : `Лид #${leadId}`;
  };

  // Calculate statistics
  const stats = {
    total: totalDeals,
    totalValue: deals.reduce((sum, deal) => sum + (Number(deal.amount) || 0), 0),
    active: deals.filter(d => !["won", "lost", "cancelled"].includes(d.status)).length,
    won: deals.filter(d => d.status === "won").length,
  };

  if (isLoading && (!deals || deals.length === 0)) {
    return (
      <>
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-4 w-64 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-12 mb-6" />
        <Skeleton className="h-96" />
      </>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between m-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Сделки
          </h1>
          <p className="text-gray-600">
            Управление активными сделками
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canViewFunnels && funnels.length > 0 && (
            <div className="flex items-center rounded-md border bg-white p-0.5">
              <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                size="sm"
                className="h-8"
                onClick={() => setViewMode("kanban")}
              >
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                Канбан
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                className="h-8"
                onClick={() => setViewMode("table")}
              >
                <List className="h-4 w-4 mr-1.5" />
                Таблица
              </Button>
            </div>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          {canWrite && (
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Новая сделка
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.total}
                </div>
                <p className="text-sm text-gray-600">Всего сделок</p>
              </div>
              <Handshake className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {stats.totalValue.toLocaleString()} ₸
                </div>
                <p className="text-sm text-gray-600">Общая стоимость</p>
              </div>
              <Building className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {stats.active}
                </div>
                <p className="text-sm text-gray-600">Активных</p>
              </div>
              <CheckCircle className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {stats.won}
                </div>
                <p className="text-sm text-gray-600">Выиграно</p>
              </div>
              <FileText className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban view */}
      {viewMode === "kanban" && canViewFunnels && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Воронка продаж</CardTitle>
                <CardDescription>Перетащите карточку, чтобы изменить этап сделки</CardDescription>
              </div>
              {funnels.length > 1 && (
                <div className="w-full sm:w-64">
                  <CustomSelect
                    value={selectedFunnelId ? String(selectedFunnelId) : ""}
                    onChange={(value) => setSelectedFunnelId(Number(value))}
                    placeholder="Выберите воронку"
                    className="w-full"
                    options={funnels.map((f) => ({ value: String(f.id), label: f.name }))}
                  />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedFunnelId ? (
              <KanbanBoard
                funnelId={selectedFunnelId}
                canMove={canWrite}
                onDealClick={(deal: FunnelBoardDeal) => openViewDialog(deal)}
                refreshKey={kanbanRefreshKey}
              />
            ) : (
              <p className="text-sm text-gray-500">Нет доступных воронок</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      {viewMode === "table" && (
      <>
      <CollapsibleFilter defaultOpen={false}>
        <Card className="overflow-visible">
          <CardContent className="p-4 overflow-visible">
            <div className="flex flex-col gap-4 overflow-visible">
              {/* Primary filters row */}
              <div className="flex flex-col lg:flex-row gap-4 overflow-visible">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Поиск по клиенту, ИИН/БИН, телефону, email, сумме..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-full sm:w-48 overflow-visible">
                  <CustomSelect
                    value={statusFilter}
                    onChange={setStatusFilter}
                    placeholder="Статус"
                    className="w-full"
                    options={[
                      { value: "all", label: "Все статусы" },
                      { value: "new", label: "Новая" },
                      { value: "in_progress", label: "В работе" },
                      { value: "negotiation", label: "Переговоры" },
                      { value: "won", label: "Выиграна" },
                      { value: "lost", label: "Проиграна" },
                      { value: "cancelled", label: "Отменена" },
                    ]}
                  />
                </div>
                <div className="w-full sm:w-48 overflow-visible">
                  <CustomSelect
                    value={statusGroupFilter}
                    onChange={setStatusGroupFilter}
                    placeholder="Группа статусов"
                    className="w-full"
                    options={[
                      { value: "all", label: "Все группы" },
                      { value: "active", label: "Активные" },
                      { value: "completed", label: "Завершенные" },
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
                        { value: "amount", label: "Сумма" },
                        { value: "status", label: "Статус" },
                        { value: "client_name", label: "Имя клиента" },
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
              {/* Secondary filters row */}
              <div className="flex flex-col lg:flex-row gap-4 overflow-visible">
                <div className="w-full sm:w-32 overflow-visible">
                  <Input
                    placeholder="Сумма от"
                    type="number"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="w-full sm:w-32 overflow-visible">
                  <Input
                    placeholder="Сумма до"
                    type="number"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="w-full sm:w-40 overflow-visible">
                  <CustomSelect
                    value={currencyFilter}
                    onChange={setCurrencyFilter}
                    placeholder="Валюта"
                    className="w-full"
                    options={[
                      { value: "", label: "Все валюты" },
                      { value: "KZT", label: "KZT" },
                      { value: "USD", label: "USD" },
                      { value: "EUR", label: "EUR" },
                      { value: "RUB", label: "RUB" },
                    ]}
                  />
                </div>
                <div className="w-full sm:w-48 overflow-visible">
                  <ComboboxSelect
                    value={clientFilter}
                    onChange={setClientFilter}
                    placeholder="Клиент"
                    searchPlaceholder="Поиск клиента..."
                    emptyText="Клиент не найден"
                    options={getClientOptions()}
                  />
                </div>
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
              </div>
            </div>
          </CardContent>
        </Card>
      </CollapsibleFilter>

      {/* Deals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Список сделок</CardTitle>
          <CardDescription>
            {deals?.length ? `Найдено ${deals.length} сделок` : "Сделки не найдены"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <Table className="w-full table-fixed">
              <colgroup>
                <col className="w-[6%]" />
                <col className="w-[19%]" />
                <col className="w-[17%]" />
                <col className="w-[11%]" />
                <col className="w-[8%]" />
                <col className="w-[16%]" />
                <col className="w-[10%]" />
                <col className="w-[13%]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">ID</TableHead>
                  <TableHead className="px-4">Клиент</TableHead>
                  <TableHead className="px-4">Лид</TableHead>
                  <TableHead className="px-4">Сумма</TableHead>
                  <TableHead className="px-4">Валюта</TableHead>
                  <TableHead className="px-4">Статус</TableHead>
                  <TableHead className="px-4">Дата</TableHead>
                  <TableHead className="px-4 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!deals || deals.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      Нет сделок
                    </TableCell>
                  </TableRow>
                ) : (
                  deals.map((deal) => {
                    const isArchived = deal.archived || deal.is_archived;
                    return (
                      <TableRow key={deal.id} className={isArchived ? "bg-gray-200" : ""}>
                        <TableCell className="px-4 align-top font-mono text-sm">#{deal.id}</TableCell>
                        <TableCell className="px-4 align-top">
                          <div className="break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                            {deal.client_id ? getClientName(deal.client_id) : "Без клиента"}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          <div className="break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                            {deal.lead_id ? getLeadTitle(deal.lead_id) : "Без лида"}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          <div className="font-medium">
                            {Number(deal.amount || 0).toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          <Badge variant="outline">{deal.currency || "KZT"}</Badge>
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          <div className="flex flex-col items-start gap-1">
                            {getStatusBadge(deal.status)}
                            {isArchived && (
                              <Badge className="bg-gray-100 text-gray-800 text-xs">Архив</Badge>
                            )}
                            <div className="w-full max-w-24">
                              <Progress
                                value={
                                  deal.status === "new" ? 20 :
                                    deal.status === "in_progress" ? 50 :
                                      deal.status === "won" ? 100 :
                                        deal.status === "lost" ? 100 :
                                          deal.status === "cancelled" ? 100 : 10
                                }
                                className={`h-2 ${getStatusColor(deal.status)}`}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          {deal.created_at ? (
                            <div className="flex items-center whitespace-nowrap text-sm">
                              <Calendar className="mr-1 h-3 w-3 shrink-0 text-gray-400" />
                              {format(new Date(deal.created_at), "dd.MM.yyyy", { locale: ru })}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openViewDialog(deal)}
                              title="Просмотр"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canWrite && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(deal)}
                                title="Редактировать"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {!isFinalStatus(deal.status) && !isArchived && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openStatusDialog(deal)}
                                title="Изменить статус"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                            {!isSales && (isArchived ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setDealToArchive(deal);
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
                                  setDealToArchive(deal);
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
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Удалить сделку?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Запись будет удалена без возможности восстановления.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteDeal(deal.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Удалить
                                    </AlertDialogAction>
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
      </>
      )}

      {/* Create Deal Dialog */}
      < Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} >
        <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl max-h-[calc(100dvh-1rem)] overflow-y-auto touch-pan-y p-4 sm:p-6 [-webkit-overflow-scrolling:touch]">
          <DialogHeader>
            <DialogTitle>Создать новую сделку</DialogTitle>
            <DialogDescription>
              Заполните информацию о новой сделке
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {canViewFunnels && funnels.length > 0 && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="new_funnel_id">Воронка</Label>
                <CustomSelect
                  value={newDeal.funnel_id ? String(newDeal.funnel_id) : ""}
                  onChange={(value) => setNewDeal({ ...newDeal, funnel_id: Number(value) || 0 })}
                  placeholder="Выберите воронку (необязательно)"
                  options={[
                    { value: "", label: "Без воронки" },
                    ...funnels.map((f) => ({ value: String(f.id), label: f.name })),
                  ]}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="lead_id">Лид <span className="text-red-500">*</span></Label>
              <ComboboxSelect
                value={newDeal.lead_id?.toString() || ""}
                onChange={(value) =>
                  setNewDeal({ ...newDeal, lead_id: parseInt(value) || 0 })
                }
                placeholder="Выберите лид"
                searchPlaceholder="Поиск лида..."
                emptyText="Лид не найден"
                options={leads.map((lead) => ({
                  value: lead.id.toString(),
                  label: lead.title || `Лид #${lead.id}`
                }))}
              />
              {!newDeal.lead_id && (
                <p className="text-xs text-red-500">Выберите лид для продолжения</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_type">Тип клиента</Label>
              <CustomSelect
                value={newDeal.client_type}
                onChange={(value) =>
                  setNewDeal({ ...newDeal, client_type: value, client_id: 0 })
                }
                placeholder="Выберите тип клиента"
                options={[
                  { value: "individual", label: "Физическое лицо" },
                  { value: "legal", label: "Юридическое лицо" },
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_id">Клиент <span className="text-red-500">*</span></Label>
              <ComboboxSelect
                value={newDeal.client_id?.toString() || ""}
                onChange={(value) => {
                  const clientId = parseInt(value) || 0;
                  setNewDeal({
                    ...newDeal,
                    client_id: clientId,
                  });
                }}
                placeholder="Выберите клиента"
                searchPlaceholder="Поиск клиента..."
                emptyText="Клиент не найден"
                options={getClientOptions(newDeal.client_type)}
              />
              {!newDeal.client_id && (
                <p className="text-xs text-red-500">Выберите клиента для продолжения</p>
              )}
              {clients.length === 0 && (
                <p className="text-xs text-amber-600">Сначала создайте клиента в разделе Клиенты</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner_id">Ответственный</Label>
              <ComboboxSelect
                value={newDeal.owner_id?.toString() || ""}
                onChange={(value) =>
                  setNewDeal({ ...newDeal, owner_id: parseInt(value) || 0 })
                }
                placeholder="Выберите ответственного"
                searchPlaceholder="Поиск сотрудника..."
                options={users.map((u) => ({
                  value: u.id.toString(),
                  label: getUserDisplayName(u),
                  searchValue: getUserSearchValue(u),
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Сумма *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Введите сумму..."
                value={newDeal.amount}
                onChange={(e) =>
                  setNewDeal({ ...newDeal, amount: Number(e.target.value) })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Валюта *</Label>
              <CustomSelect
                value={newDeal.currency}
                onChange={(value) =>
                  setNewDeal({ ...newDeal, currency: value })
                }
                placeholder="Выберите валюту"
                options={[
                  { value: "KZT", label: "Тенге (KZT)" },
                  { value: "USD", label: "Доллар (USD)" },
                  { value: "EUR", label: "Евро (EUR)" },
                  { value: "RUB", label: "Рубль (RUB)" },
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Статус *</Label>
              <CustomSelect
                value={newDeal.status}
                onChange={(value) =>
                  setNewDeal({ ...newDeal, status: value })
                }
                placeholder="Выберите статус"
                options={[
                  { value: "new", label: "Новая" },
                  { value: "in_progress", label: "В работе" },
                  { value: "negotiation", label: "Переговоры" },
                  { value: "won", label: "Выиграна" },
                  { value: "lost", label: "Проиграна" },
                  { value: "cancelled", label: "Отменена" },
                ]}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
            <Button onClick={handleCreateDeal} disabled={isLoading || !newDeal.client_id || !newDeal.lead_id}>
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Создание...
                </>
              ) : isSales ? (
                "Отправить на подтверждение"
              ) : (
                "Создать"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Edit Deal Dialog */}
      < Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} >
        <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl max-h-[calc(100dvh-1rem)] overflow-y-auto touch-pan-y p-4 sm:p-6 [-webkit-overflow-scrolling:touch]">
          <DialogHeader>
            <DialogTitle>Редактировать сделку #{currentDeal?.id}</DialogTitle>
            <DialogDescription>
              Обновите информацию о сделке
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit_lead_id">Лид</Label>
              <ComboboxSelect
                value={editDeal.lead_id?.toString() || ""}
                onChange={(value) =>
                  setEditDeal({ ...editDeal, lead_id: parseInt(value) || 0 })
                }
                placeholder="Выберите лид"
                searchPlaceholder="Поиск лида..."
                emptyText="Лид не найден"
                options={leads.map((lead) => ({
                  value: lead.id.toString(),
                  label: lead.title || `Лид #${lead.id}`
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_client_type">Тип клиента</Label>
              <CustomSelect
                value={editDeal.client_type}
                onChange={(value) =>
                  setEditDeal({ ...editDeal, client_type: value, client_id: 0 })
                }
                placeholder="Выберите тип клиента"
                options={[
                  { value: "individual", label: "Физическое лицо" },
                  { value: "legal", label: "Юридическое лицо" },
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_client_id">Клиент</Label>
              <ComboboxSelect
                value={editDeal.client_id?.toString() || ""}
                onChange={(value) => {
                  const clientId = parseInt(value) || 0;
                  setEditDeal({
                    ...editDeal,
                    client_id: clientId,
                  });
                }}
                placeholder="Выберите клиента"
                searchPlaceholder="Поиск клиента..."
                emptyText="Клиент не найден"
                options={getClientOptions(editDeal.client_type)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_owner_id">Ответственный</Label>
              <ComboboxSelect
                value={editDeal.owner_id?.toString() || ""}
                onChange={(value) =>
                  setEditDeal({ ...editDeal, owner_id: parseInt(value) || 0 })
                }
                placeholder="Выберите ответственного"
                searchPlaceholder="Поиск сотрудника..."
                options={users.map((u) => ({
                  value: u.id.toString(),
                  label: getUserDisplayName(u),
                  searchValue: getUserSearchValue(u),
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_amount">Сумма *</Label>
              <Input
                id="edit_amount"
                type="number"
                placeholder="Введите сумму..."
                value={editDeal.amount}
                onChange={(e) =>
                  setEditDeal({ ...editDeal, amount: Number(e.target.value) })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_currency">Валюта *</Label>
              <CustomSelect
                value={editDeal.currency}
                onChange={(value) =>
                  setEditDeal({ ...editDeal, currency: value })
                }
                placeholder="Выберите валюту"
                options={[
                  { value: "KZT", label: "Тенге (KZT)" },
                  { value: "USD", label: "Доллар (USD)" },
                  { value: "EUR", label: "Евро (EUR)" },
                  { value: "RUB", label: "Рубль (RUB)" },
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_status">Статус *</Label>
              <CustomSelect
                value={editDeal.status}
                onChange={(value) =>
                  setEditDeal({ ...editDeal, status: value })
                }
                placeholder="Выберите статус"
                options={[
                  { value: "new", label: "Новая" },
                  { value: "in_progress", label: "В работе" },
                  { value: "negotiation", label: "Переговоры" },
                  { value: "won", label: "Выиграна" },
                  { value: "lost", label: "Проиграна" },
                  { value: "cancelled", label: "Отменена" },
                ]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleUpdateDeal} disabled={isLoading}>
              {isLoading ? "Обновление..." : isSales ? "Отправить на подтверждение" : "Обновить сделку"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* View Deal Dialog */}
      < Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen} >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Сделка #{currentDeal?.id}</DialogTitle>
            <DialogDescription>
              Подробная информация о сделке
            </DialogDescription>
          </DialogHeader>
          {currentDeal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">ID</Label>
                  <p className="font-medium">#{currentDeal.id}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Статус</Label>
                  <div className="mt-1">
                    {getStatusBadge(currentDeal.status)}
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Клиент</Label>
                  <p className="font-medium">
                    {currentDeal.client_id ? getClientName(currentDeal.client_id) : "Без клиента"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Лид</Label>
                  <p className="font-medium">
                    {currentDeal.lead_id ? getLeadTitle(currentDeal.lead_id) : "Без лида"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Сумма</Label>
                  <p className="font-medium">
                    {Number(currentDeal.amount || 0).toLocaleString()} {currentDeal.currency}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Ответственный</Label>
                  <p className="font-medium">
                    {getUserLabel(currentDeal.owner_id)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Дата создания</Label>
                  <p className="font-medium">
                    {currentDeal.created_at ? format(new Date(currentDeal.created_at), "dd.MM.yyyy HH:mm", { locale: ru }) : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Дата обновления</Label>
                  <p className="font-medium">
                    {currentDeal.updated_at ? format(new Date(currentDeal.updated_at), "dd.MM.yyyy HH:mm", { locale: ru }) : "-"}
                  </p>
                </div>
              </div>

              {canWrite && modalStages.length > 0 && (
                <div className="border-t pt-4 space-y-3">
                  <Label className="text-sm font-semibold">Перенести на этап</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <CustomSelect
                        value={modalMoveStageId}
                        onChange={setModalMoveStageId}
                        placeholder="Выберите этап"
                        options={modalStages
                          .filter((s) => s.id !== currentDeal.stage_id)
                          .map((s) => ({ value: String(s.id), label: s.name }))}
                      />
                    </div>
                    <Button
                      onClick={handleModalMoveStage}
                      disabled={!modalMoveStageId || isMovingStage}
                      size="sm"
                    >
                      {isMovingStage ? "..." : "Перенести"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Status Update Dialog */}
      < Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen} >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Изменить статус сделки #{selectedDealId}</DialogTitle>
            <DialogDescription>
              Выберите новый статус из доступных переходов
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current status indicator */}
            {currentDeal && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 border">
                <span className="text-sm text-gray-500">Текущий статус:</span>
                {getStatusBadge(currentDeal.status)}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="status">Новый статус <span className="text-red-500">*</span></Label>
              {currentDeal && getTransitionOptions(currentDeal.status).length > 0 ? (
                <CustomSelect
                  value={statusUpdate.to}
                  onChange={(value) =>
                    setStatusUpdate({ ...statusUpdate, to: value })
                  }
                  placeholder="Выберите статус"
                  options={getTransitionOptions(currentDeal.status)}
                />
              ) : (
                <p className="text-sm text-gray-500 italic">Нет доступных переходов для текущего статуса.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="comment">Комментарий (необязательно)</Label>
              <Textarea
                id="comment"
                placeholder="Напишите комментарий..."
                value={statusUpdate.comment}
                onChange={(e) =>
                  setStatusUpdate({ ...statusUpdate, comment: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleStatusUpdate}
              disabled={!statusUpdate.to || isLoading}
            >
              {isLoading ? "Обновление..." : "Обновить статус"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архивировать сделку?</AlertDialogTitle>
            <AlertDialogDescription>
              Запись будет перемещена в архив. Её можно восстановить позже.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveDeal}>Архивировать</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isUnarchiveDialogOpen} onOpenChange={setIsUnarchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Разархивировать сделку?</AlertDialogTitle>
            <AlertDialogDescription>
              Запись будет возвращена из архива в активный список.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnarchiveDeal}>Разархивировать</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
