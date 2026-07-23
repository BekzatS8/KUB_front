"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { PaginationControls } from "@/components/ui/pagination-controls"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DateInput } from "@/components/ui/date-input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CustomSelect } from "@/components/ui/custom-select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
  DialogClose,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  RefreshCw,
  Search,
  ChevronsUpDown,
  Check,
  MoreHorizontal,
  Edit,
  Trash2,
  UserPlus,
  CheckCircle,
  Clock,
  AlertTriangle,
  Calendar,
  ClipboardList,
  Activity,
  XCircle,
  Archive,
  ArchiveRestore,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { toast } from "sonner"
import { getCurrentUser, getCurrentCompany, hasPermission, getRoleCode } from "@/lib/auth"
import { ArchiveFilter, ArchiveFilterValue } from "@/components/ui/archive-filter";
import { CollapsibleFilter } from "@/components/ui/collapsible-filter";
import { getMe } from "@/src/api/auth.api"
import {
  create_task,
  list_tasks,
  list_my_tasks,
  update_task,
  delete_task,
  change_task_status,
  assign_task,
  complete_task,
  remind_later,
  archive_task,
  unarchive_task,
  restore_task,
  purge_task,
} from "@/src/api/tasks.api"
import { listUsers } from "@/src/api/users.api"
import * as BranchesAPI from "@/src/api/branches.api"

// ─── Types & Constants ───────────────────────────────────────────

type TaskStatus = "new" | "in_progress" | "done" | "cancelled"
type TaskPriority = "low" | "normal" | "high" | "urgent"
type EntityType = "deal" | "lead"

const statusTransitions: Record<TaskStatus, TaskStatus[]> = {
  new: ["in_progress", "cancelled"],
  in_progress: ["done", "cancelled"],
  done: [],
  cancelled: [],
}

const statusLabels: Record<TaskStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  done: "Выполнена",
  cancelled: "Отменена",
}

const statusColors: Record<TaskStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  done: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
}

const priorityLabels: Record<TaskPriority, string> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий",
  urgent: "Срочный",
}

const priorityColors: Record<TaskPriority, string> = {
  low: "bg-gray-100 text-gray-700",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
}

// ─── Combobox Component ──────────────────────────────────────────

