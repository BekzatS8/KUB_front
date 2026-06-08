"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { PaginationControls } from "@/components/ui/pagination-controls"
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
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { CustomSelect } from "@/components/ui/custom-select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
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
    FileText,
    Plus,
    Download,
    Trash2,
    MoreHorizontal,
    RefreshCw,
    Eye,
    Send,
    Search,
    CheckCircle,
    XCircle,
    PenTool,
    ShieldCheck,
    ChevronsUpDown,
    Check,
    Mail,
    KeyRound,
    Loader2,
    FileCheck,
    Clock,
    AlertTriangle,
    ArrowRight,
    Upload,
    Link,
    Copy,
    ExternalLink,
    MessageCircle,
    Archive,
    ArchiveRestore,
    ArrowUp,
    ArrowDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { toast } from "sonner"
import { getCurrentUser, getCurrentCompany, setCurrentUser, hasPermission } from "@/lib/auth"
import { ArchiveFilter, ArchiveFilterValue } from "@/components/ui/archive-filter";
import { CollapsibleFilter } from "@/components/ui/collapsible-filter";
import * as AuthAPI from "@/src/api/auth.api"
import * as ClientAPI from "@/src/api/clients.api"
import * as DealsAPI from "@/src/api/deals.api"
import {
    getDocuments,
    getDocumentsByDeal,
    getDocumentById,
    createDocumentFromClient,
    uploadDocument,
    downloadDocument,
    deleteDocument,
    submitDocument,
    reviewDocument,
    generateSignLink,
    startSign,
} from "@/src/api/documents.api"
import type { Document, DocType, DocStatus, SignStatus } from "@/src/models/documents.model"
import { PdfViewer } from "@/components/ui/pdf-viewer-simple"
import { SendForSignatureModal } from "@/components/send-for-signature-modal"

// ─── Constants ───────────────────────────────────────────────────

const docTypeLabels: Record<string, string> = {
    contract_paid_full_ru: "Договор полной оплаты (рус)",
    contract_paid_50_50_ru: "Договор 50/50 (рус)",
    contract_free_ru: "Договор (бесплатный, рус)",
    refund_application: "Заявление на возврат",
    pause_application: "Заявление на паузу",
    avr_kub_group: "АВР KUB Group",
    receipt_refund_full: "Расписка о полном возврате",
    receipt_refund_partial: "Расписка о частичном возврате",
    cancel_appointment: "Заявление на отмену записи",
    documents_handover_act: "Акт приёма-передачи документов",
    visa_questionnaire: "Визовый опросник",
    termination_transfer: "Соглашение о расторжении с передачей",
    termination_waiver: "Соглашение о расторжении с отказом от претензий",
    contract_language_courses: "Договор на языковые курсы",
    addendum_korea: "Дополнительное соглашение (Корея)",
}

// Only main types for creation
const creatableDocTypes: { value: string; label: string }[] = [
    { value: "contract_paid_full_ru", label: "Договор полной оплаты (рус)" },
    { value: "contract_paid_50_50_ru", label: "Договор 50/50 (рус)" },
    { value: "contract_free_ru", label: "Договор (бесплатный, рус)" },
    { value: "refund_application", label: "Заявление на возврат" },
    { value: "pause_application", label: "Заявление на паузу" },
    { value: "avr_kub_group", label: "АВР KUB Group" },
    { value: "receipt_refund_full", label: "Расписка о полном возврате" },
    { value: "receipt_refund_partial", label: "Расписка о частичном возврате" },
    { value: "cancel_appointment", label: "Заявление на отмену записи" },
    { value: "documents_handover_act", label: "Акт приёма-передачи документов" },
    { value: "visa_questionnaire", label: "Визовый опросник" },
    { value: "termination_transfer", label: "Соглашение о расторжении с передачей" },
    { value: "termination_waiver", label: "Соглашение о расторжении с отказом от претензий" },
    { value: "contract_language_courses", label: "Договор на языковые курсы" },
    { value: "addendum_korea", label: "Дополнительное соглашение (Корея)" },
]

const statusLabels: Record<string, string> = {
    draft: "Черновик",
    under_review: "На проверке",
    approved: "Утвержден",
    returned: "Возвращён",
    signed: "Подписан",
}

const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    under_review: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    returned: "bg-orange-100 text-orange-800",
    signed: "bg-blue-100 text-blue-800",
}

const signStatusLabels: Record<string, string> = {
    pending: "Ожидание",
    approved: "Подтверждено",
    expired: "Истекло",
}

const signStatusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    expired: "bg-red-100 text-red-700",
}

// Extra keys by doc type
function getExtraDefaults(docType: string): Record<string, any> {
    switch (docType) {
        case "contract_paid_full_ru":
            return { CONTRACT_NUMBER: "", CONTRACT_DATE_TEXT: "" }
        case "contract_paid_50_50_ru":
            return { CONTRACT_NUMBER: "", CONTRACT_DATE_TEXT: "", PREPAY_AMOUNT_NUM: "", PREPAY_AMOUNT_TEXT: "" }
        case "contract_free_ru":
            return { CONTRACT_NUMBER: "", CONTRACT_DATE_TEXT: "" }
        case "refund_application":
            return { reason_code: "", REFUND_REASON_TEXT: "", REFUND_AMOUNT_NUM: "", REFUND_AMOUNT_TEXT: "" }
        case "pause_application":
            return { reason_code: "", PAUSE_REASON_TEXT: "", PAUSE_FROM_DATE: "", PAUSE_TO_DATE: "" }
        case "avr_kub_group":
            return {}
        case "receipt_refund_full":
            return { REFUND_AMOUNT_NUM: "", REFUND_AMOUNT_TEXT: "", REFUND_DATE: "" }
        case "receipt_refund_partial":
            return { REFUND_AMOUNT_NUM: "", REFUND_AMOUNT_TEXT: "", REFUND_DATE: "" }
        case "cancel_appointment":
            return { reason_code: "", CANCEL_DATE: "" }
        case "documents_handover_act":
            return { DOCS_PRESENT: "", HANDOVER_DATE: "" }
        case "visa_questionnaire":
            return {}
        case "termination_transfer":
            return { TERMINATION_DATE: "" }
        case "termination_waiver":
            return { TERMINATION_DATE: "" }
        case "contract_language_courses":
            return { CONTRACT_NUMBER: "", CONTRACT_DATE_TEXT: "" }
        case "addendum_korea":
            return { ADDENDUM_NUMBER: "", ADDENDUM_DATE: "" }
        default:
            return {}
    }
}

// Russian labels for extra fields
function getFieldLabel(key: string): string {
    const labels: Record<string, string> = {
        CONTRACT_NUMBER: "Номер договора",
        CONTRACT_DATE_TEXT: "Дата договора",
        PREPAY_AMOUNT_NUM: "Сумма предоплаты (цифрами)",
        PREPAY_AMOUNT_TEXT: "Сумма предоплаты (текстом)",
        reason_code: "Код причины",
        REFUND_REASON_TEXT: "Причина возврата",
        REFUND_AMOUNT_NUM: "Сумма возврата (цифрами)",
        REFUND_AMOUNT_TEXT: "Сумма возврата (текстом)",
        PAUSE_REASON_TEXT: "Причина паузы",
        PAUSE_FROM_DATE: "Дата начала паузы",
        PAUSE_TO_DATE: "Дата окончания паузы",
        REFUND_DATE: "Дата возврата",
        CANCEL_DATE: "Дата отмены",
        DOCS_PRESENT: "Передаваемые документы",
        HANDOVER_DATE: "Дата передачи",
        TERMINATION_DATE: "Дата расторжения",
        ADDENDUM_NUMBER: "Номер доп. соглашения",
        ADDENDUM_DATE: "Дата доп. соглашения",
    }
    return labels[key] || key
}