// useWheelScrollRef возвращает callback-ref для скроллируемого контейнера
// (например, CommandList) внутри поповера, который порталится наружу диалога.
// Блокировка прокрутки диалога (react-remove-scroll) вешает wheel-обработчик на
// document и через preventDefault гасит прокрутку внешних элементов, из-за чего
// список не листается колёсиком. Здесь мы вешаем НЕпассивный нативный обработчик
// прямо на узел (callback-ref срабатывает ровно когда список смонтирован) и
// прокручиваем его вручную, гарантированно перекрывая блокировку.
function useWheelScrollRef() {
  const cleanupRef = useRef<(() => void) | null>(null)
  return useCallback((node: HTMLDivElement | null) => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    if (!node) return
    const onWheel = (e: WheelEvent) => {
      if (node.scrollHeight <= node.clientHeight) return
      e.preventDefault()
      e.stopPropagation()
      node.scrollTop += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
    }
    node.addEventListener("wheel", onWheel, { passive: false })
    cleanupRef.current = () => node.removeEventListener("wheel", onWheel)
  }, [])
}

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
  const listRef = useWheelScrollRef()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal bg-background px-3 py-2 text-sm border-input border rounded-xl h-10 hover:bg-accent hover:text-accent-foreground",
            !value && "text-muted-foreground"
          )}
          disabled={disabled}
        >
          <span className="truncate">
            {value
              ? options.find((o) => o.value === value.toString())?.label || placeholder
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList ref={listRef}>
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
                      value?.toString() === option.value ? "opacity-100" : "opacity-0"
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

// ─── Multi Combobox Component ────────────────────────────────────

function MultiComboboxSelect({
  values,
  onChange,
  options,
  placeholder = "Выберите...",
  searchPlaceholder = "Поиск...",
  emptyText = "Ничего не найдено",
  disabled = false,
}: {
  values: string[]
  onChange: (values: string[]) => void
  options: { value: string; label: string }[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const listRef = useWheelScrollRef()

  const toggle = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val))
    } else {
      onChange([...values, val])
    }
  }

  const selectedLabels = values
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean) as string[]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal bg-background px-3 py-2 text-sm border-input border rounded-xl h-auto min-h-10 hover:bg-accent hover:text-accent-foreground",
            selectedLabels.length === 0 && "text-muted-foreground"
          )}
          disabled={disabled}
        >
          <span className="truncate text-left">
            {selectedLabels.length > 0 ? selectedLabels.join(", ") : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList ref={listRef}>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => toggle(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      values.includes(option.value) ? "opacity-100" : "opacity-0"
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

// ─── Main Page ───────────────────────────────────────────────────

export default function TasksPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const [tasks, setTasks] = useState<any[]>([])
  const [totalTasks, setTotalTasks] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusGroupFilter, setStatusGroupFilter] = useState("all");
  const [assigneeIdFilter, setAssigneeIdFilter] = useState("");
  const [creatorIdFilter, setCreatorIdFilter] = useState("");
  const [entityIdFilter, setEntityIdFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>("active");
  const [branchFilter, setBranchFilter] = useState<number | undefined>(undefined);
  const [availableBranches, setAvailableBranches] = useState<{ id: number, name: string }[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [users, setUsers] = useState<any[]>([])
  const [deals, setDeals] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [canWrite, setCanWrite] = useState(false)

  // Check if user has elevated role (leadership, control, system_admin)
  const isElevatedRole = () => {
    const roleCode = getRoleCode(user) || getRoleCode(currentUser);
    return roleCode === 'leadership' || roleCode === 'control' || roleCode === 'system_admin';
  };

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [viewTask, setViewTask] = useState<any>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteTaskId, setDeleteTaskId] = useState<any>(null)
  const [isPurgeOpen, setIsPurgeOpen] = useState(false)
  const [purgeTaskId, setPurgeTaskId] = useState<any>(null)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [taskToChangeStatus, setTaskToChangeStatus] = useState<any>(null);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isUnarchiveDialogOpen, setIsUnarchiveDialogOpen] = useState(false);
  const [taskToArchive, setTaskToArchive] = useState<any>(null);
  const [newStatus, setNewStatus] = useState("")
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [statusTask, setStatusTask] = useState<any>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false)
  const [assignTask_, setAssignTask_] = useState<any>(null)
  const [assignUserId, setAssignUserId] = useState("")
  const [assignComment, setAssignComment] = useState("")
  const [isCompleteOpen, setIsCompleteOpen] = useState(false)
  const [completeTask_, setCompleteTask_] = useState<any>(null)

  // Form state
  const emptyForm = {
    title: "",
    description: "",
    assignee_ids: [] as number[],
    priority: "normal" as TaskPriority,
    entity_type: "" as EntityType,
    entity_id: undefined as number | undefined,
    due_date: "",
    reminder_at: "",
  }
  const [formData, setFormData] = useState(emptyForm)

  const currentPage = Number(searchParams.get("page")) || 1
  const limit = 15

  // Initialize filter states from URL
  useEffect(() => {
    setStatusGroupFilter(searchParams.get('status_group') || 'all');
    setAssigneeIdFilter(searchParams.get('assignee_id') || '');
    setCreatorIdFilter(searchParams.get('creator_id') || '');
    setEntityIdFilter(searchParams.get('entity_id') || '');
    setEntityTypeFilter(searchParams.get('entity_type') || '');
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
    if (assigneeIdFilter) params.set('assignee_id', assigneeIdFilter);
    if (creatorIdFilter) params.set('creator_id', creatorIdFilter);
    if (entityIdFilter) params.set('entity_id', entityIdFilter);
    if (entityTypeFilter) params.set('entity_type', entityTypeFilter);
    if (archiveFilter !== 'active') params.set('archive', archiveFilter);
    if (branchFilter) params.set('branch_id', String(branchFilter));
    params.set('sort_by', sortBy);
    params.set('order', sortOrder);
    router.push(`${pathname}?${params.toString()}`);
  };

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setStatusGroupFilter('all');
    setAssigneeIdFilter('');
    setCreatorIdFilter('');
    setEntityIdFilter('');
    setEntityTypeFilter('');
    setBranchFilter(undefined);
    setSortBy('created_at');
    setSortOrder('desc');
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
  }, [statusFilter, statusGroupFilter, assigneeIdFilter, creatorIdFilter, entityIdFilter, entityTypeFilter, archiveFilter, sortBy, sortOrder, branchFilter]);

  // Fetch user data and permissions
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userData = await getMe();
        setUser(userData);
        // Use role.id and map it to role name like the sidebar does
        const userRole = getRoleCode(userData);
        const hasWriteAccess = userData && hasPermission(userRole, ["tasks:write"]);
        setCanWrite(hasWriteAccess);
      } catch (error) {
        console.error("Failed to fetch user data", error);
        // Fallback to localStorage
        const localUser = getCurrentUser();
        setUser(localUser);
        const userRole = getRoleCode(localUser);
        setCanWrite(!!(localUser && hasPermission(userRole, ["tasks:write"])));
      }
    };

    fetchUserData();
  }, []);

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

  // ─── Data Loading ────────────────────────────────────────────

  const fetchTasks = async () => {
    setIsLoading(true)
    try {
      const params: any = { page: currentPage, size: limit }
      if (searchTerm) params.q = searchTerm
      if (statusFilter !== "all") params.status = statusFilter
      if (statusGroupFilter !== "all") params.status_group = statusGroupFilter
      if (assigneeIdFilter) params.assignee_id = assigneeIdFilter
      if (creatorIdFilter) params.creator_id = creatorIdFilter
      if (entityIdFilter) params.entity_id = entityIdFilter
      if (entityTypeFilter) params.entity_type = entityTypeFilter
      if (archiveFilter !== "active") params.archive = archiveFilter
      if (branchFilter) params.branch_id = branchFilter
      params.sort_by = sortBy
      params.order = sortOrder

      // Prevent sales users from accessing full tasks list
      // Note: /tasks/my endpoint returns 400, so use /tasks with role-based filtering
      const roleCode = getRoleCode(currentUser) || getRoleCode(user);
      const effectiveView = roleCode === 'sales' ? 'all' : 'all';

      console.log('fetchTasks called:', {
        userRole: roleCode,
        effectiveView,
        endpoint: '/tasks', // Always use /tasks for now since /tasks/my returns 400
        params
      });

      const res = await list_tasks(undefined, params)
      let data;
      if ((res as any)?.items && Array.isArray((res as any).items)) {
        data = (res as any).items;
      } else if (Array.isArray(res)) {
        data = res;
      } else if ((res as any)?.data && Array.isArray((res as any).data)) {
        data = (res as any).data;
      } else {
        data = [];
      }
      let total = (res as any)?.pagination?.total || (res as any)?.total || data.length
      const totalPagesFromBackend = (res as any)?.pagination?.total_pages || Math.ceil(total / limit)

      setTasks(data)
      setTotalTasks(total)
      setTotalPages(totalPagesFromBackend)
    } catch (err: any) {
      console.error("Error loading tasks:", err)
      toast.error(err?.message || "Ошибка при загрузке задач")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    console.log('handleRefresh called:', { 
      user: currentUser?.role, 
      userLoaded: !!currentUser 
    });
    
    // Ensure user is loaded before refreshing
    if (!currentUser) {
      console.log('User not loaded, skipping refresh');
      return;
    }
    
    fetchTasks();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTaskId) return
    try {
      await delete_task(undefined, { id: deleteTaskId })
      toast.success("Задача перемещена в корзину")
      await fetchTasks()
    } catch (err: any) {
      console.error("Delete error:", err)
      const errorMsg = err?.response?.data?.message || err?.message || 'Unknown error'
      if (errorMsg.includes('foreign key') || errorMsg.includes('constraint') || errorMsg.includes('violates') || err?.response?.status === 500) {
        toast.error("Невозможно удалить задачу, так как она связана с другими записями. Сначала удалите связанные записи или используйте архивацию.")
      } else {
        toast.error(`Ошибка при удалении задачи: ${errorMsg}`)
      }
    } finally {
      setIsDeleteOpen(false)
      setDeleteTaskId(null)
    }
  }

  const handleArchiveTask = async () => {
    if (!taskToArchive) return;
    try {
      await archive_task(undefined, { id: taskToArchive.id });
      toast.success("Задача успешно заархивирована");
      await fetchTasks();
    } catch (err: any) {
      console.error("Archive error:", err);
      toast.error(err?.message || "Ошибка при архивации задачи");
    } finally {
      setIsArchiveDialogOpen(false);
      setTaskToArchive(null);
    }
  };

  const handleUnarchiveTask = async () => {
    if (!taskToArchive) return;
    try {
      await unarchive_task(undefined, { id: taskToArchive.id });
      toast.success("Задача успешно разархивирована");
      await fetchTasks();
    } catch (err: any) {
      console.error("Unarchive error:", err);
      toast.error(err?.message || "Ошибка при разархивации задачи");
    } finally {
      setIsUnarchiveDialogOpen(false);
      setTaskToArchive(null);
    }
  };

  // Корзина: восстановление и окончательное удаление (только админ).
  const handleRestoreTask = async (taskId: number) => {
    try {
      await restore_task(undefined, { id: taskId });
      toast.success("Задача восстановлена из корзины");
      await fetchTasks();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Не удалось восстановить задачу");
    }
  };

  const handlePurgeConfirm = async () => {
    if (!purgeTaskId) return;
    try {
      await purge_task(undefined, { id: purgeTaskId });
      toast.success("Задача удалена окончательно");
      await fetchTasks();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Не удалось удалить задачу");
    } finally {
      setIsPurgeOpen(false);
      setPurgeTaskId(null);
    }
  };

  const isAdmin = getRoleCode(user) === 'system_admin' || getRoleCode(currentUser) === 'system_admin';

  const stats = {
    total: tasks.length,
    new: tasks.filter((t) => t.status === "new").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  }

  // Helper functions
  const formatUserName = (user: any) => {
    if (!user) return "Неизвестен"
    const full = (user.full_name || `${user.first_name || ""} ${user.last_name || ""}`).trim()
    return full || user.company_name || user.email || `Пользователь #${user.id}`
  }

  const getUserLabel = (userId: string | number) => {
    const user = users.find((u) => u.id.toString() === userId.toString())
    return user ? formatUserName(user) : "Неизвестен"
  }

  // Список исполнителей задачи (с обратной совместимостью со старым assignee_id)
  const getTaskAssigneeIds = (task: any): number[] => {
    if (Array.isArray(task?.assignee_ids) && task.assignee_ids.length) {
      return task.assignee_ids.map((id: any) => Number(id))
    }
    return task?.assignee_id ? [Number(task.assignee_id)] : []
  }

  const getAssigneesLabel = (task: any) => {
    const ids = getTaskAssigneeIds(task)
    if (!ids.length) return "Не назначен"
    return ids.map((id) => getUserLabel(id)).join(", ")
  }

  // Опции исполнителей для селектов
  const assigneeOptions = users.map((u) => ({
    value: u.id.toString(),
    label: formatUserName(u),
  }))

  const getEntityLabel = (entityId: string, entityType: string) => {
    if (entityType === "deal") {
      const deal = deals.find((d) => d.id.toString() === entityId.toString())
      return deal ? `Сделка #${deal.id}` : "Неизвестно"
    }
    if (entityType === "lead") {
      const lead = leads.find((l) => l.id.toString() === entityId.toString())
      return lead ? `Лид #${lead.id}` : "Неизвестно"
    }
    return "—"
  }

  const entityOptions = formData.entity_type === "deal"
    ? deals.map((d) => ({ value: d.id.toString(), label: `Сделка #${d.id}` }))
    : formData.entity_type === "lead"
    ? leads.map((l) => ({ value: l.id.toString(), label: `Лид #${l.id}` }))
    : []

  const openCreateDialog = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const openEditDialog = (task: any) => {
    setSelectedTask(task)
    setFormData({
      title: task.title || "",
      description: task.description || "",
      assignee_ids: getTaskAssigneeIds(task),
      priority: task.priority || "normal",
      entity_type: task.entity_type || "",
      entity_id: task.entity_id ? Number(task.entity_id) : undefined,
      due_date: task.due_date || "",
      reminder_at: task.reminder_at || "",
    })
    setIsFormOpen(true)
  }

  const resetForm = () => {
    setSelectedTask(null)
    setFormData(emptyForm)
  }

  const handleSubmitForm = async () => {
    if (!formData.title.trim() || !formData.entity_type.trim()) return
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        assignee_id: formData.assignee_ids[0] || 0,
        assignee_ids: formData.assignee_ids,
        priority: formData.priority,
        entity_type: formData.entity_type,
        entity_id: formData.entity_id || 0,
        due_date: formData.due_date || "",
        reminder_at: formData.reminder_at || "",
      }
      if (selectedTask) {
        await update_task(payload, { id: selectedTask.id })
        toast.success("Задача обновлена")
      } else {
        await create_task(payload)
        toast.success("Задача создана")
      }
      setIsFormOpen(false)
      resetForm()
      await fetchTasks()
    } catch (err: any) {
      console.error("Error saving task:", err)
      toast.error(err?.message || "Ошибка при сохранении задачи")
    }
  }

  const handleDelete = (taskId: any) => {
    setDeleteTaskId(taskId)
    setIsDeleteOpen(true)
  }

  const handleChangeStatus = async () => {
    if (!statusTask || !newStatus) return
    try {
      await change_task_status({ to: newStatus }, { id: statusTask.id })
      toast.success("Статус изменен")
      setIsStatusOpen(false)
      setStatusTask(null)
      setNewStatus("")
      await fetchTasks()
    } catch (err: any) {
      console.error("Error changing status:", err)
      toast.error(err?.message || "Ошибка при изменении статуса")
    }
  }

  const handleAssign = async () => {
    if (!assignTask_ || !assignUserId) return
    try {
      await assign_task({ assignee_id: Number(assignUserId) }, { id: assignTask_.id })
      toast.success("Исполнитель назначен")
      setIsAssignOpen(false)
      setAssignTask_(null)
      setAssignUserId("")
      setAssignComment("")
      await fetchTasks()
    } catch (err: any) {
      console.error("Error assigning task:", err)
      toast.error(err?.message || "Ошибка при назначении")
    }
  }

  const handleComplete = async () => {
    if (!completeTask_) return
    try {
      await complete_task(undefined, { id: completeTask_.id })
      toast.success("Задача завершена")
      setIsCompleteOpen(false)
      setCompleteTask_(null)
      await fetchTasks()
    } catch (err: any) {
      console.error("Error completing task:", err)
      toast.error(err?.message || "Ошибка при завершении")
    }
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", page.toString())
    router.push(`${pathname}?${params.toString()}`)
  }

  useEffect(() => {
    console.log('=== TASKS PAGE useEffect triggered ===');
    const loadMeta = async () => {
      console.log('=== loadMeta function started ===');
      try {
        let userData = getCurrentUser()
        const companyData = getCurrentCompany()
        
        console.log('Initial data check:', { 
          hasUserData: !!userData, 
          hasCompanyData: !!companyData,
          userData: userData ? { id: userData.id, role: userData.role, role_id: userData.role_id } : null
        });
        
        // Temporary fix: if user data is missing but token exists, try to get user data
        if (!userData) {
          const token = localStorage.getItem("auth_token");
          console.log('No userData, checking token:', !!token);
          if (token && companyData) {
            // Try to get actual user data from localStorage to preserve the correct role
            const storedUser = localStorage.getItem("current_user");
            let userRole = "sales"; // Default to sales for safety
            let roleId = 10;
            
            if (storedUser) {
              try {
                const parsedUser = JSON.parse(storedUser);
                userRole = getRoleCode(parsedUser) || userRole;
                roleId = parsedUser.role?.id || parsedUser.role_id || roleId;
              } catch (e) {
                console.log("Failed to parse stored user, using default role");
              }
            }
            
            // Create minimal user data from company data with correct role
            const tempUser = {
              id: String(companyData.id),
              full_name: companyData.name,
              email: companyData.email || '',
              phone: companyData.phone || '',
              role: { id: roleId || 50, code: userRole || 'system_admin', legacy_name: userRole || 'admin' },
              company_name: companyData.name,
              role_id: roleId || 50,
              is_verified: true,
              status: 'active'
            };
            setCurrentUser(tempUser);
            console.log("Using temporary user data in tasks with correct role:", tempUser);
            // Don't return here - continue to load API data with the temporary user
            userData = tempUser; // Use the temp user for API calls
          }
        }
        
        if (!userData) {
          console.log("User data missing in tasks, but continuing anyway for testing");
          return
        }
        setCurrentUser(userData)
        
        console.log('About to load data with userData:', userData);

        // Load users
        try {
          console.log('Loading users for user role:', userData?.role);
          const res = await listUsers()
          const usersData = Array.isArray(res) ? res : (res as any)?.data || []
          console.log('Users API response:', res);
          console.log('Processed usersData:', usersData);
          
          // Always include current user in performers list
          let finalUsers = Array.isArray(usersData) ? usersData : [];
          if (userData && !finalUsers.find(u => u.id === userData.id)) {
            finalUsers = [userData, ...finalUsers];
            console.log('Added current user to performers list:', userData);
          }
          
          setUsers(finalUsers)
        } catch (err: any) {
          // Handle 403 errors gracefully - always include current user
          if (err?.response?.status === 403) {
            console.log('403 error loading users for tasks, including current user only');
            const fallbackUsers = userData ? [userData] : [];
            console.log('Fallback users (current user only):', fallbackUsers);
            setUsers(fallbackUsers);
          } else {
            console.error("Error loading users:", err)
            // Still try to include current user
            if (userData) {
              setUsers([userData]);
              console.log('Error loading users, but included current user:', userData);
            }
          }
        }

        // Load deals - use role-appropriate endpoint for sales users
        try {
          console.log('Loading deals for user role:', userData?.role);
          const { list_deals, list_my_deals } = await import("@/src/api/deals.api")
          const roleCode = getRoleCode(userData);
          const res = roleCode === 'sales'
            ? await list_my_deals() 
            : await list_deals();
          console.log('Deals API response:', res);
          const dealsData = Array.isArray(res) ? res : (res?.items || res?.data || [])
          console.log('Processed dealsData:', dealsData);
          setDeals(Array.isArray(dealsData) ? dealsData : [])
        } catch (err) {
          console.error("Error loading deals:", err)
          setDeals([])
        }

        // Load leads - use role-appropriate endpoint for sales users
        try {
          console.log('Loading leads for user role:', userData?.role);
          const { list_leads, list_my_leads } = await import("@/src/api/leads.api")
          const roleCode = getRoleCode(userData);
          const res = roleCode === 'sales'
            ? await list_my_leads() 
            : await list_leads();
          console.log('Leads API response:', res);
          const leadsData = Array.isArray(res) ? res : (res?.items || res?.data || [])
          console.log('Processed leadsData:', leadsData);
          setLeads(Array.isArray(leadsData) ? leadsData : [])
        } catch (err) {
          console.error("Error loading leads:", err)
          setLeads([])
        }
      } catch (err) {
        console.error("Error loading meta:", err)
      }
    }
    loadMeta()
  }, [router])

  useEffect(() => {
    // Only fetch if user is loaded
    if (currentUser) {
      fetchTasks();
    }
  }, [currentPage, statusFilter, statusGroupFilter, assigneeIdFilter, creatorIdFilter, entityIdFilter, entityTypeFilter, archiveFilter, sortBy, sortOrder, currentUser])

  // Update URL when filters change
  useEffect(() => {
    updateURL();
  }, [statusFilter, statusGroupFilter, assigneeIdFilter, creatorIdFilter, entityIdFilter, entityTypeFilter, archiveFilter, sortBy, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentUser) {
        fetchTasks()
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm, currentUser])

  // ─── Skeleton Loading ────────────────────────────────────────

  if (isLoading && tasks.length === 0) {
    return (
      <>
        <Skeleton className="h-8 w-48 mb-4 m-6" />
        <Skeleton className="h-4 w-64 mb-8 ml-6" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 mx-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-12 mb-6 mx-6" />
        <Skeleton className="h-96 mx-6" />
      </>
    )
  }

  // ─── Render ──────────────────────────────────────────────────

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between m-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Задачи</h1>
          <p className="text-gray-600">Управление задачами и активностями</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          {canWrite && (
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Новая задача
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 mx-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <p className="text-sm text-gray-600">Всего задач</p>
              </div>
              <ClipboardList className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-purple-600">{stats.new}</div>
                <p className="text-sm text-gray-600">Новых</p>
              </div>
              <Clock className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
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
                <div className="text-2xl font-bold text-green-600">{stats.done}</div>
                <p className="text-sm text-gray-600">Выполнено</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6 mx-6">
        <CollapsibleFilter defaultOpen={false}>
          <Card className="overflow-visible">
            <CardContent className="p-4 overflow-visible">
              <div className="flex flex-col gap-4 overflow-visible">
                {/* Primary filters row */}
                <div className="flex flex-col lg:flex-row gap-4 overflow-visible">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Поиск по названию или описанию..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="w-full sm:w-48 overflow-visible">
                    <CustomSelect
                      value={statusFilter}
                      onChange={setStatusFilter}
                      placeholder="Статус"
                      options={[
                        { value: "all", label: "Все статусы" },
                        { value: "new", label: "Новая" },
                        { value: "in_progress", label: "В работе" },
                        { value: "done", label: "Выполнена" },
                        { value: "cancelled", label: "Отменена" },
                      ]}
                    />
                  </div>
                  <div className="w-full sm:w-48 overflow-visible">
                    <CustomSelect
                      value={statusGroupFilter}
                      onChange={setStatusGroupFilter}
                      placeholder="Группа статусов"
                      options={[
                        { value: "all", label: "Все группы" },
                        { value: "active", label: "Активные" },
                        { value: "closed", label: "Закрытые" },
                      ]}
                    />
                  </div>
                  <div className="w-full sm:w-48 overflow-visible">
                    <ArchiveFilter
                      value={archiveFilter}
                      onChange={setArchiveFilter}
                      showTrash={isAdmin}
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
                          { value: "due_date", label: "Срок выполнения" },
                          { value: "priority", label: "Приоритет" },
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
                {/* Secondary filters row */}
                <div className="flex flex-col lg:flex-row gap-4 overflow-visible">
                  <div className="w-full sm:w-48 overflow-visible">
                    <ComboboxSelect
                      value={assigneeIdFilter}
                      onChange={setAssigneeIdFilter}
                      placeholder="Исполнитель"
                      searchPlaceholder="Поиск пользователя..."
                      emptyText="Пользователь не найден"
                      options={assigneeOptions}
                    />
                  </div>
                  <div className="w-full sm:w-48 overflow-visible">
                    <ComboboxSelect
                      value={creatorIdFilter}
                      onChange={setCreatorIdFilter}
                      placeholder="Создатель"
                      searchPlaceholder="Поиск пользователя..."
                      emptyText="Пользователь не найден"
                      options={assigneeOptions}
                    />
                  </div>
                  <div className="w-full sm:w-48 overflow-visible">
                    <Input
                      placeholder="ID сущности"
                      value={entityIdFilter}
                      onChange={(e) => setEntityIdFilter(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="w-full sm:w-48 overflow-visible">
                    <CustomSelect
                      value={entityTypeFilter}
                      onChange={setEntityTypeFilter}
                      placeholder="Тип сущности"
                      options={[
                        { value: "", label: "Все типы" },
                        { value: "lead", label: "Лид" },
                        { value: "deal", label: "Сделка" },
                        { value: "client", label: "Клиент" },
                      ]}
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
      </div>

      {/* Tasks Table */}
      <Card className="mx-6 mb-6">
        <CardHeader>
          <CardTitle>Список задач</CardTitle>
        </CardHeader>
        <CardContent>
          {!tasks || tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardList className="h-12 w-12 text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium text-lg">Задач пока нет</p>
              <p className="text-sm text-gray-400 mt-1">Создайте свою первую задачу</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table className="w-full table-fixed">
                <colgroup>
                  <col className="w-[16%]" />
                  <col className="w-[21%]" />
                  <col className="w-[14%]" />
                  <col className="w-[13%]" />
                  <col className="w-[10%]" />
                  <col className="w-[9%]" />
                  <col className="w-[9%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Название</TableHead>
                    <TableHead className="px-4">Описание</TableHead>
                    <TableHead className="px-4">Исполнитель</TableHead>
                    <TableHead className="px-4">Объект</TableHead>
                    <TableHead className="px-4">Срок</TableHead>
                    <TableHead className="px-4">Приоритет</TableHead>
                    <TableHead className="px-4">Статус</TableHead>
                    <TableHead className="px-4 text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => {
                    const taskStatus = (task.status || "new") as TaskStatus
                    const taskPriority = (task.priority || "normal") as TaskPriority
                    const allowedTransitions = statusTransitions[taskStatus] || []
                    const isFinal = taskStatus === "done" || taskStatus === "cancelled"
                    const isArchived = task.archived || task.is_archived

                    return (
                      <TableRow key={task.id} className={isArchived ? "bg-gray-200" : ""}>
                        <TableCell className="px-4 align-top">
                          <div className="break-words font-medium leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                            {task.title}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 align-top text-gray-500">
                          <div className="break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                            {task.description || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 align-top text-sm">
                          <div className="break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                            {getAssigneesLabel(task)}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 align-top text-sm">
                          <div className="break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                            {task.entity_id && task.entity_type
                              ? getEntityLabel(task.entity_id, task.entity_type)
                              : "—"}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          {task.due_date ? (
                            <div className="flex items-center whitespace-nowrap text-sm">
                              <Calendar className="mr-1 h-3 w-3 shrink-0 text-gray-400" />
                              {format(new Date(task.due_date), "dd.MM.yyyy", { locale: ru })}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          <Badge className={`${priorityColors[taskPriority] || priorityColors.normal} text-xs`}>
                            {priorityLabels[taskPriority] || taskPriority}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          <div className="flex flex-col items-start gap-1">
                            <Badge className={`${statusColors[taskStatus] || statusColors.new} text-xs`}>
                              {statusLabels[taskStatus] || taskStatus}
                            </Badge>
                            {isArchived && (
                              <Badge className="bg-gray-100 text-gray-800 text-xs">Архив</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 align-top text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setViewTask(task)
                                setIsViewOpen(true)
                              }}>
                                <ClipboardList className="h-4 w-4 mr-2" />
                                Просмотр
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditDialog(task)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Редактировать
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {!isFinal && !isArchived && allowedTransitions.length > 0 && (
                                <DropdownMenuItem onClick={() => {
                                  setStatusTask(task)
                                  setNewStatus("")
                                  setIsStatusOpen(true)
                                }}>
                                  <Activity className="h-4 w-4 mr-2" />
                                  Изменить статус
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => {
                                setAssignTask_(task)
                                setAssignUserId(task.assignee_id?.toString() || "")
                                setAssignComment("")
                                setIsAssignOpen(true)
                              }}>
                                <UserPlus className="h-4 w-4 mr-2" />
                                Назначить
                              </DropdownMenuItem>
                              {taskStatus === "in_progress" && !isArchived && (
                                <DropdownMenuItem onClick={() => {
                                  setCompleteTask_(task)
                                  setIsCompleteOpen(true)
                                }}>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Завершить
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {archiveFilter === "deleted" ? (
                                /* Корзина: восстановить или удалить окончательно (админ) */
                                isAdmin && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleRestoreTask(task.id)}>
                                      <ArchiveRestore className="h-4 w-4 mr-2" />
                                      Восстановить
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setPurgeTaskId(task.id)
                                        setIsPurgeOpen(true)
                                      }}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Удалить навсегда
                                    </DropdownMenuItem>
                                  </>
                                )
                              ) : (
                                <>
                                  {isArchived ? (
                                    <DropdownMenuItem onClick={() => {
                                      setTaskToArchive(task)
                                      setIsUnarchiveDialogOpen(true)
                                    }}>
                                      <ArchiveRestore className="h-4 w-4 mr-2" />
                                      Разархивировать
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => {
                                      setTaskToArchive(task)
                                      setIsArchiveDialogOpen(true)
                                    }}>
                                      <Archive className="h-4 w-4 mr-2" />
                                      Архивировать
                                    </DropdownMenuItem>
                                  )}
                                  {isAdmin && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setDeleteTaskId(task.id)
                                        setIsDeleteOpen(true)
                                      }}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Удалить
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
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
      </Card>

      {/* ── Create/Edit Dialog ─────────────────────────────────── */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) resetForm() }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTask ? "Редактировать задачу" : "Создать задачу"}</DialogTitle>
            <DialogDescription>
              {selectedTask ? "Обновите информацию о задаче" : "Заполните информацию о новой задаче"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Заголовок <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Введите название задачи..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Описание</Label>
              <Textarea
                placeholder="Описание задачи..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Исполнители</Label>
              <MultiComboboxSelect
                values={formData.assignee_ids.map((id) => id.toString())}
                onChange={(vals) => setFormData({ ...formData, assignee_ids: vals.map((v) => Number(v)) })}
                placeholder="Выберите исполнителей"
                searchPlaceholder="Поиск сотрудника..."
                options={assigneeOptions}
              />
            </div>

            <div className="space-y-2">
              <Label>Приоритет</Label>
              <CustomSelect
                value={formData.priority}
                onChange={(val) => setFormData({ ...formData, priority: val as TaskPriority })}
                placeholder="Выберите приоритет"
                options={[
                  { value: "low", label: "Низкий" },
                  { value: "normal", label: "Обычный" },
                  { value: "high", label: "Высокий" },
                  { value: "urgent", label: "Срочный" },
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label>Тип сущности <span className="text-red-500">*</span></Label>
              <CustomSelect
                value={formData.entity_type}
                onChange={(val) => setFormData({ ...formData, entity_type: val as EntityType, entity_id: undefined })}
                placeholder="Выберите тип"
                options={[
                  { value: "deal", label: "Сделка" },
                  { value: "lead", label: "Лид" },
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label>Объект ({formData.entity_type === "deal" ? "Сделка" : formData.entity_type === "lead" ? "Лид" : "—"})</Label>
              <ComboboxSelect
                value={formData.entity_id?.toString() || ""}
                onChange={(val) => setFormData({ ...formData, entity_id: val ? Number(val) : undefined })}
                placeholder={formData.entity_type ? "Выберите объект" : "Сначала выберите тип"}
                searchPlaceholder="Поиск..."
                emptyText="Ничего не найдено"
                disabled={!formData.entity_type}
                options={entityOptions}
              />
            </div>

            <div className="space-y-2">
              <Label>Дедлайн</Label>
              <DateInput
                mode="datetime"
                value={formData.due_date}
                onChange={(value) => setFormData({ ...formData, due_date: value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Напоминание</Label>
              <DateInput
                mode="datetime"
                value={formData.reminder_at}
                onChange={(value) => setFormData({ ...formData, reminder_at: value })}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Отмена</Button>
            </DialogClose>
            <Button onClick={handleSubmitForm} disabled={!formData.title.trim() || !formData.entity_type.trim()}>
              {selectedTask ? "Обновить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Task Dialog ───────────────────────────────────── */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Задача #{viewTask?.id}</DialogTitle>
            <DialogDescription>Подробная информация о задаче</DialogDescription>
          </DialogHeader>
          {viewTask && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Заголовок</Label>
                  <p className="font-medium">{viewTask.title}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Статус</Label>
                  <div className="mt-1">
                    <Badge className={`${statusColors[(viewTask.status || "new") as TaskStatus]} text-xs`}>
                      {statusLabels[(viewTask.status || "new") as TaskStatus]}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Приоритет</Label>
                  <div className="mt-1">
                    <Badge className={`${priorityColors[(viewTask.priority || "normal") as TaskPriority]} text-xs`}>
                      {priorityLabels[(viewTask.priority || "normal") as TaskPriority]}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Исполнители</Label>
                  <p className="font-medium">{getAssigneesLabel(viewTask)}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Объект</Label>
                  <p className="font-medium">
                    {viewTask.entity_id && viewTask.entity_type
                      ? getEntityLabel(viewTask.entity_id, viewTask.entity_type)
                      : "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Дедлайн</Label>
                  <p className="font-medium">
                    {viewTask.due_date ? format(new Date(viewTask.due_date), "dd.MM.yyyy HH:mm", { locale: ru }) : "—"}
                  </p>
                </div>
                {viewTask.reminder_at && (
                  <div>
                    <Label className="text-sm text-gray-500">Напоминание</Label>
                    <p className="font-medium">{format(new Date(viewTask.reminder_at), "dd.MM.yyyy HH:mm", { locale: ru })}</p>
                  </div>
                )}
                <div>
                  <Label className="text-sm text-gray-500">Дата создания</Label>
                  <p className="font-medium">
                    {viewTask.created_at ? format(new Date(viewTask.created_at), "dd.MM.yyyy HH:mm", { locale: ru }) : "—"}
                  </p>
                </div>
              </div>
              {viewTask.description && (
                <div>
                  <Label className="text-sm text-gray-500">Описание</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{viewTask.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsViewOpen(false)}>Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────────────── */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить задачу?</AlertDialogTitle>
            <AlertDialogDescription>
              Задача переместится в корзину. Её можно будет восстановить или удалить окончательно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Purge (delete forever) Confirmation ────────────────── */}
      <AlertDialog open={isPurgeOpen} onOpenChange={setIsPurgeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить задачу навсегда?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Задача будет удалена из корзины безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handlePurgeConfirm} className="bg-red-600 hover:bg-red-700">
              Удалить навсегда
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Change Status Dialog ───────────────────────────────── */}
      <Dialog open={isStatusOpen} onOpenChange={setIsStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изменить статус задачи</DialogTitle>
            <DialogDescription>
              Текущий статус: {statusTask ? statusLabels[(statusTask.status || "new") as TaskStatus] : ""}
            </DialogDescription>
          </DialogHeader>
          {statusTask && (
            <div className="space-y-3">
              <Label>Новый статус</Label>
              <CustomSelect
                value={newStatus}
                onChange={setNewStatus}
                placeholder="Выберите статус"
                options={(statusTransitions[(statusTask.status || "new") as TaskStatus] || []).map((s) => ({
                  value: s,
                  label: statusLabels[s],
                }))}
              />
              {(statusTransitions[(statusTask.status || "new") as TaskStatus] || []).length === 0 && (
                <p className="text-sm text-amber-600">Этот статус нельзя изменить</p>
              )}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
            <Button onClick={handleChangeStatus} disabled={!newStatus}>
              Изменить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign Dialog ──────────────────────────────────────── */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Назначить задачу</DialogTitle>
            <DialogDescription>Выберите исполнителя для задачи</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Исполнитель</Label>
              <ComboboxSelect
                value={assignUserId}
                onChange={setAssignUserId}
                placeholder="Выберите сотрудника"
                searchPlaceholder="Поиск..."
                options={assigneeOptions}
              />
            </div>
            <div className="space-y-2">
              <Label>Комментарий (необязательно)</Label>
              <Textarea
                placeholder="Комментарий к назначению..."
                value={assignComment}
                onChange={(e) => setAssignComment(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
            <Button onClick={handleAssign} disabled={!assignUserId}>
              Назначить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Complete Task Confirmation ─────────────────────────── */}
      <AlertDialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Завершить задачу?</AlertDialogTitle>
            <AlertDialogDescription>
              Задача &quot;{completeTask_?.title}&quot; будет отмечена как выполненная.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
              Завершить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архивировать задачу?</AlertDialogTitle>
            <AlertDialogDescription>
              Запись будет перемещена в архив. Её можно восстановить позже.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveTask}>Архивировать</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isUnarchiveDialogOpen} onOpenChange={setIsUnarchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Разархивировать задачу?</AlertDialogTitle>
            <AlertDialogDescription>
              Запись будет возвращена из архива в активный список.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnarchiveTask}>Разархивировать</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