// Check if a field is a date field
function isDateField(key: string): boolean {
    const dateFields = [
        "CONTRACT_DATE_TEXT",
        "PAUSE_FROM_DATE",
        "PAUSE_TO_DATE",
        "REFUND_DATE",
        "CANCEL_DATE",
        "HANDOVER_DATE",
        "TERMINATION_DATE",
        "ADDENDUM_DATE",
    ]
    return dateFields.includes(key)
}

// ─── Combobox Component ──────────────────────────────────────────

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

// ─── Role helper ─────────────────────────────────────────────────

function getRoleKey(roleId?: number): string {
    const map: Record<number, string> = { 50: "system_admin", 40: "leadership", 30: "control", 20: "operations", 10: "sales" }
    return map[roleId || 0] || "user"
}

// Helper function to get role code from user data
function getRoleCode(user: any) {
    if (!user) return undefined;
    if (typeof user.role === 'string') return user.role;
    if (user.role?.code) return user.role.code;
    if (user.role?.id) {
        return getRoleKey(user.role.id);
    }
    if (user.role_id) {
        return getRoleKey(Number(user.role_id));
    }
    return undefined;
}

// ─── Main Page ───────────────────────────────────────────────────

export default function DocumentsPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()

    const [documents, setDocuments] = useState<Document[]>([])
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [docTypeFilter, setDocTypeFilter] = useState("");
    const [dealIdFilter, setDealIdFilter] = useState("");
    const [clientIdFilter, setClientIdFilter] = useState("");
    const [clientTypeFilter, setClientTypeFilter] = useState("");
    const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>("active");
    const [sortBy, setSortBy] = useState("created_at");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [totalDocuments, setTotalDocuments] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)

    const [clients, setClients] = useState<any[]>([])
    const [deals, setDeals] = useState<any[]>([])
    const [currentUser, setCurrentUserState] = useState<any>(null)
    const [freshUserData, setFreshUserData] = useState<any>(null)
    const [isReadOnly, setIsReadOnly] = useState(false)
    const [canWriteDocuments, setCanWriteDocuments] = useState(false)
    const [selectedDealId, setSelectedDealId] = useState<number | null>(null)
    
    // Get fresh user data or fallback to state
    const user = freshUserData || currentUser;
    
    // Fetch fresh user data on mount
    useEffect(() => {
        const fetchFreshUserData = async () => {
            try {
                console.log('Fetching fresh user data for documents page...');
                const userData = await AuthAPI.getMe();
                console.log('Fresh user data received in documents:', userData);
                
                // Transform API response to match User interface
                const transformedUser = {
                    id: String(userData.id),
                    full_name: userData.full_name,
                    email: userData.email,
                    phone: userData.phone,
                    role: userData.role || { id: 0, code: '', legacy_name: '' },
                    branch: userData.branch || null,
                    is_active: userData.is_active,
                    is_verified: userData.is_verified,
                    telegram: userData.telegram || { chat_id: 0, notify_tasks: false },
                    legacy: userData.legacy || { company_name: '', bin_iin: '' },
                    // Optional fields that may not exist in current backend response
                    first_name: (userData as any).first_name,
                    last_name: (userData as any).last_name,
                    middle_name: (userData as any).middle_name,
                    position: (userData as any).position,
                    // Legacy fields for backward compatibility
                    role_id: userData.role?.id,
                    company_name: userData.legacy?.company_name,
                    bin_iin: userData.legacy?.bin_iin,
                    telegram_chat_id: userData.telegram?.chat_id,
                    notify_tasks_telegram: userData.telegram?.notify_tasks,
                    status: 'active'
                };
                
                console.log('Transformed user data in documents:', transformedUser);
                setFreshUserData(transformedUser);

                // Set document write permissions
                const userRole = getRoleCode(transformedUser);
                const hasDocumentWriteAccess = hasPermission(userRole, ["documents:write"]);
                setCanWriteDocuments(hasDocumentWriteAccess);
                console.log('Document write permissions:', { userRole, hasDocumentWriteAccess });
                
                // Update localStorage with fresh data
                setCurrentUser(transformedUser);
                setCurrentUserState(transformedUser);
            } catch (error) {
                console.error('Failed to fetch fresh user data in documents:', error);
            }
        };
        
        fetchFreshUserData();
    }, []); // Run once on mount

    // ─── Create form state ──────────────────────────────────────

    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [createForm, setCreateForm] = useState({
        client_id: "",
        client_type: "" as string,
        deal_id: "",
        doc_type: "contract_paid_full_ru" as string,
        extra: {} as Record<string, any>,
    })
    const [createError, setCreateError] = useState<string | null>(null)
    const [filteredDeals, setFilteredDeals] = useState<any[]>([])
    const [loadingDeals, setLoadingDeals] = useState(false)

    // ─── Details / View ─────────────────────────────────────────

    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)

    // ─── Delete ─────────────────────────────────────────────────

    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [deleteId, setDeleteId] = useState<number | null>(null)

    // ─── Review ─────────────────────────────────────────────────

    const [isReviewOpen, setIsReviewOpen] = useState(false)
    const [reviewDoc, setReviewDoc] = useState<Document | null>(null)

    // ─── Send for signing (link-based) ────────────────────────────

    const [isSignDialogOpen, setIsSignDialogOpen] = useState(false);
    const [signingDoc, setSigningDoc] = useState<Document | null>(null);
    const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
    const [isUnarchiveDialogOpen, setIsUnarchiveDialogOpen] = useState(false);
    const [docToArchive, setDocToArchive] = useState<Document | null>(null);
    const [signLinkDoc, setSignLinkDoc] = useState<Document | null>(null);
    const [isSignLinkOpen, setIsSignLinkOpen] = useState(false);
    const [signLinkUrl, setSignLinkUrl] = useState("")
    const [signLinkLoading, setSignLinkLoading] = useState(false)
    const [signEmail, setSignEmail] = useState("")

    // ─── New Send for Signature Modal (with channel selection) ───────

    const [isNewSignModalOpen, setIsNewSignModalOpen] = useState(false)
    const [newSignDoc, setNewSignDoc] = useState<Document | null>(null)

    // ─── PDF Viewer ─────────────────────────────────────────────

    const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false)
    const [selectedPdfDoc, setSelectedPdfDoc] = useState<Document | null>(null)

    // ─── Pagination ─────────────────────────────────────────────

    const currentPage = Number(searchParams.get("page")) || 1
    const size = 15

    // Initialize filter states from URL
    useEffect(() => {
        setStatusFilter(searchParams.get('status') || '');
        setDocTypeFilter(searchParams.get('doc_type') || '');
        setDealIdFilter(searchParams.get('deal_id') || '');
        setClientIdFilter(searchParams.get('client_id') || '');
        setClientTypeFilter(searchParams.get('client_type') || '');
        setSortBy(searchParams.get('sort_by') || 'created_at');
        setSortOrder((searchParams.get('order') as 'asc' | 'desc') || 'desc');
    }, [searchParams]);

    // Update URL when filters change
    const updateURL = () => {
        const params = new URLSearchParams();
        if (currentPage > 1) params.set('page', currentPage.toString());
        if (searchTerm) params.set('q', searchTerm);
        if (statusFilter) params.set('status', statusFilter);
        if (docTypeFilter) params.set('doc_type', docTypeFilter);
        if (dealIdFilter) params.set('deal_id', dealIdFilter);
        if (clientIdFilter) params.set('client_id', clientIdFilter);
        if (clientTypeFilter) params.set('client_type', clientTypeFilter);
        if (archiveFilter !== 'active') params.set('archive', archiveFilter);
        params.set('sort_by', sortBy);
        params.set('order', sortOrder);
        router.push(`${pathname}?${params.toString()}`);
    };

    // Reset filters
    const resetFilters = () => {
        setSearchTerm('');
        setStatusFilter('');
        setDocTypeFilter('');
        setDealIdFilter('');
        setClientIdFilter('');
        setClientTypeFilter('');
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
    }, [statusFilter, docTypeFilter, dealIdFilter, clientIdFilter, clientTypeFilter, archiveFilter, sortBy, sortOrder]);

    // ─── Fetch Documents ─────────────────────────────────────────

    const fetchDocuments = async () => {
        setLoading(true)
        try {
            const userRole = getRoleCode(user);
            const isSales = userRole === 'sales';

            // Sales users can only access documents via deal endpoint
            if (isSales) {
                if (selectedDealId) {
                    // Fetch documents for the selected deal
                    const params: any = { page: currentPage, size: size }
                    if (searchTerm) params.q = searchTerm

                    const res = await getDocumentsByDeal(selectedDealId, params)
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
                    const total = (res as any)?.pagination?.total || (res as any)?.total || data.length
                    const totalPagesFromBackend = (res as any)?.pagination?.total_pages || Math.ceil(total / size)

                    // Client-side filtering as fallback if backend doesn't support search
                    if (searchTerm) {
                        const term = searchTerm.toLowerCase()
                        data = data.filter((doc: any) =>
                            doc.doc_type?.toLowerCase().includes(term) ||
                            doc.id?.toString().includes(term)
                        )
                    }

                    // Filter by archive status on frontend
                    if (archiveFilter !== "active") {
                        if (archiveFilter === "archived") {
                            data = data.filter((doc: any) => doc.is_archived)
                        } else {
                            data = data.filter((doc: any) => !doc.is_archived)
                        }
                    }

                    setDocuments(data)
                    setTotalDocuments(total)
                    setTotalPages(totalPagesFromBackend)
                } else {
                    // Sales user without selected deal - fetch their deals first, then documents
                    const dealsRes = await DealsAPI.list_my_deals(undefined, {})
                    const userDeals = Array.isArray(dealsRes) ? dealsRes : (dealsRes as any)?.data || []
                    
                    // Filter out archived deals
                    const nonArchivedDeals = userDeals.filter((d: any) => !d.is_archived)
                    
                    if (nonArchivedDeals.length === 0) {
                        setDocuments([])
                        setTotalDocuments(0)
                        return
                    }

                    // Fetch documents for each deal
                    const allDocs: any[] = []
                    for (const deal of nonArchivedDeals) {
                        try {
                            const dealDocs = await getDocumentsByDeal(deal.id, {})
                            const docs = Array.isArray(dealDocs) ? dealDocs : (dealDocs as any)?.data || []
                            allDocs.push(...docs)
                        } catch (err) {
                            console.error(`Error fetching documents for deal ${deal.id}:`, err)
                        }
                    }

                    // Apply filters on frontend
                    let filteredDocs = allDocs
                    
                    // Apply search filter
                    if (searchTerm) {
                        const term = searchTerm.toLowerCase()
                        filteredDocs = filteredDocs.filter((doc: any) => 
                            doc.doc_type?.toLowerCase().includes(term) ||
                            doc.id?.toString().includes(term)
                        )
                    }
                    
                    // Filter by archive status
                    if (archiveFilter !== "active") {
                        if (archiveFilter === "archived") {
                            filteredDocs = filteredDocs.filter((doc: any) => doc.is_archived)
                        } else {
                            filteredDocs = filteredDocs.filter((doc: any) => !doc.is_archived)
                        }
                    }

                    setDocuments(filteredDocs)
                    setTotalDocuments(filteredDocs.length)
                }
            } else {
                // Non-sales users can use the general endpoint
                const params: any = { page: currentPage, size: size }
                if (searchTerm) params.q = searchTerm
                if (statusFilter) params.status = statusFilter
                if (docTypeFilter) params.doc_type = docTypeFilter
                if (dealIdFilter) params.deal_id = dealIdFilter
                if (clientIdFilter) params.client_id = clientIdFilter
                if (clientTypeFilter) params.client_type = clientTypeFilter
                if (archiveFilter !== "active") params.archive = archiveFilter
                params.sort_by = sortBy
                params.order = sortOrder

                const res = await getDocuments(params)
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
                const totalPagesFromBackend = (res as any)?.pagination?.total_pages || Math.ceil(total / size)

                setDocuments(data)
                setTotalDocuments(total)
                setTotalPages(totalPagesFromBackend)
            }
        } catch (err: any) {
            console.error("Error loading documents:", err)
            toast.error(err?.message || "Ошибка при загрузке документов")
        } finally {
            setLoading(false)
        }
    }

    // ─── Handlers ────────────────────────────────────────────────

    const uploadInputRef = useRef<HTMLInputElement>(null)

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            // Handle file selection
        }
    }

    const openCreate = () => {
        setCreateForm({
            client_id: "",
            client_type: "",
            deal_id: selectedDealId?.toString() || "",
            doc_type: "contract_paid_full_ru",
            extra: {},
        })
        setCreateError(null)
        setIsCreateOpen(true)
    }

    const handleViewFile = async (doc: Document) => {
        setSelectedPdfDoc(doc)
        setIsPdfViewerOpen(true)
    }

    const handleDownload = async (doc: Document) => {
        try {
            await downloadDocument(doc.id)
            toast.success("Документ скачан")
        } catch (err: any) {
            toast.error(err?.message || "Ошибка при скачивании документа")
        }
    }

    const triggerUploadForDoc = (doc: Document) => {
        setSelectedDoc(doc)
        if (uploadInputRef.current) {
            uploadInputRef.current.click()
        }
    }

    const handleSubmit = async (doc: Document) => {
        setActionLoading(true)
        try {
            await submitDocument(doc.id)
            toast.success("Документ отправлен на проверку")
            await fetchDocuments()
        } catch (err: any) {
            console.error("Error submitting:", err)
            toast.error(err?.message || "Ошибка при отправке на ревью")
        } finally {
            setActionLoading(false)
        }
    }

    const handlePageChange = (page: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("page", page.toString())
        router.push(`${pathname}?${params.toString()}`)
    }

    const handleDocTypeChange = (value: string) => {
        setCreateForm({ ...createForm, doc_type: value })
    }

    const handleExtraChange = (key: string, value: any) => {
        setCreateForm({ ...createForm, extra: { ...createForm.extra, [key]: value }})
    }

    const handleCreate = async () => {
        if (!createForm.client_id || !createForm.deal_id || !createForm.client_type) {
            setCreateError("Необходимо выбрать клиента и сделку")
            return
        }

        setActionLoading(true)
        setCreateError(null)
        try {
            await createDocumentFromClient({
                client_id: Number(createForm.client_id),
                client_type: createForm.client_type,
                deal_id: Number(createForm.deal_id),
                doc_type: createForm.doc_type,
                extra: createForm.extra,
            })
            toast.success("Документ успешно создан")
            setIsCreateOpen(false)
            await fetchDocuments()
        } catch (err: any) {
            console.error("Error creating document:", err)
            setCreateError(err?.message || "Ошибка при создании документа")
        } finally {
            setActionLoading(false)
        }
    }

    const handleDeleteConfirm = async () => {
        if (!deleteId) return
        setActionLoading(true)
        try {
            await deleteDocument(deleteId)
            toast.success("Документ успешно удален")
            await fetchDocuments()
        } catch (err: any) {
            console.error("Delete error:", err)
            const errorMsg = err?.response?.data?.message || err?.message || 'Unknown error'
            if (errorMsg.includes('foreign key') || errorMsg.includes('constraint') || errorMsg.includes('violates') || err?.response?.status === 500) {
                toast.error("Невозможно удалить документ, так как он связан с другими записями. Сначала удалите связанные записи или используйте архивацию.")
            } else {
                toast.error(`Ошибка при удалении документа: ${errorMsg}`)
            }
        } finally {
            setActionLoading(false)
            setIsDeleteOpen(false)
            setDeleteId(null)
        }
    }

    const handleArchiveDocument = async () => {
        if (!docToArchive) return;
        try {
            const { archiveDocument } = await import("@/src/api/documents.api");
            await archiveDocument(docToArchive.id);
            toast.success("Документ успешно заархивирован");
            await fetchDocuments();
        } catch (err: any) {
            console.error("Archive error:", err);
            toast.error(err?.message || "Ошибка при архивации документа");
        } finally {
            setIsArchiveDialogOpen(false);
            setDocToArchive(null);
        }
    };

    const handleUnarchiveDocument = async () => {
        if (!docToArchive) return;
        try {
            const { unarchiveDocument } = await import("@/src/api/documents.api");
            await unarchiveDocument(docToArchive.id);
            toast.success("Документ успешно разархивирован");
            await fetchDocuments();
        } catch (err: any) {
            console.error("Unarchive error:", err);
            toast.error(err?.message || "Ошибка при разархивации документа");
        } finally {
            setIsUnarchiveDialogOpen(false);
            setDocToArchive(null);
        }
    };

    const isAdmin = getRoleCode(user) === 'system_admin';

    // ─── Load data on mount and when filters change ───────────────

    useEffect(() => {
        if (user) {
            fetchDocuments()
        }
    }, [currentPage, statusFilter, docTypeFilter, dealIdFilter, clientIdFilter, clientTypeFilter, archiveFilter, sortBy, sortOrder, user])

    // Update URL when filters change
    useEffect(() => {
        updateURL();
    }, [statusFilter, docTypeFilter, dealIdFilter, clientIdFilter, clientTypeFilter, archiveFilter, sortBy, sortOrder]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (user) {
                fetchDocuments()
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [searchTerm, user])

    // ─── Load deals and clients for table display ───────────────────

    useEffect(() => {
        const loadDealsAndClients = async () => {
            if (!user) return;

            try {
                const userRole = getRoleCode(user);
                
                // Load deals
                const dealsFetchFn = userRole === 'sales' ? DealsAPI.list_my_deals : DealsAPI.list_deals;
                const dealsRes = await dealsFetchFn(undefined, { page: 1, size: 1000 });
                const dealsData = Array.isArray(dealsRes) ? dealsRes : (dealsRes as any)?.data || [];
                setDeals(dealsData);

                // Load clients
                const clientsFetchFn = userRole === 'sales' ? ClientAPI.listMyClients : ClientAPI.listClients;
                const clientsRes = await clientsFetchFn({ page: 1, size: 1000 });
                const clientsData = Array.isArray(clientsRes) ? clientsRes : (clientsRes as any)?.data || [];
                setClients(clientsData);
            } catch (err: any) {
                console.error("Error loading deals and clients:", err);
            }
        };

        loadDealsAndClients();
    }, [user]);

    // ─── Load clients for create dialog ────────────────────────────

    useEffect(() => {
        const loadClientsForCreate = async () => {
            if (!isCreateOpen || !user) return
            
            try {
                const userRole = getRoleCode(user);
                const fetchFn = userRole === 'sales' ? ClientAPI.listMyClients : ClientAPI.listClients;
                const res = await fetchFn({ page: 1, size: 1000 });
                const data = Array.isArray(res) ? res : (res as any)?.data || [];
                setClients(data);
            } catch (err: any) {
                console.error("Error loading clients for create dialog:", err);
                toast.error("Ошибка при загрузке клиентов");
            }
        };

        loadClientsForCreate();
    }, [isCreateOpen, user])

    // ─── Load deals filtered by client ─────────────────────────────

    const loadDealsForClient = async (clientId: string, clientType: string) => {
        if (!clientId || !clientType) {
            setFilteredDeals([])
            return
        }

        setLoadingDeals(true)
        try {
            const userRole = getRoleCode(user);
            const fetchFn = userRole === 'sales' ? DealsAPI.list_my_deals : DealsAPI.list_deals;
            
            const params = { 
                client_id: Number(clientId), 
                client_type: clientType,
                status_group: 'active'
            };
            
            const res = await fetchFn(undefined, params);
            const data = Array.isArray(res) ? res : (res as any)?.data || [];
            
            setFilteredDeals(data);
        } catch (err: any) {
            console.error("Error loading deals for client:", err);
            setFilteredDeals([]);
        } finally {
            setLoadingDeals(false)
        }
    }

    // ─── Review (approve / return) ──────────────────────────────

    const handleReview = async (action: "approve" | "return") => {
        if (!reviewDoc) return
        setActionLoading(true)
        try {
            await reviewDocument(reviewDoc.id, action)
            toast.success(action === "approve" ? "Документ утверждён" : "Документ возвращён")
            setIsReviewOpen(false)
            setReviewDoc(null)
            await fetchDocuments()
        } catch (err: any) {
            console.error("Error reviewing:", err)
            toast.error(err?.message || "Ошибка при ревью")
        } finally {
            setActionLoading(false)
        }
    }

    // ─── Send for signing (generate link) ─────────────────────────

    /** Ensure any URL uses https:// protocol */
    const enforceHttps = (url: string): string => {
        return url.replace(/^http:\/\//i, 'https://')
    }

    /** Get the base app URL, always over HTTPS */
    const getSecureBaseUrl = (): string => {
        // 1. Prefer explicit env variable
        const envUrl = process.env.NEXT_PUBLIC_APP_URL
        if (envUrl) return enforceHttps(envUrl.replace(/\/$/, ''))
        // 2. Fallback to window.location.origin, enforcing https
        if (typeof window !== 'undefined') {
            return enforceHttps(window.location.origin)
        }
        return 'https://89.35.124.133:4000'
    }

    const handleSendForSign = async (doc: Document) => {
        setSignLinkDoc(doc)
        setSignLinkUrl("")
        
        // Try to get client email for pre-filling
        let clientEmail = ""
        if (doc.client_id) {
            const client = clients.find(c => c.id?.toString() === doc.client_id?.toString())
            if (client?.email) {
                clientEmail = client.email
            } else if (client?.legal_profile?.contact_person_email) {
                clientEmail = client.legal_profile.contact_person_email
            }
        }
        setSignEmail(clientEmail)
        
        setIsSignLinkOpen(true)
        setSignLinkLoading(true)
        try {
            const res = await generateSignLink(doc.id)
            // Always enforce HTTPS on the generated link
            const rawUrl = res?.url || `${getSecureBaseUrl()}/public/sign/${res?.token}`
            const publicUrl = enforceHttps(rawUrl)
            setSignLinkUrl(publicUrl)
            toast.success("Ссылка для подписи сгенерирована")
        } catch (err: any) {
            console.error("Error generating sign link:", err)
            toast.error(err?.message || "Ошибка генерации ссылки подписания")
        } finally {
            setSignLinkLoading(false)
        }
    }

    const handleCopySignLink = () => {
        if (!signLinkUrl) return
        navigator.clipboard.writeText(signLinkUrl)
        toast.success("Ссылка скопирована в буфер обмена")
    }

    const handleShareWhatsApp = () => {
        if (!signLinkUrl) return
        const text = encodeURIComponent(`Пожалуйста, подпишите документ по ссылке: ${signLinkUrl}`)
        window.open(`https://wa.me/?text=${text}`, "_blank")
    }

    const handleShareTelegram = () => {
        if (!signLinkUrl) return
        const text = encodeURIComponent(`Пожалуйста, подпишите документ по ссылке: ${signLinkUrl}`)
        window.open(`https://t.me/share/url?url=${encodeURIComponent(signLinkUrl)}&text=${text}`, "_blank")
    }

    const handleSendEmailSign = async () => {
        if (!signLinkDoc || !signEmail) {
            toast.error("Введите email адрес")
            return
        }

        setSignLinkLoading(true)
        try {
            await startSign(signLinkDoc.id, signEmail)
            toast.success("Письмо с ссылкой для подписи отправлено на " + signEmail)
            setIsSignLinkOpen(false)
            setSignEmail("")
            await fetchDocuments()
        } catch (err: any) {
            console.error("Error sending email for signing:", err)
            toast.error(err?.message || "Ошибка отправки письма")
        } finally {
            setSignLinkLoading(false)
        }
    }

    // ─── New Send for Signature Handler (with channel selection) ───────

    const handleNewSendForSign = (doc: Document) => {
        setNewSignDoc(doc)
        setIsNewSignModalOpen(true)
    }

    const handleNewSignSuccess = async () => {
        await fetchDocuments()
    }

    // ─── Details ────────────────────────────────────────────────

    const handleShowDetails = async (id: number) => {
        try {
            const doc = await getDocumentById(id)
            setSelectedDoc(doc)
            setIsDetailsOpen(true)
        } catch (err: any) {
            console.error("Error loading details:", err)
            toast.error(err?.message || "Ошибка при загрузке деталей")
        }
    }

    // ─── Helpers ────────────────────────────────────────────────

    const getClientLabel = (clientId: number | string) => {
        const clientIdStr = clientId?.toString();
        console.log('Looking for client with ID:', clientIdStr, 'in clients:', clients);
        
        const c = clients.find((cl) => {
            const clIdStr = cl.id?.toString();
            console.log('Comparing:', clIdStr, 'with:', clientIdStr, 'match:', clIdStr === clientIdStr);
            return clIdStr === clientIdStr;
        });
        
        if (!c) {
            console.log('Client not found for ID:', clientIdStr);
            return `Клиент #${clientIdStr}`;
        }
        
        // Prioritize name field, then first_name + last_name
        const displayName = c.name || (c.first_name ? `${c.first_name} ${c.last_name || ""}`.trim() : `Клиент #${clientIdStr}`);
        console.log('Client display name:', displayName, 'client data:', c);
        return displayName;
    }

    // Get client through deal relationship
    const getClientFromDeal = (dealId: number | string) => {
        const dealIdStr = dealId?.toString();
        console.log('Looking for deal with ID:', dealIdStr, 'in deals:', deals);
        
        const deal = deals.find((d) => {
            const dIdStr = d.id?.toString();
            console.log('Comparing deal ID:', dIdStr, 'with:', dealIdStr, 'match:', dIdStr === dealIdStr);
            return dIdStr === dealIdStr;
        });
        
        if (!deal) {
            console.log('Deal not found for ID:', dealIdStr);
            return "—";
        }
        
        console.log('Found deal:', deal);
        
        // Try to get client from deal's client_id
        if (deal.client_id) {
            console.log('Deal has client_id:', deal.client_id);
            return getClientLabel(deal.client_id);
        }
        
        // If no client_id in deal, try to find client by matching logic
        console.log('Deal has no client_id, searching by other means...');
        return "Клиент через сделку";
    }

    const getDealLabel = (dealId: number) => {
        const d = deals.find((dl) => dl.id?.toString() === dealId?.toString())
        if (!d) return `Сделка #${dealId}`
        return d.amount ? `${Number(d.amount).toLocaleString()} ₸ (#${d.id})` : `Сделка #${d.id}`
    }

    const clientOptions = clients.map((c) => ({
        value: c.id.toString(),
        label: c.first_name ? `${c.first_name} ${c.last_name || ""}`.trim() : (c.name || `#${c.id}`),
    }))

    const dealOptions = deals.map((d) => ({
        value: d.id.toString(),
        label: d.amount ? `${Number(d.amount).toLocaleString()} ₸ (#${d.id})` : `Сделка #${d.id}`,
    }))

    // ─── Stats ──────────────────────────────────────────────────

    const stats = {
        total: totalDocuments,
        draft: documents.filter((d) => d.status === "draft").length,
        underReview: documents.filter((d) => d.status === "under_review").length,
        signed: documents.filter((d) => d.status === "signed").length,
    }

    // ─── Skeleton ───────────────────────────────────────────────

    if (loading && documents.length === 0) {
        return (
            <>
                <Skeleton className="h-8 w-48 mb-4 m-6" />
                <Skeleton className="h-4 w-64 mb-8 ml-6" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 mx-6">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
                <Skeleton className="h-96 mx-6" />
            </>
        )
    }

    // ─── Render ─────────────────────────────────────────────────

    return (
        <>
            {/* Hidden file input for per-row uploads */}
            <input
                type="file"
                ref={uploadInputRef}
                className="hidden"
                accept=".pdf,.docx,.doc,.xlsx,.xls"
                onChange={handleFileSelected}
            />
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between m-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Документы</h1>
                    <p className="text-gray-600">Управление документооборотом и подписанием</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchDocuments} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                    {canWriteDocuments && (
                        <Button onClick={openCreate}>
                            <Plus className="h-4 w-4 mr-2" />
                            Создать документ
                        </Button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="mx-6 mb-6">
                <CollapsibleFilter defaultOpen={false}>
                    <Card className="overflow-visible">
                        <CardContent className="p-4 overflow-visible">
                            <div className="space-y-4 overflow-visible">
                                {/* First row: Primary filters */}
                                <div className="flex flex-col lg:flex-row gap-4 overflow-visible">
                                    <div className="flex-1">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                            <Input
                                                placeholder="Поиск по типу документа, имени файла, сделке, клиенту..."
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
                                                { value: "", label: "Все статусы" },
                                                { value: "draft", label: "Черновик" },
                                                { value: "under_review", label: "На проверке" },
                                                { value: "approved", label: "Утвержден" },
                                                { value: "returned", label: "Возвращён" },
                                                { value: "signed", label: "Подписан" },
                                            ]}
                                        />
                                    </div>
                                    <div className="w-full sm:w-48 overflow-visible">
                                        <CustomSelect
                                            value={docTypeFilter}
                                            onChange={setDocTypeFilter}
                                            placeholder="Тип документа"
                                            className="w-full"
                                            options={[
                                                { value: "", label: "Все типы" },
                                                ...creatableDocTypes
                                            ]}
                                        />
                                    </div>
                                    <div className="w-full sm:w-48 overflow-visible">
                                        <ArchiveFilter
                                            value={archiveFilter}
                                            onChange={setArchiveFilter}
                                        />
                                    </div>
                                </div>
                                {/* Second row: Secondary filters */}
                                <div className="flex flex-col lg:flex-row gap-4 overflow-visible">
                                    <div className="w-full sm:w-48 overflow-visible">
                                        <Input
                                            placeholder="ID сделки"
                                            value={dealIdFilter}
                                            onChange={(e) => setDealIdFilter(e.target.value)}
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="w-full sm:w-48 overflow-visible">
                                        <Input
                                            placeholder="ID клиента"
                                            value={clientIdFilter}
                                            onChange={(e) => setClientIdFilter(e.target.value)}
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="w-full sm:w-48 overflow-visible">
                                        <CustomSelect
                                            value={clientTypeFilter}
                                            onChange={setClientTypeFilter}
                                            placeholder="Тип клиента"
                                            className="w-full"
                                            options={[
                                                { value: "", label: "Все типы" },
                                                { value: "individual", label: "Физическое лицо" },
                                                { value: "legal", label: "Юридическое лицо" },
                                            ]}
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
                                                    { value: "doc_type", label: "Тип документа" },
                                                    { value: "name", label: "Имя" },
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
                            </div>
                        </CardContent>
                    </Card>
                </CollapsibleFilter>
            </div>

            {/* Deal Filter for Sales Users */}
            {getRoleCode(currentUser) === 'sales' && (
                <div className="mx-6 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="flex-1 max-w-sm">
                            <Label htmlFor="deal-filter">Фильтр по сделке</Label>
                            <ComboboxSelect
                                value={selectedDealId || ""}
                                onChange={(val) => setSelectedDealId(val ? Number(val) : null)}
                                options={dealOptions}
                                placeholder="Выберите сделку..."
                                searchPlaceholder="Поиск сделки..."
                                emptyText="Сделки не найдены"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button
                                variant="outline"
                                onClick={() => setSelectedDealId(null)}
                                disabled={!selectedDealId}
                            >
                                Сбросить
                            </Button>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        Пользователям отдела продаж доступны только документы по их сделкам
                    </p>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 mx-6">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                                <p className="text-sm text-gray-600">Всего</p>
                            </div>
                            <FileText className="h-8 w-8 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
                                <p className="text-sm text-gray-600">Черновики</p>
                            </div>
                            <Clock className="h-8 w-8 text-gray-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold text-yellow-600">{stats.underReview}</div>
                                <p className="text-sm text-gray-600">На проверке</p>
                            </div>
                            <AlertTriangle className="h-8 w-8 text-yellow-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-bold text-green-600">{stats.signed}</div>
                                <p className="text-sm text-gray-600">Подписано</p>
                            </div>
                            <FileCheck className="h-8 w-8 text-green-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Documents Table */}
            <Card className="mx-6 mb-6">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Список документов</CardTitle>
                            <CardDescription>
                                {documents.length > 0
                                    ? `Найдено ${totalDocuments} документов`
                                    : "Документов не найдено"}
                            </CardDescription>
                        </div>
                        <div className="w-full sm:w-48">
                            <ArchiveFilter
                                value={archiveFilter}
                                onChange={setArchiveFilter}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {!documents || documents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <FileText className="h-12 w-12 text-gray-300 mb-4" />
                            <p className="text-gray-500 font-medium text-lg">Документов не найдено</p>
                            <p className="text-sm text-gray-400 mt-1">Создайте первый документ из шаблона</p>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-md border">
                            <Table className="w-full table-fixed">
                                <colgroup>
                                    <col className="w-[5%]" />
                                    <col className="w-[18%]" />
                                    <col className="w-[18%]" />
                                    <col className="w-[16%]" />
                                    <col className="w-[12%]" />
                                    <col className="w-[12%]" />
                                    <col className="w-[10%]" />
                                    <col className="w-[9%]" />
                                </colgroup>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="px-4">ID</TableHead>
                                        <TableHead className="px-4">Тип</TableHead>
                                        <TableHead className="px-4">Клиент</TableHead>
                                        <TableHead className="px-4">Сделка</TableHead>
                                        <TableHead className="px-4">Статус</TableHead>
                                        <TableHead className="px-4">Подписание</TableHead>
                                        <TableHead className="px-4">Дата</TableHead>
                                        <TableHead className="px-4 text-right">Действия</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {documents.map((doc) => {
                                        const canSubmit = doc.status === "draft"
                                        const canReview = doc.status === "under_review"
                                        const canSign = doc.status === "approved"
                                        const canDelete = !isReadOnly
                                        const isArchived = doc.is_archived

                                        return (
                                            <TableRow key={doc.id} className={doc.is_archived ? "bg-gray-200" : ""}>
                                                <TableCell className="px-4 align-top font-mono text-sm">{doc.id}</TableCell>
                                                <TableCell className="px-4 align-top">
                                                    <div className="break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                                                        {docTypeLabels[doc.doc_type] || doc.doc_type}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 align-top text-sm">
                                                    <div className="break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                                                        {(() => {
                                                            if (doc.client_id) {
                                                                return getClientLabel(doc.client_id);
                                                            }
                                                            if (doc.deal_id) {
                                                                return getClientFromDeal(doc.deal_id);
                                                            }
                                                            return "—";
                                                        })()}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 align-top text-sm">
                                                    <div className="break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                                                        {doc.deal_id ? getDealLabel(doc.deal_id) : "—"}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 align-top">
                                                    <div className="flex flex-col items-start gap-1">
                                                        <Badge className={`${statusColors[doc.status] || "bg-gray-100 text-gray-700"} text-xs`}>
                                                            {statusLabels[doc.status] || doc.status}
                                                        </Badge>
                                                        {isArchived && (
                                                            <Badge className="bg-gray-100 text-gray-800 text-xs">Архив</Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 align-top">
                                                    {doc.sign_status ? (
                                                        <Badge className={`${signStatusColors[doc.sign_status] || "bg-gray-100 text-gray-700"} text-xs`}>
                                                            {signStatusLabels[doc.sign_status] || doc.sign_status}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="px-4 align-top text-sm whitespace-nowrap">
                                                    {format(new Date(doc.created_at), "dd.MM.yyyy", { locale: ru })}
                                                </TableCell>
                                                <TableCell className="px-4 align-top text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => handleShowDetails(doc.id)}>
                                                                <FileText className="h-4 w-4 mr-2" />
                                                                Детали
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleViewFile(doc)}>
                                                                <Eye className="h-4 w-4 mr-2" />
                                                                Просмотр
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleDownload(doc)}>
                                                                <Download className="h-4 w-4 mr-2" />
                                                                Скачать PDF
                                                            </DropdownMenuItem>
                                                            {!isReadOnly && (
                                                                <DropdownMenuItem onClick={() => triggerUploadForDoc(doc)}>
                                                                    <Upload className="h-4 w-4 mr-2" />
                                                                    Загрузить файл
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuSeparator />

                                                            {/* Lifecycle actions */}
                                                            {!isReadOnly && canSubmit && (
                                                                <DropdownMenuItem onClick={() => handleSubmit(doc)}>
                                                                    <Send className="h-4 w-4 mr-2" />
                                                                    Отправить на проверку
                                                                </DropdownMenuItem>
                                                            )}
                                                            {!isReadOnly && canReview && (
                                                                <DropdownMenuItem onClick={() => { setReviewDoc(doc); setIsReviewOpen(true) }}>
                                                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                                                    Ревью
                                                                </DropdownMenuItem>
                                                            )}
                                                            {!isReadOnly && canSign && (
                                                                <DropdownMenuItem onClick={() => handleNewSendForSign(doc)}>
                                                                    <Send className="h-4 w-4 mr-2" />
                                                                    Отправить на подпись
                                                                </DropdownMenuItem>
                                                            )}

                                                            {canDelete && (
                                                                <>
                                                                    <DropdownMenuSeparator />
                                                                    {isArchived ? (
                                                                        <DropdownMenuItem onClick={() => { setDocToArchive(doc); setIsUnarchiveDialogOpen(true); }}>
                                                                            <ArchiveRestore className="h-4 w-4 mr-2" />
                                                                            Разархивировать
                                                                        </DropdownMenuItem>
                                                                    ) : (
                                                                        <DropdownMenuItem onClick={() => { setDocToArchive(doc); setIsArchiveDialogOpen(true); }}>
                                                                            <Archive className="h-4 w-4 mr-2" />
                                                                            Архивировать
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    {isAdmin && (
                                                                        <>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem
                                                                                onClick={() => { setDeleteId(doc.id); setIsDeleteOpen(true) }}
                                                                                className="text-red-600"
                                                                            >
                                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                                Удалить
                                                                            </DropdownMenuItem>
                                                                        </>
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
                            isLoading={loading}
                        />
                    </div>
                )}
            </Card>

            {/* ── Create Document Dialog ─────────────────────────────── */}
            <Dialog open={isCreateOpen} onOpenChange={(open) => {
                setIsCreateOpen(open)
                if (!open) {
                    setFilteredDeals([])
                    setCreateError(null)
                }
            }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Создать документ</DialogTitle>
                        <DialogDescription>
                            Генерация документа из шаблона на основе данных клиента и сделки.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {/* Error display */}
                    {createError && (
                        <div className="rounded-md border border-red-200 bg-red-50 p-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <XCircle className="h-5 w-5 text-red-400" />
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-red-800">
                                        Ошибка создания документа
                                    </h3>
                                    <div className="mt-2 text-sm text-red-700">
                                        <p>{createError}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Клиент <span className="text-red-500">*</span></Label>
                            <ComboboxSelect
                                value={createForm.client_id}
                                onChange={(val) => {
                                    const selectedClient = clients.find(c => c.id.toString() === val);
                                    const clientType = selectedClient?.client_type || "";
                                    setCreateForm({ 
                                        ...createForm, 
                                        client_id: val, 
                                        client_type: clientType,
                                        deal_id: "" 
                                    });
                                    setFilteredDeals([]);
                                    if (val && clientType) {
                                        loadDealsForClient(val, clientType);
                                    }
                                }}
                                options={clientOptions}
                                placeholder="Выберите клиента"
                                searchPlaceholder="Поиск клиента..."
                            />
                            {!createForm.client_id && (
                                <p className="text-xs text-red-500">Выберите клиента</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Сделка <span className="text-red-500">*</span></Label>
                            <ComboboxSelect
                                value={createForm.deal_id}
                                onChange={(val) => setCreateForm({ ...createForm, deal_id: val })}
                                options={filteredDeals.map((d) => ({
                                    value: d.id.toString(),
                                    label: d.amount ? `${Number(d.amount).toLocaleString()} ₸ (#${d.id})` : `Сделка #${d.id}`,
                                }))}
                                placeholder="Выберите сделку"
                                searchPlaceholder="Поиск сделки..."
                                disabled={!createForm.client_id || loadingDeals}
                            />
                            {createForm.client_id && !loadingDeals && filteredDeals.length === 0 && (
                                <p className="text-xs text-orange-500">У клиента нет подходящих сделок</p>
                            )}
                            {!createForm.deal_id && createForm.client_id && filteredDeals.length > 0 && (
                                <p className="text-xs text-red-500">Выберите сделку</p>
                            )}
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Тип документа</Label>
                            <CustomSelect
                                value={createForm.doc_type}
                                onChange={handleDocTypeChange}
                                placeholder="Выберите тип"
                                options={creatableDocTypes}
                            />
                        </div>

                        {/* Extra fields based on doc_type */}
                        {Object.keys(createForm.extra).length > 0 && (
                            <div className="md:col-span-2 border-t pt-4 mt-2">
                                <Label className="text-sm font-semibold text-gray-700 mb-3 block">
                                    Дополнительные поля
                                </Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {Object.entries(createForm.extra).map(([key, val]) => (
                                        <div key={key} className="space-y-1">
                                            <Label className="text-xs text-gray-500">{getFieldLabel(key)}</Label>
                                            {isDateField(key) ? (
                                                <Input
                                                    type="date"
                                                    value={val || ""}
                                                    onChange={(e) => handleExtraChange(key, e.target.value)}
                                                />
                                            ) : (
                                                <Input
                                                    value={val || ""}
                                                    onChange={(e) => handleExtraChange(key, e.target.value)}
                                                    placeholder={getFieldLabel(key)}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="ghost">Отмена</Button>
                        </DialogClose>
                        <Button
                            onClick={handleCreate}
                            disabled={actionLoading || !createForm.client_id || !createForm.deal_id || filteredDeals.length === 0}
                        >
                            {actionLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Генерация...
                                </>
                            ) : (
                                "Сгенерировать"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Details Dialog ──────────────────────────────────────── */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Документ #{selectedDoc?.id}</DialogTitle>
                        <DialogDescription>Подробная информация</DialogDescription>
                    </DialogHeader>
                    {selectedDoc && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm text-gray-500">Тип</Label>
                                    <p className="font-medium">{docTypeLabels[selectedDoc.doc_type] || selectedDoc.doc_type}</p>
                                </div>
                                <div>
                                    <Label className="text-sm text-gray-500">Статус</Label>
                                    <div className="mt-1">
                                        <Badge className={`${statusColors[selectedDoc.status] || "bg-gray-100"} text-xs`}>
                                            {statusLabels[selectedDoc.status] || selectedDoc.status}
                                        </Badge>
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm text-gray-500">ID Сделки</Label>
                                    <p className="font-medium">{selectedDoc.deal_id ? getDealLabel(selectedDoc.deal_id) : "—"}</p>
                                </div>
                                <div>
                                    <Label className="text-sm text-gray-500">Клиент</Label>
                                    <p className="font-medium">{selectedDoc.client_id ? getClientLabel(selectedDoc.client_id) : "—"}</p>
                                </div>
                                <div>
                                    <Label className="text-sm text-gray-500">Дата создания</Label>
                                    <p className="font-medium">
                                        {format(new Date(selectedDoc.created_at), "dd.MM.yyyy HH:mm", { locale: ru })}
                                    </p>
                                </div>
                                {selectedDoc.sign_status && (
                                    <div>
                                        <Label className="text-sm text-gray-500">Подписание</Label>
                                        <div className="mt-1">
                                            <Badge className={`${signStatusColors[selectedDoc.sign_status] || "bg-gray-100"} text-xs`}>
                                                {signStatusLabels[selectedDoc.sign_status] || selectedDoc.sign_status}
                                            </Badge>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {selectedDoc.file_path_pdf && (
                                <div>
                                    <Label className="text-sm text-gray-500">PDF файл</Label>
                                    <p className="text-xs text-gray-600 break-all">{selectedDoc.file_path_pdf}</p>
                                </div>
                            )}
                            {selectedDoc.file_path_docx && (
                                <div>
                                    <Label className="text-sm text-gray-500">DOCX файл</Label>
                                    <p className="text-xs text-gray-600 break-all">{selectedDoc.file_path_docx}</p>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter className="flex gap-2">
                        {selectedDoc && (
                            <>
                                <Button variant="outline" onClick={() => handleViewFile(selectedDoc)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Просмотр
                                </Button>
                                <Button variant="outline" onClick={() => handleDownload(selectedDoc)}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Скачать
                                </Button>
                            </>
                        )}
                        <Button onClick={() => setIsDetailsOpen(false)}>Закрыть</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete Dialog ───────────────────────────────────────── */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удалить документ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Это действие нельзя отменить. Если данные в документе неверны — удалите его и создайте новый.
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

            {/* ── Review Dialog ───────────────────────────────────────── */}
            <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ревью документа #{reviewDoc?.id}</DialogTitle>
                        <DialogDescription>
                            Утвердите или верните документ на доработку.
                        </DialogDescription>
                    </DialogHeader>
                    {reviewDoc && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500">Тип:</span>
                                <span className="font-medium">{docTypeLabels[reviewDoc.doc_type] || reviewDoc.doc_type}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500">Текущий статус:</span>
                                <Badge className={`${statusColors[reviewDoc.status] || "bg-gray-100"} text-xs`}>
                                    {statusLabels[reviewDoc.status] || reviewDoc.status}
                                </Badge>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="flex gap-2">
                        <DialogClose asChild>
                            <Button variant="ghost">Отмена</Button>
                        </DialogClose>
                        <Button
                            variant="outline"
                            onClick={() => handleReview("return")}
                            disabled={actionLoading}
                            className="border-orange-300 text-orange-700 hover:bg-orange-50"
                        >
                            <XCircle className="h-4 w-4 mr-2" />
                            Вернуть
                        </Button>
                        <Button
                            onClick={() => handleReview("approve")}
                            disabled={actionLoading}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {actionLoading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <CheckCircle className="h-4 w-4 mr-2" />
                            )}
                            Утвердить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Send for Signing Dialog (Link-based & Email) ────────────────── */}
            <Dialog open={isSignLinkOpen} onOpenChange={setIsSignLinkOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            <div className="flex items-center gap-2">
                                <Link className="h-5 w-5 text-blue-600" />
                                Отправить на подпись
                            </div>
                        </DialogTitle>
                        <DialogDescription>
                            Документ #{signLinkDoc?.id} — {signLinkDoc ? (docTypeLabels[signLinkDoc.doc_type] || signLinkDoc.doc_type) : ""}
                        </DialogDescription>
                    </DialogHeader>

                    {signLinkLoading ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                            <p className="text-sm text-gray-500">Генерация ссылки для подписи...</p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* Email input */}
                            <div className="space-y-2">
                                <Label htmlFor="sign-email">Email клиента</Label>
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-gray-400" />
                                    <Input
                                        id="sign-email"
                                        type="email"
                                        placeholder="client@example.com"
                                        value={signEmail}
                                        onChange={(e) => setSignEmail(e.target.value)}
                                        className="flex-1"
                                    />
                                </div>
                                <p className="text-xs text-gray-500">
                                    Отправить письмо со ссылкой для подписи на указанный email
                                </p>
                            </div>

                            {/* Send email button */}
                            <Button
                                onClick={handleSendEmailSign}
                                disabled={!signEmail || signLinkLoading}
                                className="w-full"
                            >
                                {signLinkLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Отправка...
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4 mr-2" />
                                        Отправить на email
                                    </>
                                )}
                            </Button>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-background px-2 text-muted-foreground">Или поделиться ссылкой</span>
                                </div>
                            </div>

                            {signLinkUrl ? (
                                <>
                                    {/* Link display */}
                                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                                        <p className="text-xs text-blue-700 font-medium mb-2">Ссылка для клиента:</p>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                readOnly
                                                value={signLinkUrl}
                                                className="bg-white text-sm font-mono"
                                            />
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={handleCopySignLink}
                                                title="Копировать"
                                            >
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Quick share buttons */}
                                    <div className="space-y-2">
                                        <p className="text-xs text-gray-500 font-medium">Быстрая отправка:</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                variant="outline"
                                                onClick={handleShareWhatsApp}
                                                className="border-green-200 text-green-700 hover:bg-green-50 h-11"
                                            >
                                                <MessageCircle className="h-4 w-4 mr-2" />
                                                WhatsApp
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={handleShareTelegram}
                                                className="border-blue-200 text-blue-700 hover:bg-blue-50 h-11"
                                            >
                                                <Send className="h-4 w-4 mr-2" />
                                                Telegram
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                            <div className="text-xs text-gray-600">
                                                <p>Клиент откроет ссылку, просмотрит документ и поставит графическую подпись.</p>
                                                <p className="mt-1">После подписания вы получите <strong>уведомление в Telegram</strong>, а статус документа изменится автоматически.</p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                                    <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                                    <p className="text-sm text-red-700">Не удалось сгенерировать ссылку</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => signLinkDoc && handleSendForSign(signLinkDoc)}
                                        className="mt-3"
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Повторить
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsSignLinkOpen(false)}>Закрыть</Button>
                        {signLinkUrl && (
                            <Button onClick={handleCopySignLink}>
                                <Copy className="h-4 w-4 mr-2" />
                                Копировать ссылку
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── PDF Viewer Dialog ───────────────────────────────────── */}
            <PdfViewer
                isOpen={isPdfViewerOpen}
                onClose={() => setIsPdfViewerOpen(false)}
                documentId={selectedPdfDoc?.id || 0}
                documentName={selectedPdfDoc ? (docTypeLabels[selectedPdfDoc.doc_type] || selectedPdfDoc.doc_type) : undefined}
            />

            {/* ── New Send for Signature Modal (with channel selection) ──── */}
            <SendForSignatureModal
                open={isNewSignModalOpen}
                onOpenChange={setIsNewSignModalOpen}
                document={newSignDoc}
                onSuccess={handleNewSignSuccess}
                docTypeLabel={newSignDoc ? (docTypeLabels[newSignDoc.doc_type] || newSignDoc.doc_type) : undefined}
            />

            {/* ── Archive Dialog ─────────────────────────────────────────── */}
            <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Архивировать документ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Документ будет перемещен в архив. Вы сможете восстановить его позже.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={handleArchiveDocument}>
                            Архивировать
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Unarchive Dialog ───────────────────────────────────────── */}
            <AlertDialog open={isUnarchiveDialogOpen} onOpenChange={setIsUnarchiveDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Разархивировать документ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Документ будет восстановлен из архива и снова станет доступен.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUnarchiveDocument}>
                            Разархивировать
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
