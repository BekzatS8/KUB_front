"use client";

import { useState, useEffect, useMemo } from "react";
import type { User } from "@/src/models/users.model";
import * as Models from "@/src/models/clients.model";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Badge } from "@/components/ui/badge";
import { CustomSelect } from "@/components/ui/custom-select";
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
import {
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  UserIcon,
  MapPin,
  Calendar,
  Phone,
  Mail,
  FileText,
  Heart,
  Briefcase,
  GraduationCap,
  Car,
  Users,
  CreditCard,
  Download,
  Building,
  Archive,
  ArchiveRestore,
  ArrowUp,
  ArrowDown,
  PlayCircle,
} from "lucide-react";
import { getCurrentUser, setCurrentUser, hasPermission, getRoleCode } from "@/lib/auth";
import { ArchiveFilter, ArchiveFilterValue } from "@/components/ui/archive-filter";
import { CollapsibleFilter } from "@/components/ui/collapsible-filter";
import * as ClientAPI from "@/src/api/clients.api";
import { getClientCalls } from "@/src/api/telephony.api";
import type { TelephonyCall } from "@/src/models/telephony.model";
import * as AuthAPI from "@/src/api/auth.api";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import type { CustomSelectOption } from "@/components/ui/custom-select";

const DEFAULT_CLIENT_COUNTRY = "";
const KAZAKHSTAN_COUNTRY_VALUE = "kazakhstan";
const DEFAULT_CITIZENSHIP = "Казахстан";
const DEFAULT_PHONE_COUNTRY = "KZ";
const DEFAULT_PHONE_PREFIX = "+7";

const PRIORITY_PHONE_COUNTRY_KEYS = ["KZ", "UZ", "RU", "KG", "TJ"];

const COUNTRY_NAME_OVERRIDES: Record<string, string> = {
  KZ: "Казахстан",
  UZ: "Узбекистан",
  RU: "Россия",
  KG: "Кыргызстан",
  TJ: "Таджикистан",
};

const countryDisplayNames =
  typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["ru"], { type: "region" })
    : null;

const PHONE_COUNTRIES = getCountries().map((countryCode) => ({
  key: countryCode,
  country:
    COUNTRY_NAME_OVERRIDES[countryCode] ||
    countryDisplayNames?.of(countryCode) ||
    countryCode,
  code: `+${getCountryCallingCode(countryCode)}`,
  flagUrl: `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`,
}));

const PHONE_COUNTRY_OPTIONS = [
  ...PRIORITY_PHONE_COUNTRY_KEYS.map((key) =>
    PHONE_COUNTRIES.find((country) => country.key === key)
  ).filter((country): country is (typeof PHONE_COUNTRIES)[number] => Boolean(country)),
  ...PHONE_COUNTRIES
    .filter((country) => !PRIORITY_PHONE_COUNTRY_KEYS.includes(country.key))
    .sort((a, b) => a.country.localeCompare(b.country, "ru")),
].map((country) => ({
  value: country.key,
  label: `${country.key} ${country.code}`,
  country: country.country,
  shortLabel: `${country.key} ${country.code}`,
  code: country.code,
  flagUrl: country.flagUrl,
}));

const CITIZENSHIP_COUNTRY_OPTIONS = [
  ...PRIORITY_PHONE_COUNTRY_KEYS.map((key) =>
    PHONE_COUNTRIES.find((country) => country.key === key)
  ).filter((country): country is (typeof PHONE_COUNTRIES)[number] => Boolean(country)),
  ...PHONE_COUNTRIES
    .filter((country) => !PRIORITY_PHONE_COUNTRY_KEYS.includes(country.key))
    .sort((a, b) => a.country.localeCompare(b.country, "ru")),
].map((country) => ({
  value: country.country,
  label: country.country,
}));

type PhoneCountryOption = CustomSelectOption & {
  country: string;
  shortLabel: string;
  code: string;
  flagUrl: string;
};

const renderPhoneCountryValue = (option: CustomSelectOption) => {
  const country = option as PhoneCountryOption;

  return (
    <span className="grid min-w-0 grid-cols-[24px_minmax(30px,1fr)_auto] items-center gap-2">
      <img
        src={country.flagUrl}
        alt=""
        className="h-4 w-6 shrink-0 rounded-[2px] object-cover"
        loading="lazy"
      />
      <span className="min-w-0 text-center font-medium tabular-nums">{country.value}</span>
      <span className="shrink-0 text-right text-slate-500 tabular-nums">{country.code}</span>
    </span>
  );
};

const renderPhoneCountryOption = (option: CustomSelectOption) => {
  const country = option as PhoneCountryOption;

  return (
    <span className="grid min-w-0 grid-cols-[24px_minmax(30px,1fr)_48px] items-center gap-2">
      <img
        src={country.flagUrl}
        alt=""
        className="h-4 w-6 shrink-0 rounded-[2px] object-cover"
        loading="lazy"
      />
      <span className="min-w-0 text-center font-medium tabular-nums">{country.value}</span>
      <span className="text-right text-slate-500 tabular-nums">{country.code}</span>
    </span>
  );
};

const getPhoneCountry = (key: string) =>
  PHONE_COUNTRIES.find((country) => country.key === key) ||
  PHONE_COUNTRIES.find((country) => country.key === DEFAULT_PHONE_COUNTRY)!;

const detectPhoneCountryKey = (phone: string) => {
  const trimmed = String(phone || "").trim();
  if (!trimmed) return DEFAULT_PHONE_COUNTRY;

  const match = PHONE_COUNTRIES
    .filter((country) => country.key !== "RU")
    .sort((a, b) => b.code.length - a.code.length)
    .find((country) => trimmed.startsWith(country.code));

  return match?.key || DEFAULT_PHONE_COUNTRY;
};

const withPhoneCountryCode = (phone: string, countryKey = DEFAULT_PHONE_COUNTRY) => {
  const country = getPhoneCountry(countryKey);
  const raw = String(phone || "").trim();
  if (!raw) return country.code;
  if (raw.startsWith("+")) return raw;
  return `${country.code}${raw.replace(/\D/g, "")}`;
};

type PhoneInputWithCountryProps = {
  id: string;
  value: string;
  countryKey: string;
  placeholder?: string;
  onCountryChange: (countryKey: string) => void;
  onChange: (value: string) => void;
};

function PhoneInputWithCountry({
  id,
  value,
  countryKey,
  placeholder = "700 123 45 67",
  onCountryChange,
  onChange,
}: PhoneInputWithCountryProps) {
  const selectedCountry = getPhoneCountry(countryKey);

  const handleCountryChange = (nextCountryKey: string) => {
    const currentCountry = getPhoneCountry(countryKey);
    const nextCountry = getPhoneCountry(nextCountryKey);
    const raw = String(value || "").trim();
    const localPart = raw.startsWith(currentCountry.code)
      ? raw.slice(currentCountry.code.length).trimStart()
      : raw.replace(/^\+\d{1,4}/, "").trimStart();

    onCountryChange(nextCountryKey);
    onChange(`${nextCountry.code}${localPart ? ` ${localPart}` : ""}`);
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[108px_minmax(0,1fr)]">
      <div className="min-w-0">
        <CustomSelect
          value={countryKey}
          onChange={handleCountryChange}
          options={PHONE_COUNTRY_OPTIONS}
          placeholder={`${selectedCountry.key} ${selectedCountry.code}`}
          triggerClassName="h-11 rounded-2xl px-2 text-sm"
          dropdownWidth={190}
          listClassName="max-h-72"
          renderValue={renderPhoneCountryValue}
          renderOption={renderPhoneCountryOption}
        />
      </div>
      <Input
        id={id}
        inputMode="tel"
        autoComplete="tel"
        placeholder={placeholder}
        value={withPhoneCountryCode(value, countryKey)}
        onChange={(event) => onChange(withPhoneCountryCode(event.target.value, countryKey))}
        className="h-11 min-w-0 rounded-2xl px-4 text-base"
      />
    </div>
  );
}

const EMPTY_CLIENT: Models.CreateClientRequest = {
  // Common fields
  name: "",
  bin_iin: "",
  address: "",
  actual_address: "",
  phone: DEFAULT_PHONE_PREFIX,
  email: "",
  contact_info: "",
  client_type: "individual",
  owner_id: 0,

  // Legal profile structure
  legal_profile: {
    company_name: "",
    bin: "",
    contact_person_name: "",
    contact_person_phone: DEFAULT_PHONE_PREFIX,
    legal_address: "",
    actual_address: "",
    bank_name: "",
    iban: "",
    bik: "",
    kbe: "",
    additional_info: "",
  },

  // Individual profile structure
  individual_profile: {
    last_name: "",
    first_name: "",
    middle_name: "",
    iin: "",
    id_number: "",
    passport_identity: "",
    passport_series: "",
    passport_number: "",
    registration_address: "",
    actual_address: "",
    country: DEFAULT_CLIENT_COUNTRY,
    trip_purpose: "",
    birth_date: "",
    birth_place: "",
    citizenship: DEFAULT_CITIZENSHIP,
    sex: "",
    marital_status: "",
    passport_issue_date: "",
    passport_expire_date: "",
    previous_last_name: "",
    spouse_name: "",
    spouse_contacts: "",
    has_children: false,
    children_list: "",
    education: "",
    job: "",
    trips_last5_years: "",
    relatives_in_destination: "",
    trusted_person: "",
    specialty: "",
    trusted_person_phone: "",
    driver_license_number: "",
    education_institution_name: "",
    education_institution_address: "",
    position: "",
    visas_received: "",
    visa_refusals: "",
    height: 0,
    weight: 0,
    driver_license_categories: "",
    therapist_name: "",
    clinic_name: "",
    diseases_last3_years: "",
  },

  // Individual specific fields (optional for legal clients) - kept for backward compatibility
  last_name: "",
  first_name: "",
  middle_name: "",
  iin: "",
  id_number: "",
  id_issue_date: "",
  id_expire_date: "",
  passport_identity: "",
  passport_series: "",
  passport_number: "",
  passport_issue_date: "",
  passport_expire_date: "",
  registration_address: "",
  residential_address: "",
  country: DEFAULT_CLIENT_COUNTRY,
  country_other: "",
  trip_purpose: "",
  trip_purpose_other: "",
  birth_date: "",
  birth_place: "",
  citizenship: DEFAULT_CITIZENSHIP,
  sex: "",
  marital_status: "",
  previous_last_name: "",
  spouse_name: "",
  spouse_contacts: "",
  has_children: false,
  children_list: "",
  education_level: "",
  specialty: "",
  education_institution: "",
  education_institution_address: "",
  education_institution_name: "",
  education: "",
  job: "",
  position: "",
  trips_last5_years: "",
  visas_received: "",
  visa_refusals: "",
  relatives_in_destination: "",
  trusted_person: "",
  trusted_person_phone: "",
  height: 0,
  weight: 0,
  driver_license_number: "",
  driver_license_issue_date: "",
  driver_license_expire_date: "",
  driver_license_categories: "",
  therapist_name: "",
  clinic_name: "",
  diseases_last3_years: "",
  photo_35x45: "",
};

const DetailItem = ({ label, value }: { label: string; value?: string | null }) => (
  <div>
    <p className="text-sm text-gray-500">{label}</p>
    <p className="font-medium">{value || "-"}</p>
  </div>
);

const CALL_STATUS_LABELS: Record<string, string> = {
  incoming: "Входящий",
  outgoing: "Исходящий",
  missed: "Пропущенный",
  answered: "Отвечен",
  completed: "Завершён",
  failed: "Ошибка",
  unknown: "Неизвестно",
};

const CALL_STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  answered: "default",
  completed: "default",
  incoming: "secondary",
  outgoing: "secondary",
  missed: "destructive",
  failed: "destructive",
  unknown: "outline",
};

const CALL_DIRECTION_LABELS: Record<string, string> = {
  inbound: "⬇ Входящий",
  outbound: "⬆ Исходящий",
};

function formatCallDuration(seconds?: number): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatCallDateTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ru-KZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [clientTypeFilter, setClientTypeFilter] = useState("");
  const [hasDealsFilter, setHasDealsFilter] = useState("");
  const [dealStatusGroupFilter, setDealStatusGroupFilter] = useState("all");
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>("active");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [clientFormData, setClientFormData] =
    useState<Models.CreateClientRequest>(EMPTY_CLIENT);
  const [phoneCountryKey, setPhoneCountryKey] = useState(DEFAULT_PHONE_COUNTRY);
  const [editingClient, setEditingClient] = useState<Models.Client | null>(
    null
  );

  // Reset individual/legal specific fields when client_type changes (only when creating, not editing)
  useEffect(() => {
    if (!editingClient) {
      if (clientFormData.client_type === "legal") {
        setClientFormData(prev => ({
          ...prev,
          last_name: "",
          first_name: "",
          middle_name: "",
          iin: "",
          id_number: "",
          id_issue_date: "",
          id_expire_date: "",
          passport_identity: "",
          passport_series: "",
          passport_number: "",
          passport_issue_date: "",
          passport_expire_date: "",
          registration_address: "",
          residential_address: "",
          country: "",
          country_other: "",
          trip_purpose: "",
          trip_purpose_other: "",
          birth_date: "",
          birth_place: "",
          citizenship: "",
          sex: "",
          marital_status: "",
          previous_last_name: "",
          spouse_name: "",
          spouse_contacts: "",
          has_children: false,
          children_list: "",
          education_level: "",
          specialty: "",
          education_institution: "",
          education_institution_address: "",
          education_institution_name: "",
          education: "",
          job: "",
          position: "",
          trips_last5_years: "",
          visas_received: "",
          visa_refusals: "",
          relatives_in_destination: "",
          trusted_person: "",
          trusted_person_phone: "",
          height: 0,
          weight: 0,
          driver_license_number: "",
          driver_license_issue_date: "",
          driver_license_expire_date: "",
          driver_license_categories: "",
          therapist_name: "",
          clinic_name: "",
          diseases_last3_years: "",
          photo_35x45: "",
          individual_profile: {
            ...prev.individual_profile,
            last_name: "",
            first_name: "",
            middle_name: "",
            iin: "",
            id_number: "",
            passport_identity: "",
            passport_series: "",
            passport_number: "",
            registration_address: "",
            actual_address: "",
            country: "",
            trip_purpose: "",
            birth_date: "",
            birth_place: "",
            citizenship: "",
            sex: "",
            marital_status: "",
            passport_issue_date: "",
            passport_expire_date: "",
            previous_last_name: "",
            spouse_name: "",
            spouse_contacts: "",
            has_children: false,
            children_list: "",
            education: "",
            job: "",
            trips_last5_years: "",
            relatives_in_destination: "",
            trusted_person: "",
            specialty: "",
            trusted_person_phone: "",
            driver_license_number: "",
            education_institution_name: "",
            education_institution_address: "",
            position: "",
            visas_received: "",
            visa_refusals: "",
            height: 0,
            weight: 0,
            driver_license_categories: "",
            therapist_name: "",
            clinic_name: "",
            diseases_last3_years: "",
          },
        }));
      } else {
        setClientFormData(prev => ({
          ...prev,
          name: "",
          bin_iin: "",
          address: "",
          contact_info: "",
          contact_person_position: "",
          bank_name: "",
          iban: "",
          bik: "",
          kbe: "",
          country: prev.country || DEFAULT_CLIENT_COUNTRY,
          citizenship: prev.citizenship || DEFAULT_CITIZENSHIP,
          legal_profile: {
            ...prev.legal_profile,
            company_name: "",
            bin: "",
            legal_form: "",
            director_full_name: "",
            contact_person_name: "",
            contact_person_phone: "",
            contact_person_email: "",
            legal_address: "",
            actual_address: "",
            tax_regime: "",
            website: "",
            industry: "",
            company_size: "",
            additional_info: "",
          },
        }));
      }
    }
  }, [clientFormData.client_type, editingClient]);
  const [clientToDelete, setClientToDelete] = useState<Models.Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Models.Client | null>(null);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isUnarchiveDialogOpen, setIsUnarchiveDialogOpen] = useState(false);
  const [clientToArchive, setClientToArchive] = useState<Models.Client | null>(null);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoPreviewError, setPhotoPreviewError] = useState(false);
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [clientPhotoUrl, setClientPhotoUrl] = useState<string | null>(null);
  const [clientPhotoError, setClientPhotoError] = useState(false);
  const [clientCalls, setClientCalls] = useState<TelephonyCall[]>([]);
  const [clientCallsLoading, setClientCallsLoading] = useState(false);
  const [clientCallsError, setClientCallsError] = useState<string | null>(null);

  const [clients, setClients] = useState<Models.Client[]>([]);
  const [totalClients, setTotalClients] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const currentPage = Number(searchParams.get('page')) || 1;
  const limit = 15;

  // Initialize filter states from URL
  useEffect(() => {
    setHasDealsFilter(searchParams.get('has_deals') || '');
    setDealStatusGroupFilter(searchParams.get('deal_status_group') || 'all');
    setSortBy(searchParams.get('sort_by') || 'created_at');
    setSortOrder((searchParams.get('order') as 'asc' | 'desc') || 'desc');
  }, [searchParams]);

  // Update URL when filters change
  const updateURL = () => {
    const params = new URLSearchParams();
    if (currentPage > 1) params.set('page', currentPage.toString());
    if (searchTerm) params.set('q', searchTerm);
    if (clientTypeFilter) params.set('client_type', clientTypeFilter);
    if (hasDealsFilter) params.set('has_deals', hasDealsFilter);
    if (dealStatusGroupFilter !== 'all') params.set('deal_status_group', dealStatusGroupFilter);
    if (archiveFilter !== 'active') params.set('archive', archiveFilter);
    params.set('sort_by', sortBy);
    params.set('order', sortOrder);
    router.push(`${pathname}?${params.toString()}`);
  };

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setClientTypeFilter('');
    setHasDealsFilter('');
    setDealStatusGroupFilter('all');
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
  }, [clientTypeFilter, hasDealsFilter, dealStatusGroupFilter, archiveFilter, sortBy, sortOrder]);

  const { toast } = useToast();
  // Remove useMemo - get fresh user data every time
  const [clientView, setClientView] = useState<"all" | "my">(() => {
    // Initialize with correct view based on user role
    const currentUser = getCurrentUser();
    const role = currentUser?.role;
    const isSales =
      (role as any) === 'sales' ||
      role?.code === 'sales' ||
      Number(role?.id || currentUser?.role_id || 0) === 10;
    return isSales ? 'my' : 'all';
  });
  
  // State for fresh user data from API
  const [freshUserData, setFreshUserData] = useState<any>(null);

  // Get fresh user data for each render
  const user = freshUserData || getCurrentUser();
  const userRole = getRoleCode(user);
  const canCreate = user && hasPermission(userRole, ["clients:write"]);
  const canEdit = user && hasPermission(userRole, ["clients:write"]);
  const canDelete = user && hasPermission(userRole, ["clients:write"]);

  // Debug logging
  useEffect(() => {
    console.log('Clients page debug:', {
      user: user,
      userRole: userRole,
      canCreate,
      canEdit,
      canDelete
    });
  }, [user, userRole, canCreate, canEdit, canDelete]);

  // Fetch fresh user data on mount
  useEffect(() => {
    const fetchFreshUserData = async () => {
      try {
        console.log('Fetching fresh user data...');
        const userData = await AuthAPI.getMe();
        console.log('Fresh user data received:', userData);
        
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
          // Optional fields
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
        
        console.log('Transformed user data:', transformedUser);
        setFreshUserData(transformedUser);
        
        // Update localStorage with fresh data
        setCurrentUser(transformedUser);
      } catch (error) {
        console.error('Failed to fetch fresh user data:', error);
      }
    };
    
    fetchFreshUserData();
  }, []); // Run once on mount

  const fetchClients = async () => {
    console.log('=== FETCH CLIENTS DEBUG ===');
    console.log('fetchClients called with:', {
      userRole: user?.role,
      clientView,
      currentPage,
      searchTerm,
      isLoading
    });

    setIsLoading(true);
    setError("");
    try {
      const params: any = { page: currentPage, size: limit };
      if (searchTerm) params.q = searchTerm;
      if (clientTypeFilter) params.client_type = clientTypeFilter;
      if (hasDealsFilter) params.has_deals = hasDealsFilter;
      if (dealStatusGroupFilter !== 'all') params.deal_status_group = dealStatusGroupFilter;
      if (archiveFilter !== "active") params.archive = archiveFilter;
      params.sort_by = sortBy;
      params.order = sortOrder;

      // Prevent sales users from accessing full client list - AGGRESSIVE FIX
      const currentUser = getCurrentUser(); // Get fresh user data
      const currentRoleCode = getRoleCode(currentUser) || getRoleCode(user);
      let effectiveView = currentRoleCode === 'sales' ? 'my' : clientView;

      // DOUBLE SAFEGUARD: If user is sales, ALWAYS use 'my' view regardless of state
      if (currentRoleCode === 'sales') {
        effectiveView = 'my';
        console.log('SAFEGUARD: Forced to my view for sales user');
      }

      console.log('fetchClients API call:', {
        userRole: currentUser?.role,
        userId: currentUser?.role_id,
        clientView,
        effectiveView,
        endpoint: effectiveView === "all" ? '/clients' : '/clients/my',
        params,
        currentRoleCode,
        'effectiveView === "all"': effectiveView === "all",
        'calling listClients?': effectiveView === "all"
      });

      // Check auth token
      const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      console.log('Auth token present:', !!authToken);
      console.log('Auth token (first 20 chars):', authToken?.substring(0, 20) + '...');

      // Try to decode JWT to check user_id
      if (authToken) {
        try {
          const base64Url = authToken.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          const decoded = JSON.parse(jsonPayload);
          console.log('Decoded JWT payload:', {
            user_id: decoded.user_id,
            role_id: decoded.role_id,
            exp: decoded.exp,
            iat: decoded.iat
          });
        } catch (e) {
          console.log('Failed to decode JWT:', e);
        }
      }

      // Use proper API based on user role
      console.log('Choosing API endpoint based on role:', {
        currentUserRole: currentUser?.role,
        isSales: currentRoleCode === 'sales',
        willCall: currentRoleCode === 'sales' ? 'listMyClients' : 'listClients'
      });

      // More robust role check - handle different formats and undefined roles
      const userRole = currentUser?.role;
      const userId = currentUser?.role_id;
      const isSalesRole = currentRoleCode === 'sales';

      console.log('Final role check:', { isSalesRole, userRole: currentUser?.role, userId: currentUser?.role_id });

      // AGGRESSIVE SAFEGUARD: If we get 403 on listClients, fallback to listMyClients
      let res;
      try {
        if (isSalesRole) {
          console.log('Using listMyClients for sales user');
          res = await ClientAPI.listMyClients(params);
        } else {
          console.log('Trying listClients for non-sales user');
          res = await ClientAPI.listClients(params);
        }
      } catch (error: any) {
        console.log('listClients failed, falling back to listMyClients:', error?.message);
        console.log('Error details:', {
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          data: error?.response?.data,
          code: error?.code
        });
        res = await ClientAPI.listMyClients(params);
      }

      console.log('API call completed - used fallback endpoint');

      console.log('API response:', res);
      console.log('Response type:', Array.isArray(res) ? 'array' : 'object');

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
      let total = (res as any)?.pagination?.total || (res as any)?.total || data.length;
      let totalPagesFromBackend = (res as any)?.pagination?.total_pages || Math.ceil(total / limit);

      console.log('Processed data:', {
        dataLength: data.length,
        total,
        totalPagesFromBackend,
        isArray: Array.isArray(data),
        firstItem: data[0]
      });

      setClients(data);
      setTotalClients(total);
      setTotalPages(totalPagesFromBackend);

      console.log('State updated - clients count:', data.length);
    } catch (err: any) {
      console.error('fetchClients error:', err);
      console.error('Error details:', {
        status: err?.response?.status,
        statusText: err?.response?.statusText,
        data: err?.response?.data,
        code: err?.code,
        message: err?.message
      });
      setError(err?.message || "Ошибка при загрузке клиентов");
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: err?.message || "Не удалось загрузить клиентов.",
      });
    } finally {
      setIsLoading(false);
      console.log('fetchClients completed');
    }
  };

  const handleRefresh = () => {
    console.log('handleRefresh called:', { 
      user: user?.role, 
      clientView,
      userLoaded: !!user 
    });
    
    // Ensure user is loaded before refreshing
    if (!user) {
      console.log('User not loaded, skipping refresh');
      return;
    }
    
    // Force correct view for sales users
    if (getRoleCode(user) === 'sales' && clientView === 'all') {
      console.log('Sales user with all view, switching to my view');
      setClientView('my');
      return; // Let the effect handle the fetch
    }
    
    console.log('Proceeding with fetchClients');
    fetchClients();
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    console.log('=== USEEFFECT 0: Initial User Check ===');
    const currentUser = getCurrentUser();
    console.log('Initial user check:', currentUser);
    
    if (getRoleCode(currentUser) === 'sales' && clientView === 'all') {
      console.log('Sales user detected - forcing my view');
      setClientView('my');
    }
  }, []); // Run once on mount

useEffect(() => {
    console.log('=== USEEFFECT 1: User/Role Change ===');
    console.log('User:', user);
    console.log('Client view:', clientView);
    if (getRoleCode(user) === 'sales' && clientView === 'all') {
      console.log('Sales user detected - forcing my view');
      setClientView('my');
    }
  }, [user]); // Remove clientView from dependencies to prevent infinite loop

  useEffect(() => {
    console.log('=== USEEFFECT 2: Main Fetch Trigger ===');
    console.log('Dependencies:', { clientView, currentPage, user });
    // Only fetch clients if we have a user and proper view state
    if (user) {
      console.log('User exists - calling fetchClients');
      fetchClients();
    } else {
      console.log('No user - skipping fetchClients');
    }
  }, [clientView, currentPage, clientTypeFilter, hasDealsFilter, dealStatusGroupFilter, archiveFilter, sortBy, sortOrder]); // Remove user from deps - we get fresh data in fetchClients

  // Update URL when filters change
  useEffect(() => {
    updateURL();
  }, [clientTypeFilter, hasDealsFilter, dealStatusGroupFilter, archiveFilter, sortBy, sortOrder]);

  useEffect(() => {
    console.log('=== USEEFFECT 3: Search Debounce ===');
    console.log('Search term changed:', searchTerm);
    const timer = setTimeout(() => {
      console.log('Debounce trigger - calling fetchClients');
      fetchClients(); // Always call fetchClients - it will get fresh user data
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]); // Remove user from deps

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;
    // Convert height and weight to numbers
    if (id === 'height' || id === 'weight') {
      setClientFormData((prev) => ({ ...prev, [id]: value ? Number(value) : 0 }));
    } else if (
      clientFormData.client_type === "legal" &&
      ['contact_person_name', 'contact_person_phone', 'legal_address', 'actual_address', 'bank_name', 'iban', 'bik', 'kbe', 'additional_info'].includes(id)
    ) {
      // Handle legal_profile nested fields
      setClientFormData((prev) => ({
        ...prev,
        legal_profile: {
          ...prev.legal_profile,
          [id]: value
        }
      }));
    } else {
      setClientFormData((prev) => ({ ...prev, [id]: value }));
    }
  };

  const handlePhoneChange = (value: string) => {
    setClientFormData((prev) => ({
      ...prev,
      phone: value,
      legal_profile: {
        ...prev.legal_profile,
        contact_person_phone: value,
      },
    }));
  };

  const getPassportIdentityValue = () => {
    // Use the unified field; fall back to legacy series+number for old data.
    if (clientFormData.passport_identity) return clientFormData.passport_identity;
    return [clientFormData.passport_series, clientFormData.passport_number]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ");
  };

  const handlePassportIdentityChange = (value: string) => {
    setClientFormData((prev) => ({
      ...prev,
      passport_identity: value,
      // Keep legacy fields in sync so old server paths also work.
      passport_series: "",
      passport_number: "",
    }));
  };

  const handleBooleanChange = (id: string, value: string) => {
    setClientFormData((prev) => ({ ...prev, [id]: value === 'true' }));
  };

  const getClientSubmitErrorMessage = (err: any) => {
    const message = String(err?.message || "").trim();
    const lower = message.toLowerCase();

    if (lower === "forbidden") {
      return "Нет доступа для создания или изменения клиента. Проверьте вашу роль и филиал пользователя.";
    }
    if (lower.includes("read-only")) {
      return "У вашей роли нет права создавать или редактировать клиентов. Обратитесь к администратору.";
    }
    if (lower.includes("branch")) {
      return "Клиент не создан: у вашего пользователя не указан филиал. Попросите администратора назначить филиал.";
    }

    return message || "Не удалось сохранить клиента.";
  };

  const handleCreateClick = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleEditClick = (client: Models.Client) => {
    resetForm(true); // Keep editingClient = false initially
    setEditingClient(client);

    // Check if client has individual_profile (new backend structure)
    const hasIndividualProfile = client.individual_profile && Object.keys(client.individual_profile).length > 0;
    const clientPhone = client.phone || client.legal_profile?.contact_person_phone || DEFAULT_PHONE_PREFIX;
    setPhoneCountryKey(detectPhoneCountryKey(clientPhone));

    setClientFormData({
      // Organization info
      name: client.name || "",
      bin_iin: client.bin_iin || "",
      address: client.address || "",
      contact_info: client.contact_info || "",
      client_type: client.client_type || "individual",

      // Legal profile nested fields
      legal_profile: {
        company_name: client.legal_profile?.company_name || client.name || "",
        bin: client.legal_profile?.bin || client.bin_iin || "",
        contact_person_name: client.legal_profile?.contact_person_name || client.contact_info || "",
        contact_person_phone: client.legal_profile?.contact_person_phone || clientPhone,
        legal_address: client.legal_profile?.legal_address || client.address || "",
        actual_address: client.legal_profile?.actual_address || client.actual_address || "",
        bank_name: client.legal_profile?.bank_name || client.bank_name || "",
        iban: client.legal_profile?.iban || client.iban || "",
        bik: client.legal_profile?.bik || client.bik || "",
        kbe: client.legal_profile?.kbe || client.kbe || "",
        additional_info: client.legal_profile?.additional_info || "",
      },

      // Individual profile nested fields (new backend structure)
      individual_profile: hasIndividualProfile ? {
        last_name: client.individual_profile?.last_name || "",
        first_name: client.individual_profile?.first_name || "",
        middle_name: client.individual_profile?.middle_name || "",
        iin: client.individual_profile?.iin || "",
        id_number: client.individual_profile?.id_number || "",
        passport_identity: client.individual_profile?.passport_identity || "",
        passport_series: client.individual_profile?.passport_series || "",
        passport_number: client.individual_profile?.passport_number || "",
        registration_address: client.individual_profile?.registration_address || "",
        actual_address: client.individual_profile?.actual_address || "",
        country: client.individual_profile?.country || "",
        trip_purpose: client.individual_profile?.trip_purpose || "",
        birth_date: client.individual_profile?.birth_date || "",
        birth_place: client.individual_profile?.birth_place || "",
        citizenship: client.individual_profile?.citizenship || "",
        sex: client.individual_profile?.sex || "",
        marital_status: client.individual_profile?.marital_status || "",
        passport_issue_date: client.individual_profile?.passport_issue_date || "",
        passport_expire_date: client.individual_profile?.passport_expire_date || "",
        previous_last_name: client.individual_profile?.previous_last_name || "",
        spouse_name: client.individual_profile?.spouse_name || "",
        spouse_contacts: client.individual_profile?.spouse_contacts || "",
        has_children: client.individual_profile?.has_children || false,
        children_list: client.individual_profile?.children_list || "",
        education: client.individual_profile?.education || "",
        job: client.individual_profile?.job || "",
        trips_last5_years: client.individual_profile?.trips_last5_years || "",
        relatives_in_destination: client.individual_profile?.relatives_in_destination || "",
        trusted_person: client.individual_profile?.trusted_person || "",
        specialty: client.individual_profile?.specialty || "",
        trusted_person_phone: client.individual_profile?.trusted_person_phone || "",
        driver_license_number: client.individual_profile?.driver_license_number || "",
        education_institution_name: client.individual_profile?.education_institution_name || "",
        education_institution_address: client.individual_profile?.education_institution_address || "",
        position: client.individual_profile?.position || "",
        visas_received: client.individual_profile?.visas_received || "",
        visa_refusals: client.individual_profile?.visa_refusals || "",
        height: client.individual_profile?.height || 0,
        weight: client.individual_profile?.weight || 0,
        driver_license_categories: client.individual_profile?.driver_license_categories || "",
        therapist_name: client.individual_profile?.therapist_name || "",
        clinic_name: client.individual_profile?.clinic_name || "",
        diseases_last3_years: client.individual_profile?.diseases_last3_years || "",
      } : undefined,

      // Required fields (RED) - kept for backward compatibility
      country: hasIndividualProfile ? client.individual_profile?.country || "" : client.country || "",
      trip_purpose: hasIndividualProfile ? client.individual_profile?.trip_purpose || "" : client.trip_purpose || "",
      last_name: hasIndividualProfile ? client.individual_profile?.last_name || "" : client.last_name || "",
      first_name: hasIndividualProfile ? client.individual_profile?.first_name || "" : client.first_name || "",
      birth_date: hasIndividualProfile ? client.individual_profile?.birth_date || "" : client.birth_date || "",
      phone: clientPhone,

      // Additional required fields - kept for backward compatibility
      middle_name: hasIndividualProfile ? client.individual_profile?.middle_name || "" : client.middle_name || "",
      birth_place: hasIndividualProfile ? client.individual_profile?.birth_place || "" : client.birth_place || "",
      citizenship: hasIndividualProfile ? client.individual_profile?.citizenship || "" : client.citizenship || "",
      sex: hasIndividualProfile ? client.individual_profile?.sex || "" : client.sex || "",
      marital_status: hasIndividualProfile ? client.individual_profile?.marital_status || "" : client.marital_status || "",
      iin: hasIndividualProfile ? client.individual_profile?.iin || "" : client.iin || "",
      id_number: hasIndividualProfile ? client.individual_profile?.id_number || "" : client.id_number || "",
      passport_identity: hasIndividualProfile ? client.individual_profile?.passport_identity || "" : client.passport_identity || "",
      passport_series: hasIndividualProfile ? client.individual_profile?.passport_series || "" : client.passport_series || "",
      passport_number: hasIndividualProfile ? client.individual_profile?.passport_number || "" : client.passport_number || "",
      passport_issue_date: hasIndividualProfile ? client.individual_profile?.passport_issue_date || "" : client.passport_issue_date || "",
      passport_expire_date: hasIndividualProfile ? client.individual_profile?.passport_expire_date || "" : client.passport_expire_date || "",
      registration_address: hasIndividualProfile ? client.individual_profile?.registration_address || "" : client.registration_address || "",
      actual_address: hasIndividualProfile ? client.individual_profile?.actual_address || "" : client.legal_profile?.actual_address || client.actual_address || "",
      email: client.email || "",
      photo_35x45: client.photo_35x45 || "",

      // Optional fields - kept for backward compatibility
      previous_last_name: hasIndividualProfile ? client.individual_profile?.previous_last_name || "" : client.previous_last_name || "",
      spouse_name: hasIndividualProfile ? client.individual_profile?.spouse_name || "" : client.spouse_name || "",
      spouse_contacts: hasIndividualProfile ? client.individual_profile?.spouse_contacts || "" : client.spouse_contacts || "",
      has_children: hasIndividualProfile ? client.individual_profile?.has_children || false : client.has_children || false,
      children_list: hasIndividualProfile ? client.individual_profile?.children_list || "" : client.children_list || "",
      education_level: hasIndividualProfile ? client.individual_profile?.education_level || "" : client.education_level || "",
      education: hasIndividualProfile ? client.individual_profile?.education || "" : client.education || "",
      job: hasIndividualProfile ? client.individual_profile?.job || "" : client.job || "",
      trips_last5_years: hasIndividualProfile ? client.individual_profile?.trips_last5_years || "" : client.trips_last5_years || "",
      relatives_in_destination: hasIndividualProfile ? client.individual_profile?.relatives_in_destination || "" : client.relatives_in_destination || "",
      trusted_person: hasIndividualProfile ? client.individual_profile?.trusted_person || "" : client.trusted_person || "",
      specialty: hasIndividualProfile ? client.individual_profile?.specialty || "" : client.specialty || "",
      trusted_person_phone: hasIndividualProfile ? client.individual_profile?.trusted_person_phone || "" : client.trusted_person_phone || "",
      driver_license_number: hasIndividualProfile ? client.individual_profile?.driver_license_number || "" : client.driver_license_number || "",
      education_institution_name: hasIndividualProfile ? client.individual_profile?.education_institution_name || "" : client.education_institution_name || "",
      education_institution_address: hasIndividualProfile ? client.individual_profile?.education_institution_address || "" : client.education_institution_address || "",
      position: hasIndividualProfile ? client.individual_profile?.position || "" : client.position || "",
      visas_received: hasIndividualProfile ? client.individual_profile?.visas_received || "" : client.visas_received || "",
      visa_refusals: hasIndividualProfile ? client.individual_profile?.visa_refusals || "" : client.visa_refusals || "",
      height: hasIndividualProfile ? client.individual_profile?.height || 0 : client.height || 0,
      weight: hasIndividualProfile ? client.individual_profile?.weight || 0 : client.weight || 0,
      driver_license_categories: hasIndividualProfile ? client.individual_profile?.driver_license_categories || "" : client.driver_license_categories || "",
      therapist_name: hasIndividualProfile ? client.individual_profile?.therapist_name || "" : client.therapist_name || "",
      clinic_name: hasIndividualProfile ? client.individual_profile?.clinic_name || "" : client.clinic_name || "",
      diseases_last3_years: hasIndividualProfile ? client.individual_profile?.diseases_last3_years || "" : client.diseases_last3_years || "",
    });
    setIsFormOpen(true);
  };

  const handleDeleteClick = (client: Models.Client) => {
    setClientToDelete(client);
  };

  const handleViewClick = async (client: Models.Client) => {
    setViewingClient(client);
    setClientPhotoUrl(null);
    setClientPhotoError(false);
    try {
      const profile = await ClientAPI.getClientProfile(client.id.toString());
      setClientProfile(profile);

      // Update viewingClient with profile data to include legal_profile with banking fields
      if (profile?.client) {
        setViewingClient(profile.client as any);
      }
      
      // Fetch authenticated photo if it exists
      if (profile?.files?.photo35x45?.exists) {
        const photoUrl = await ClientAPI.getClientPhoto(client.id.toString());
        setClientPhotoUrl(photoUrl);
      }
    } catch (error) {
      console.error('Failed to fetch client profile:', error);
      setClientProfile(null);
      setClientPhotoUrl(null);
    }
  };

  useEffect(() => {
    if (!viewingClient) {
      setClientCalls([]);
      setClientCallsError(null);
      return;
    }
    const id = Number(viewingClient.id);
    setClientCalls([]);
    setClientCallsLoading(true);
    setClientCallsError(null);
    getClientCalls(id)
      .then((data) => setClientCalls(data.items ?? []))
      .catch((e: any) => {
        if (e?.response?.status === 403) {
          setClientCalls([]);
        } else {
          setClientCallsError("Не удалось загрузить историю звонков");
        }
      })
      .finally(() => setClientCallsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingClient?.id]);

  const handleDeleteConfirm = async () => {
    if (!clientToDelete) return;
    try {
      await ClientAPI.deleteClient(clientToDelete.id.toString());
      toast({ title: "Успех", description: "Клиент успешно удален." });
      void fetchClients(); // Refresh list
    } catch (err: any) {
      console.error("Delete client error", err);
      const errorMsg = err?.response?.data?.message || err?.message || 'Unknown error';
      if (errorMsg.includes('foreign key') || errorMsg.includes('constraint') || errorMsg.includes('violates') || err?.response?.status === 500) {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Невозможно удалить клиента, так как он связан со сделками или документами. Сначала удалите связанные записи или используйте архивацию.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: err?.message || "Не удалось удалить клиента.",
        });
      }
    } finally {
      setClientToDelete(null);
    }
  };

  const handleArchiveClient = async () => {
    if (!clientToArchive) return;
    try {
      await ClientAPI.archiveClient(clientToArchive.id.toString());
      toast({ title: "Успех", description: "Клиент успешно заархивирован." });
      void fetchClients();
    } catch (err: any) {
      console.error("Archive client error", err);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: err?.message || "Не удалось заархивировать клиента.",
      });
    } finally {
      setIsArchiveDialogOpen(false);
      setClientToArchive(null);
    }
  };

  const handleUnarchiveClient = async () => {
    if (!clientToArchive) return;
    try {
      await ClientAPI.unarchiveClient(clientToArchive.id.toString());
      toast({ title: "Успех", description: "Клиент успешно разархивирован." });
      void fetchClients();
    } catch (err: any) {
      console.error("Unarchive client error", err);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: err?.message || "Не удалось разархивировать клиента.",
      });
    } finally {
      setIsUnarchiveDialogOpen(false);
      setClientToArchive(null);
    }
  };

  const isAdmin = getRoleCode(user) === 'system_admin';

  const requiredClientFieldLabels: Record<string, string> = {
    client_type: "Тип лица",
    country: "Страна",
    trip_purpose: "Цель поездки",
    last_name: "Фамилия",
    first_name: "Имя",
    birth_date: "Дата рождения",
    sex: "Пол",
    citizenship: "Гражданство",
    phone: "Телефон",
    name: "Название компании",
    bin_iin: "БИН",
    contact_info: "Контактное лицо",
    address: "Юридический адрес",
    iin: "ИИН",
  };

  const getClientFormFieldValue = (field: string) => {
    if (clientFormData.client_type === "legal") {
      if (field === "name") {
        return clientFormData.legal_profile?.company_name || clientFormData.name;
      }
      if (field === "bin_iin") {
        return clientFormData.legal_profile?.bin || clientFormData.bin_iin;
      }
      if (field === "contact_info") {
        return clientFormData.legal_profile?.contact_person_name || clientFormData.contact_info;
      }
      if (field === "phone") {
        return clientFormData.legal_profile?.contact_person_phone || clientFormData.phone;
      }
      if (field === "address") {
        return clientFormData.legal_profile?.legal_address || clientFormData.address;
      }
    }

    return clientFormData[field as keyof Models.CreateClientRequest];
  };

  const getMissingFieldText = (fields: string[]) =>
    fields.map((field) => requiredClientFieldLabels[field] || field).join(", ");

  const validateRequiredFields = (): boolean => {
    const requiredFields = ['client_type'];

    // Individual-specific required fields
    if (clientFormData.client_type === "individual") {
      requiredFields.push('country', 'trip_purpose', 'last_name', 'first_name', 'birth_date', 'sex', 'citizenship', 'phone');
    }

    // Legal-specific required fields
    if (clientFormData.client_type === "legal") {
      requiredFields.push('name', 'bin_iin', 'contact_info', 'phone', 'address');
    }

    const missingFields = requiredFields.filter(field => {
      const value = getClientFormFieldValue(field);
      return value === undefined || value === null || String(value).trim() === "";
    });
    
    if (missingFields.length > 0) {
      toast({
        variant: "destructive",
        title: "Ошибка валидации",
        description: `Заполните обязательные поля: ${getMissingFieldText(missingFields)}.`,
      });
      return false;
      toast({
        variant: "destructive",
        title: "Ошибка валидации",
        description: "Пожалуйста, заполните все обязательные поля, отмеченные красным цветом.",
      });
      return false;
    }
    const iinDigits = String(clientFormData.iin || "").replace(/\D/g, "");
    if (clientFormData.client_type === "individual" && clientFormData.iin && iinDigits.length !== 12) {
      toast({
        variant: "destructive",
        title: "Ошибка валидации",
        description: "ИИН должен состоять из 12 цифр.",
      });
      return false;
    }

    const binDigits = String(clientFormData.bin_iin || clientFormData.legal_profile?.bin || "").replace(/\D/g, "");
    if (clientFormData.client_type === "legal" && binDigits.length !== 12) {
      toast({
        variant: "destructive",
        title: "Ошибка валидации",
        description: "БИН должен состоять из 12 цифр.",
      });
      return false;
    }

    const phoneDigits = String(clientFormData.phone || "").replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      toast({
        variant: "destructive",
        title: "Ошибка валидации",
        description: "Телефон должен содержать минимум 10 цифр.",
      });
      return false;
    }

    return true;
  };

  const revokePhotoPreview = (url: string | null) => {
    if (url?.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  };

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedPhotoFile(file);
      setPhotoPreviewError(false);
      setPhotoPreview((previous) => {
        revokePhotoPreview(previous);
        return URL.createObjectURL(file);
      });
    }
  };

  const clearPhoto = () => {
    setSelectedPhotoFile(null);
    setPhotoPreview((previous) => {
      revokePhotoPreview(previous);
      return null;
    });
    setPhotoPreviewError(false);
  };

  const resetForm = (keepEditingClient = false) => {
    setClientFormData(EMPTY_CLIENT);
    setPhoneCountryKey(DEFAULT_PHONE_COUNTRY);
    setSelectedPhotoFile(null);
    setPhotoPreview((previous) => {
      revokePhotoPreview(previous);
      return null;
    });
    setPhotoPreviewError(false);
    if (!keepEditingClient) {
      setEditingClient(null);
    }
  };

  const handleSubmit = async () => {
    console.log('=== CLIENT SUBMISSION DEBUG ===');
    console.log('Editing client:', editingClient);
    console.log('Current form data:', clientFormData);
    console.log('Client type:', clientFormData.client_type);
    console.log('Selected photo file:', selectedPhotoFile);
    console.log('Required fields validation:');
    
    if (!validateRequiredFields()) {
      console.log('Validation failed - missing required fields');
      return;
    }
    
    console.log('Validation passed - proceeding with API call');

    // Prepare payload - only send relevant fields based on client_type
    const payload: any = {
      client_type: clientFormData.client_type,
      // Common fields that exist in backend
      name: clientFormData.name || "",
      bin_iin: clientFormData.bin_iin || "",
      address: clientFormData.address || "",
      phone: clientFormData.phone || "",
      email: clientFormData.email || "",
      contact_info: clientFormData.contact_info || "",
      actual_address: clientFormData.client_type === "legal" ? clientFormData.legal_profile?.actual_address || "" : clientFormData.actual_address || "",
    };

    // Add legal_profile for legal clients
    if (clientFormData.client_type === "legal") {
      payload.legal_profile = {
        company_name: clientFormData.name || "",
        bin: clientFormData.bin_iin || "",
        contact_person_name: clientFormData.contact_info || "",
        contact_person_phone: clientFormData.phone || "",
        legal_address: clientFormData.address || "",
        actual_address: clientFormData.legal_profile?.actual_address || "",
        bank_name: clientFormData.legal_profile?.bank_name || "",
        iban: clientFormData.legal_profile?.iban || "",
        bik: clientFormData.legal_profile?.bik || "",
        kbe: clientFormData.legal_profile?.kbe || "",
        additional_info: clientFormData.legal_profile?.additional_info || "",
      };
    } else {
      // Individual client fields - send required fields at top level for validation
      payload.last_name = clientFormData.last_name || "";
      payload.first_name = clientFormData.first_name || "";
      payload.middle_name = clientFormData.middle_name || "";
      payload.iin = clientFormData.iin || "";
      payload.id_number = clientFormData.id_number || "";
      payload.passport_identity = clientFormData.passport_identity || "";
      payload.passport_series = clientFormData.passport_series || "";
      payload.passport_number = clientFormData.passport_number || "";
      payload.passport_issue_date = clientFormData.passport_issue_date ? clientFormData.passport_issue_date.split('T')[0] : "";
      payload.passport_expire_date = clientFormData.passport_expire_date ? clientFormData.passport_expire_date.split('T')[0] : "";
      payload.registration_address = clientFormData.registration_address || "";
      payload.actual_address = clientFormData.actual_address || "";
      payload.country = clientFormData.country || "";
      payload.trip_purpose = clientFormData.trip_purpose || "";
      payload.birth_date = clientFormData.birth_date ? clientFormData.birth_date.split('T')[0] : "";
      payload.birth_place = clientFormData.birth_place || "";
      payload.citizenship = clientFormData.citizenship || "";
      payload.sex = clientFormData.sex || "";
      payload.marital_status = clientFormData.marital_status || "";
      payload.previous_last_name = clientFormData.previous_last_name || "";
      payload.spouse_name = clientFormData.spouse_name || "";
      payload.spouse_contacts = clientFormData.spouse_contacts || "";
      payload.has_children = clientFormData.has_children;
      if (clientFormData.children_list) payload.children_list = clientFormData.children_list;
      payload.education_level = clientFormData.education_level || "";
      payload.education = clientFormData.education || "";
      payload.job = clientFormData.job || "";
      payload.trips_last5_years = clientFormData.trips_last5_years || "";
      payload.relatives_in_destination = clientFormData.relatives_in_destination || "";
      payload.trusted_person = clientFormData.trusted_person || "";
      payload.specialty = clientFormData.specialty || "";
      payload.trusted_person_phone = clientFormData.trusted_person_phone || "";
      payload.driver_license_number = clientFormData.driver_license_number || "";
      payload.education_institution_name = clientFormData.education_institution_name || "";
      payload.education_institution_address = clientFormData.education_institution_address || "";
      payload.position = clientFormData.position || "";
      payload.visas_received = clientFormData.visas_received || "";
      payload.visa_refusals = clientFormData.visa_refusals || "";
      payload.height = clientFormData.height || 0;
      payload.weight = clientFormData.weight || 0;
      if (clientFormData.driver_license_categories) payload.driver_license_categories = clientFormData.driver_license_categories;
      payload.therapist_name = clientFormData.therapist_name || "";
      payload.clinic_name = clientFormData.clinic_name || "";
      payload.diseases_last3_years = clientFormData.diseases_last3_years || "";
    }

    try {
      if (editingClient) {
        console.log('Updating existing client:', editingClient.id);

        // For updates, build a separate payload that handles pointer fields correctly
        const updatePayload: any = {
          name: clientFormData.name || "",
          bin_iin: clientFormData.bin_iin || "",
          address: clientFormData.address || "",
          phone: clientFormData.phone || "",
          email: clientFormData.email || "",
          contact_info: clientFormData.contact_info || "",
          last_name: clientFormData.last_name || "",
          first_name: clientFormData.first_name || "",
          middle_name: clientFormData.middle_name || "",
          iin: clientFormData.iin || "",
          id_number: clientFormData.id_number || "",
          passport_identity: clientFormData.passport_identity || "",
          passport_series: clientFormData.passport_series || "",
          passport_number: clientFormData.passport_number || "",
          registration_address: clientFormData.registration_address || "",
          actual_address: clientFormData.client_type === "legal" ? clientFormData.legal_profile?.actual_address || "" : clientFormData.actual_address || "",
          country: clientFormData.country || "",
          trip_purpose: clientFormData.trip_purpose || "",
          birth_date: clientFormData.birth_date ? clientFormData.birth_date.split('T')[0] : "",
          birth_place: clientFormData.birth_place || "",
          citizenship: clientFormData.citizenship || "",
          sex: clientFormData.sex || "",
          marital_status: clientFormData.marital_status || "",
          passport_issue_date: clientFormData.passport_issue_date ? clientFormData.passport_issue_date.split('T')[0] : "",
          passport_expire_date: clientFormData.passport_expire_date ? clientFormData.passport_expire_date.split('T')[0] : "",
        };

        // Optional pointer fields - only send if not empty
        if (clientFormData.previous_last_name) updatePayload.previous_last_name = clientFormData.previous_last_name;
        if (clientFormData.spouse_name) updatePayload.spouse_name = clientFormData.spouse_name;
        if (clientFormData.spouse_contacts) updatePayload.spouse_contacts = clientFormData.spouse_contacts;
        if (clientFormData.has_children !== undefined) updatePayload.has_children = clientFormData.has_children;
        if (clientFormData.children_list) updatePayload.children_list = clientFormData.children_list;
        if (clientFormData.education_level) updatePayload.education_level = clientFormData.education_level;
        if (clientFormData.education) updatePayload.education = clientFormData.education;
        if (clientFormData.job) updatePayload.job = clientFormData.job;
        if (clientFormData.trips_last5_years) updatePayload.trips_last5_years = clientFormData.trips_last5_years;
        if (clientFormData.relatives_in_destination) updatePayload.relatives_in_destination = clientFormData.relatives_in_destination;
        if (clientFormData.trusted_person) updatePayload.trusted_person = clientFormData.trusted_person;
        if (clientFormData.specialty) updatePayload.specialty = clientFormData.specialty;
        if (clientFormData.trusted_person_phone) updatePayload.trusted_person_phone = clientFormData.trusted_person_phone;
        if (clientFormData.driver_license_number) updatePayload.driver_license_number = clientFormData.driver_license_number;
        if (clientFormData.education_institution_name) updatePayload.education_institution_name = clientFormData.education_institution_name;
        if (clientFormData.education_institution_address) updatePayload.education_institution_address = clientFormData.education_institution_address;
        if (clientFormData.position) updatePayload.position = clientFormData.position;
        if (clientFormData.visas_received) updatePayload.visas_received = clientFormData.visas_received;
        if (clientFormData.visa_refusals) updatePayload.visa_refusals = clientFormData.visa_refusals;
        updatePayload.height = clientFormData.height || 0;
        updatePayload.weight = clientFormData.weight || 0;
        if (clientFormData.driver_license_categories) updatePayload.driver_license_categories = clientFormData.driver_license_categories;
        if (clientFormData.therapist_name) updatePayload.therapist_name = clientFormData.therapist_name;
        if (clientFormData.clinic_name) updatePayload.clinic_name = clientFormData.clinic_name;
        if (clientFormData.diseases_last3_years) updatePayload.diseases_last3_years = clientFormData.diseases_last3_years;
        if (clientFormData.additional_info) updatePayload.additional_info = clientFormData.additional_info;

        // Add individual_profile for individual clients with height/weight
        if (clientFormData.client_type === "individual") {
          updatePayload.individual_profile = {
            education_level: clientFormData.education_level || "",
            height: clientFormData.height || 0,
            weight: clientFormData.weight || 0,
          };
        }

        // Add legal_profile for legal clients
        if (clientFormData.client_type === "legal") {
          updatePayload.legal_profile = {
            company_name: clientFormData.name || "",
            bin: clientFormData.bin_iin || "",
            contact_person_name: clientFormData.contact_info || "",
            contact_person_phone: clientFormData.phone || "",
            legal_address: clientFormData.address || "",
            actual_address: clientFormData.legal_profile?.actual_address || "",
            bank_name: clientFormData.legal_profile?.bank_name || "",
            iban: clientFormData.legal_profile?.iban || "",
            bik: clientFormData.legal_profile?.bik || "",
            kbe: clientFormData.legal_profile?.kbe || "",
            additional_info: clientFormData.legal_profile?.additional_info || "",
          };
        }

        console.log('Update payload:', updatePayload);
        await ClientAPI.updateClientWithPhoto(editingClient.id.toString(), updatePayload, selectedPhotoFile || undefined);
        toast({ title: "Успех", description: "Клиент успешно обновлен." });
      } else {
        console.log('Creating new client with payload:', payload);
        await ClientAPI.createClientWithPhoto(payload as any, selectedPhotoFile || undefined);
        toast({ title: "Успех", description: "Клиент успешно создан." });
      }
      void fetchClients(); // Refresh list
      setIsFormOpen(false);
      resetForm();
    } catch (err: any) {
      console.error("Form submit error", err);
      const submitErrorMessage = getClientSubmitErrorMessage(err);
      setError(submitErrorMessage);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: submitErrorMessage,
      });
      // Don't close modal on error - keep it open so user can fix the issue
    }
  };



  // Debug render state - only show when clients are empty
  if (clients.length === 0 && !isLoading) {
    console.log('=== RENDER DEBUG ===');
    console.log('Current clients state:', clients);
    console.log('Clients length:', clients.length);
    console.log('Is loading:', isLoading);
    console.log('Error state:', error);
  }

  return (
    <div className="flex flex-col gap-6 w-full p-6">
      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            {clientView === "my" ? "Мои клиенты" : "Клиенты"}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {clientView === "my" ? "Управление моими клиентами" : "Управление базой клиентов"}
          </p>
        </div>
        <div className="flex items-center gap-2">
            {/* View toggle - only show for non-sales users */}
            {getRoleCode(user) !== 'sales' && (
              <CustomSelect
                value={clientView}
                onChange={(value) => setClientView(value as "all" | "my")}
                placeholder="Режим просмотра"
                options={[
                  { value: "all", label: "Все клиенты" },
                  { value: "my", label: "Мои клиенты" },
                ]}
              />
            )}
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Обновить
            </Button>
            {canCreate && (
              <Button onClick={handleCreateClick} className="gradient-primary hover:opacity-90">
                <Plus className="h-4 w-4 mr-2" />
                Добавить клиента
              </Button>
            )}
          </div>
      </div>

      <CollapsibleFilter defaultOpen={false}>
        <Card className="overflow-visible">
          <CardContent className="p-4 overflow-visible">
            <div className="flex flex-col gap-4 overflow-visible">
              {/* Primary filters row */}
              <div className="flex flex-col sm:flex-row gap-4 overflow-visible">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Введите данные для поиска..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="w-48 relative overflow-visible">
                  <CustomSelect
                    value={clientTypeFilter}
                    onChange={(value) => setClientTypeFilter(value)}
                    placeholder="Тип клиента"
                    options={[
                      { value: "", label: "Все типы" },
                      { value: "individual", label: "Физическое лицо" },
                      { value: "legal", label: "Юридическое лицо" },
                    ]}
                  />
                </div>
                <div className="w-48 overflow-visible">
                  <ArchiveFilter
                    value={archiveFilter}
                    onChange={setArchiveFilter}
                  />
                </div>
                <div className="w-48 overflow-visible">
                  <div className="flex gap-2">
                    <CustomSelect
                      value={sortBy}
                      onChange={setSortBy}
                      placeholder="Сортировка"
                      options={[
                        { value: "created_at", label: "Дата создания" },
                        { value: "name", label: "Имя" },
                        { value: "display_name", label: "Отображаемое имя" },
                        { value: "client_type", label: "Тип клиента" },
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
                <Button variant="outline" onClick={resetFilters}>
                  Сбросить
                </Button>
              </div>
              {/* Secondary filters row */}
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0 overflow-visible">
                <div className="w-48 overflow-visible">
                  <CustomSelect
                    value={hasDealsFilter}
                    onChange={setHasDealsFilter}
                    placeholder="Сделки"
                    options={[
                      { value: "", label: "Все" },
                      { value: "true", label: "Со сделками" },
                      { value: "false", label: "Без сделок" },
                    ]}
                  />
                </div>
                <div className="w-48 overflow-visible">
                  <CustomSelect
                    value={dealStatusGroupFilter}
                    onChange={setDealStatusGroupFilter}
                    placeholder="Статус сделок"
                    options={[
                      { value: "all", label: "Все статусы" },
                      { value: "active", label: "Активные" },
                      { value: "completed", label: "Завершенные" },
                      { value: "closed", label: "Закрытые" },
                    ]}
                  />
                </div>
                {getRoleCode(user) !== 'sales' && (
                  <Button
                    variant={clientView === "all" ? "secondary" : "outline"}
                    onClick={() => setClientView("all")}
                    className="whitespace-nowrap"
                  >
                    Все клиенты
                  </Button>
                )}
                <Button
                  variant={clientView === "my" ? "secondary" : "outline"}
                  onClick={() => setClientView("my")}
                  className="whitespace-nowrap"
                >
                  Мои клиенты
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </CollapsibleFilter>

      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle>Список клиентов</CardTitle>
          <CardDescription>
            {clients?.length ? `Найдено ${clients.length} из ${totalClients} клиентов` : "Клиенты не найдены"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <Table className="w-full table-fixed animate-fade-in">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[23%]" />
                <col className="w-[15%]" />
                <col className="w-[13%]" />
                <col className="w-[20%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">ID</TableHead>
                  <TableHead className="px-4">Название/Имя</TableHead>
                  <TableHead className="px-4">Тип</TableHead>
                  <TableHead className="px-4">БИН/ИИН</TableHead>
                  <TableHead className="px-4">Контакт</TableHead>
                  <TableHead className="px-4">Телефон</TableHead>
                  <TableHead className="px-4 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <Spinner />
                    </TableCell>
                  </TableRow>
                ) : (!clients || clients.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Клиенты не найдены.
                    </TableCell>
                  </TableRow>
                ) : (
                  clients.map((client) => {
                    const isArchived = client.archived || client.is_archived;
                    return (
                      <TableRow key={client.id} className={isArchived ? "bg-gray-200" : ""}>
                        <TableCell className="px-4 align-top font-mono text-sm">{client.id}</TableCell>
                        <TableCell className="px-4 align-top">
                          <div className="break-words font-medium leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                            {client.name || `${client.last_name} ${client.first_name}`}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 align-top">
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant={client.client_type === "legal" ? "default" : "secondary"}>
                              {client.client_type === "legal" ? "Юридическое лицо" : "Физическое лицо"}
                            </Badge>
                            {isArchived && (
                              <Badge className="bg-gray-100 text-gray-800 text-xs">Архив</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 align-top break-words">{client.bin_iin || client.iin || '-'}</TableCell>
                        <TableCell className="px-4 align-top">
                          <div className="break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                            {client.client_type === "legal" ? (client.contact_info || '-') : `${client.last_name} ${client.first_name}`}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 align-top break-words">{client.phone || '-'}</TableCell>
                        <TableCell className="px-4 align-top text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-gray-100"
                              title="Просмотр"
                              onClick={() => handleViewClick(client)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title="Редактировать"
                                onClick={() => handleEditClick(client)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}

                            {isArchived ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setClientToArchive(client);
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
                                  setClientToArchive(client);
                                  setIsArchiveDialogOpen(true);
                                }}
                                title="Архивировать"
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            )}

                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    title="Удалить"
                                    onClick={() => handleDeleteClick(client)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Удалить клиента?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Запись будет удалена без возможности восстановления.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setClientToDelete(null)}>Отмена</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">Удалить</AlertDialogAction>
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
      </Card>

      {totalPages > 1 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          isLoading={isLoading}
        />
      )}

      {/* Modals */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-5xl max-h-[calc(100dvh-1rem)] overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Редактировать клиента" : "Создать нового клиента"}</DialogTitle>
            <DialogDescription>
              {editingClient ? "Внесите изменения в данные клиента." : "Заполните форму для создания нового клиента."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(100dvh-11rem)] overflow-y-auto overscroll-contain pr-2 sm:pr-4 touch-pan-y [-webkit-overflow-scrolling:touch]">
            <div className="space-y-8">
              {/* Client Type and Photo - Side by Side for Individual Clients */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client Type */}
                <div className="space-y-2">
                  <Label htmlFor="client_type">Тип лица *</Label>
                  <CustomSelect
                    value={clientFormData.client_type || "individual"}
                    onChange={(value) => setClientFormData(prev => ({ ...prev, client_type: value }))}
                    options={[
                      { value: "individual", label: "Физическое лицо" },
                      { value: "legal", label: "Юридическое лицо" }
                    ]}
                    placeholder="Выберите тип лица..."
                    disabled={!!editingClient}
                  />
                  {editingClient && (
                    <p className="text-xs text-muted-foreground">Тип лица нельзя изменить после создания</p>
                  )}
                </div>

                {/* Photo Section - Only for Individual Clients */}
                {clientFormData.client_type === "individual" && (
                  <div className="space-y-2">
                    <Label htmlFor="photo_35x45">Фото клиента (35x45)</Label>
                    <Input
                      id="photo_35x45"
                      type="file"
                      onChange={handlePhotoSelect}
                    />
                    {(photoPreview || (editingClient && clientFormData.photo_35x45)) && (
                      <div className="mt-2 flex items-start gap-3">
                        {!photoPreviewError ? (
                          <img
                            src={photoPreview || clientFormData.photo_35x45 || ""}
                            alt="Preview"
                            className="h-40 w-32 rounded-lg border object-contain bg-white"
                            onError={() => setPhotoPreviewError(true)}
                          />
                        ) : (
                          <div className="flex h-40 w-32 items-center justify-center rounded-lg border bg-white px-3 text-center text-xs text-muted-foreground">
                            Предпросмотр недоступен
                          </div>
                        )}
                        <div className="min-w-0 space-y-2 text-sm text-muted-foreground">
                          {selectedPhotoFile && (
                            <>
                              <div className="truncate font-medium text-foreground">{selectedPhotoFile.name}</div>
                              <div>{(selectedPhotoFile.size / 1024 / 1024).toFixed(2)} МБ</div>
                            </>
                          )}
                          <Button type="button" variant="outline" size="sm" onClick={clearPhoto}>
                            Убрать фото
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Individual Client Fields */}
              {clientFormData.client_type === "individual" && (
                <>

                  {/* Country and Trip Purpose - FIRST */}
                  <div className="space-y-4 border-t pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="country">Страна *</Label>
                        <CustomSelect
                          value={clientFormData.country || ""}
                          onChange={(value) => setClientFormData(prev => ({ ...prev, country: value }))}
                          options={[
                            { value: KAZAKHSTAN_COUNTRY_VALUE, label: "Казахстан" },
                            { value: "south_korea", label: "Южная Корея" },
                            { value: "japan", label: "Япония" },
                            { value: "usa", label: "США" },
                            { value: "uk", label: "Великобритания" },
                            { value: "australia", label: "Австралия" },
                            { value: "canada", label: "Канада" },
                            { value: "poland", label: "Польша" },
                            { value: "estonia", label: "Эстония" },
                            { value: "lithuania", label: "Литва" },
                            { value: "slovakia", label: "Словакия" },
                            { value: "germany", label: "Германия" },
                            { value: "italy", label: "Италия" },
                            { value: "spain", label: "Испания" },
                            { value: "czech_republic", label: "Чехия" },
                            { value: "norway", label: "Норвегия" },
                            { value: "sweden", label: "Швеция" },
                            { value: "france", label: "Франция" },
                            { value: "other", label: "Другая страна..." }
                          ]}
                          placeholder="Выберите страну..."
                          listClassName="max-h-64"
                        />
                        {clientFormData.country === "other" && (
                          <Input
                            id="country_other"
                            placeholder="Укажите страну..."
                            value={clientFormData.country_other || ""}
                            onChange={handleFormChange}
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="trip_purpose">Цель поездки *</Label>
                        <CustomSelect
                          value={clientFormData.trip_purpose || ""}
                          onChange={(value) => setClientFormData(prev => ({ ...prev, trip_purpose: value }))}
                          options={[
                            { value: "tourism", label: "Туризм" },
                            { value: "business", label: "Бизнес" },
                            { value: "study", label: "Учеба" },
                            { value: "work", label: "Работа" },
                            { value: "family_visit", label: "Посещение семьи/друзей" },
                            { value: "medical", label: "Лечение" },
                            { value: "residence_permit", label: "ВНЖ" },
                            { value: "permanent_residence", label: "ПМЖ" },
                            { value: "transit", label: "Транзит" },
                            { value: "other", label: "Другая цель..." }
                          ]}
                          placeholder="Выберите цель..."
                        />
                        {clientFormData.trip_purpose === "other" && (
                          <Input
                            id="trip_purpose_other"
                            placeholder="Укажите цель..."
                            value={clientFormData.trip_purpose_other || ""}
                            onChange={handleFormChange}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Personal Data Section */}
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-semibold text-lg">ЛИЧНЫЕ ДАННЫЕ</h3>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="last_name">Фамилия *</Label>
                        <Input id="last_name" placeholder="Фамилия" value={clientFormData.last_name || ""} onChange={handleFormChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="first_name">Имя *</Label>
                        <Input id="first_name" placeholder="Имя" value={clientFormData.first_name || ""} onChange={handleFormChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="middle_name">Отчество (если имеется)</Label>
                        <Input id="middle_name" placeholder="Отчество" value={clientFormData.middle_name || ""} onChange={handleFormChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="iin">ИИН</Label>
                        <Input id="iin" placeholder="ИИН" value={clientFormData.iin || ""} onChange={handleFormChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="previous_last_name">Прежняя фамилия</Label>
                        <Input id="previous_last_name" placeholder="Прежняя фамилия" value={clientFormData.previous_last_name || ""} onChange={handleFormChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="birth_date">Дата рождения *</Label>
                        <DateInput
                          id="birth_date"
                          value={clientFormData.birth_date || ""}
                          onChange={(value) => setClientFormData(prev => ({ ...prev, birth_date: value }))}
                          maxYear={new Date().getFullYear()}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sex">Пол *</Label>
                        <CustomSelect
                          value={clientFormData.sex || ""}
                          onChange={(value) => setClientFormData(prev => ({ ...prev, sex: value }))}
                          options={[
                            { value: "male", label: "Мужской" },
                            { value: "female", label: "Женский" }
                          ]}
                          placeholder="Выберите пол..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="citizenship">Гражданство *</Label>
                        <CustomSelect
                          value={clientFormData.citizenship || ""}
                          onChange={(value) => setClientFormData(prev => ({ ...prev, citizenship: value }))}
                          options={CITIZENSHIP_COUNTRY_OPTIONS}
                          placeholder="Выберите гражданство..."
                          listClassName="max-h-64"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-3">
                        <Label htmlFor="birth_place">Место рождения</Label>
                        <Textarea id="birth_place" placeholder="Место рождения" value={clientFormData.birth_place || ""} onChange={handleFormChange} rows={2} className="min-h-[72px]" />
                      </div>
                    </div>
                  </div>

                  {/* Documents Section */}
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-semibold text-lg">ДОКУМЕНТЫ</h3>
                    <Separator />
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="id_number">Номер удостоверения личности</Label>
                          <Input id="id_number" placeholder="Номер" value={clientFormData.id_number || ""} onChange={handleFormChange} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="id_issue_date">Дата выдачи</Label>
                          <DateInput
                            id="id_issue_date"
                            value={clientFormData.id_issue_date || ""}
                            onChange={(value) => setClientFormData(prev => ({ ...prev, id_issue_date: value }))}
                            maxYear={new Date().getFullYear() + 1}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="id_expire_date">Дата окончания</Label>
                          <DateInput
                            id="id_expire_date"
                            value={clientFormData.id_expire_date || ""}
                            onChange={(value) => setClientFormData(prev => ({ ...prev, id_expire_date: value }))}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="passport_identity">Серия и номер паспорта</Label>
                          <Input
                            id="passport_identity"
                            placeholder="Например: AB 1234567"
                            value={getPassportIdentityValue()}
                            onChange={(event) => handlePassportIdentityChange(event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="passport_issue_date">Дата выдачи паспорта</Label>
                          <DateInput
                            id="passport_issue_date"
                            value={clientFormData.passport_issue_date || ""}
                            onChange={(value) => setClientFormData(prev => ({ ...prev, passport_issue_date: value }))}
                            maxYear={new Date().getFullYear() + 1}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="passport_expire_date">Дата окончания паспорта</Label>
                          <DateInput
                            id="passport_expire_date"
                            value={clientFormData.passport_expire_date || ""}
                            onChange={(value) => setClientFormData(prev => ({ ...prev, passport_expire_date: value }))}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-[76px_minmax(210px,1fr)_minmax(170px,0.9fr)_minmax(170px,0.9fr)]">
                        <div className="space-y-2 md:max-w-[76px]">
                          <Label htmlFor="driver_license_categories" className="text-xs leading-tight">Категория ВУ</Label>
                          <CustomSelect
                            value={clientFormData.driver_license_categories || ""}
                            onChange={(value) => setClientFormData(prev => ({ ...prev, driver_license_categories: value }))}
                            options={[
                              { value: "A", label: "A" },
                              { value: "B", label: "B" },
                              { value: "C", label: "C" },
                              { value: "D", label: "D" },
                              { value: "E", label: "E" },
                              { value: "M", label: "M" },
                              { value: "A1", label: "A1" },
                              { value: "B1", label: "B1" },
                              { value: "C1", label: "C1" },
                              { value: "D1", label: "D1" },
                              { value: "E1", label: "E1" },
                              { value: "Tm", label: "Tm" },
                              { value: "Tb", label: "Tb" }
                            ]}
                            placeholder="Кат."
                            dropdownWidth={88}
                            triggerClassName="h-9 rounded-xl px-2 text-xs"
                            optionClassName="justify-center py-1 text-xs"
                            listClassName="max-h-56"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="driver_license_number">Серия и номер ВУ</Label>
                          <Input id="driver_license_number" placeholder="Серия и номер ВУ" value={clientFormData.driver_license_number || ""} onChange={handleFormChange} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="driver_license_issue_date">Дата выдачи</Label>
                          <DateInput
                            id="driver_license_issue_date"
                            value={clientFormData.driver_license_issue_date || ""}
                            onChange={(value) => setClientFormData(prev => ({ ...prev, driver_license_issue_date: value }))}
                            maxYear={new Date().getFullYear() + 1}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="driver_license_expire_date">Дата окончания</Label>
                          <DateInput
                            id="driver_license_expire_date"
                            value={clientFormData.driver_license_expire_date || ""}
                            onChange={(value) => setClientFormData(prev => ({ ...prev, driver_license_expire_date: value }))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Marital Status Section */}
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-semibold text-lg">СЕМЕЙНОЕ ПОЛОЖЕНИЕ</h3>
                    <Separator />
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="marital_status">Гражданское состояние</Label>
                          <CustomSelect
                            value={clientFormData.marital_status || ""}
                            onChange={(value) => setClientFormData(prev => ({ ...prev, marital_status: value }))}
                            options={[
                              { value: "married", label: "В браке" },
                              { value: "not_married", label: "Не в браке" },
                              { value: "divorced", label: "В разводе" },
                              { value: "widowed", label: "Вдова/Вдовец" },
                              { value: "civil_marriage", label: "Гражданский брак" }
                            ]}
                            placeholder="Выберите статус..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="has_children">Есть ли дети</Label>
                          <CustomSelect
                            value={clientFormData.has_children ? "true" : "false"}
                            onChange={(value) => handleBooleanChange("has_children", value)}
                            options={[{ value: "true", label: "Да" }, { value: "false", label: "Нет" }]}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="spouse_name">ФИО супруга(и)</Label>
                          <Input id="spouse_name" placeholder="ФИО" value={clientFormData.spouse_name || ""} onChange={handleFormChange} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="spouse_contacts">Телефон супруга(и)</Label>
                          <Input id="spouse_contacts" placeholder="Телефон" value={clientFormData.spouse_contacts || ""} onChange={handleFormChange} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="children_list">Дети</Label>
                        <Textarea id="children_list" placeholder="Информация о детях..." value={clientFormData.children_list || ""} onChange={handleFormChange} rows={2} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="trusted_person">ФИО доверенного лица</Label>
                          <Input id="trusted_person" placeholder="ФИО" value={clientFormData.trusted_person || ""} onChange={handleFormChange} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="trusted_person_phone">Телефон доверенного лица</Label>
                          <Input id="trusted_person_phone" placeholder="Телефон" value={clientFormData.trusted_person_phone || ""} onChange={handleFormChange} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contacts and Address Section */}
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-semibold text-lg">КОНТАКТЫ И АДРЕС</h3>
                    <Separator />
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="registration_address">Адрес прописки</Label>
                        <Textarea id="registration_address" placeholder="Адрес прописки" value={clientFormData.registration_address || ""} onChange={handleFormChange} rows={2} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="actual_address">Адрес проживания</Label>
                        <Textarea id="actual_address" placeholder="Адрес проживания" value={clientFormData.actual_address || ""} onChange={handleFormChange} rows={2} />
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(360px,1fr)_minmax(240px,0.85fr)]">
                        <div className="space-y-2">
                          <Label htmlFor="phone">Телефон *</Label>
                          <PhoneInputWithCountry
                            id="phone"
                            value={clientFormData.phone || ""}
                            countryKey={phoneCountryKey}
                            onCountryChange={setPhoneCountryKey}
                            onChange={handlePhoneChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input id="email" type="email" placeholder="Email" value={clientFormData.email || ""} onChange={handleFormChange} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Work and Education Section */}
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-semibold text-lg">РАБОТА И ОБРАЗОВАНИЕ</h3>
                    <Separator />
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="education_level">Образование</Label>
                          <CustomSelect
                            value={clientFormData.education_level || ""}
                            onChange={(value) => setClientFormData(prev => ({ ...prev, education_level: value }))}
                            options={[
                              { value: "higher", label: "Высшее" },
                              { value: "secondary_special", label: "Средне-специальное" },
                              { value: "secondary", label: "Среднее" },
                              { value: "primary", label: "Начальное" },
                              { value: "incomplete_higher", label: "Неоконченное высшее" }
                            ]}
                            placeholder="Выберите уровень образования..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="specialty">Специальность</Label>
                          <Input id="specialty" placeholder="Специальность" value={clientFormData.specialty || ""} onChange={handleFormChange} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="education_institution_name">Название учебного заведения</Label>
                          <Input id="education_institution_name" placeholder="Название учебного заведения" value={clientFormData.education_institution_name || ""} onChange={handleFormChange} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="education_institution_address">Адрес учебного заведения</Label>
                          <Textarea id="education_institution_address" placeholder="Адрес учебного заведения" value={clientFormData.education_institution_address || ""} onChange={handleFormChange} rows={2} className="min-h-[64px]" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="job">Название места работы</Label>
                          <Input id="job" placeholder="Название места работы" value={clientFormData.job || ""} onChange={handleFormChange} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="position">Должность</Label>
                          <Input id="position" placeholder="Должность" value={clientFormData.position || ""} onChange={handleFormChange} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="education">Адрес работы</Label>
                        <Textarea id="education" placeholder="Адрес работы" value={clientFormData.education || ""} onChange={handleFormChange} rows={2} className="min-h-[64px]" />
                      </div>
                    </div>
                  </div>

                  {/* Visa History Section */}
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-semibold text-lg">ВИЗОВАЯ ИСТОРИЯ</h3>
                    <Separator />
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="trips_last5_years">Поездки за последние 5 лет</Label>
                        <Textarea id="trips_last5_years" placeholder="Перечислите страны и даты поездок" value={clientFormData.trips_last5_years || ""} onChange={handleFormChange} rows={3} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="visas_received">Полученные визы</Label>
                        <Textarea id="visas_received" placeholder="Перечислите полученные визы" value={clientFormData.visas_received || ""} onChange={handleFormChange} rows={2} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="visa_refusals">Отказы в визах</Label>
                        <Textarea id="visa_refusals" placeholder="Были ли отказы в визах? Если да, укажите детали" value={clientFormData.visa_refusals || ""} onChange={handleFormChange} rows={2} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="relatives_in_destination">Члены семьи за рубежом</Label>
                        <Textarea id="relatives_in_destination" placeholder="ФИО членов семьи, проживающих за рубежом" value={clientFormData.relatives_in_destination || ""} onChange={handleFormChange} rows={2} />
                      </div>
                    </div>
                  </div>

                  {/* Medical Information Section */}
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-semibold text-lg">МЕДИЦИНСКАЯ ИНФОРМАЦИЯ</h3>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="height">Рост</Label>
                        <Input id="height" type="number" placeholder="Рост (см)" value={clientFormData.height || ""} onChange={handleFormChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="weight">Вес</Label>
                        <Input id="weight" type="number" placeholder="Вес (кг)" value={clientFormData.weight || ""} onChange={handleFormChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="therapist_name">ФИО терапевта</Label>
                        <Input id="therapist_name" placeholder="ФИО" value={clientFormData.therapist_name || ""} onChange={handleFormChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="clinic_name">Название клиники</Label>
                        <Input id="clinic_name" placeholder="Название клиники" value={clientFormData.clinic_name || ""} onChange={handleFormChange} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="diseases_last3_years">Болезни / травмы за последние 5 лет</Label>
                        <Textarea id="diseases_last3_years" placeholder="Укажите перенесенные болезни или травмы" value={clientFormData.diseases_last3_years || ""} onChange={handleFormChange} rows={2} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Legal Entity Information - shown only for legal clients */}
              {clientFormData.client_type === "legal" && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Информация о юридическом лице
                  </h3>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="name" className="text-red-600">Название компании *</Label>
                      <Input id="name" placeholder="Введите название компании..." value={clientFormData.name || ""} onChange={handleFormChange} />
                    </div>
                    <div>
                      <Label htmlFor="bin_iin" className="text-red-600">БИН *</Label>
                      <Input id="bin_iin" placeholder="Введите БИН..." value={clientFormData.bin_iin || ""} onChange={handleFormChange} />
                    </div>
                    <div>
                      <Label htmlFor="address" className="text-red-600">Юридический адрес *</Label>
                      <Input id="address" placeholder="Введите юридический адрес..." value={clientFormData.address || ""} onChange={handleFormChange} />
                    </div>
                    <div>
                      <Label htmlFor="actual_address">Фактический адрес</Label>
                      <Input id="actual_address" placeholder="Введите фактический адрес..." value={clientFormData.legal_profile?.actual_address || ""} onChange={handleFormChange} />
                    </div>
                    <div>
                      <Label htmlFor="contact_info" className="text-red-600">Контактное лицо (ФИО) *</Label>
                      <Input id="contact_info" placeholder="ФИО контактного лица..." value={clientFormData.contact_info || ""} onChange={handleFormChange} />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-red-600">Телефон контактного лица *</Label>
                      <PhoneInputWithCountry
                        id="phone"
                        value={clientFormData.phone || ""}
                        countryKey={phoneCountryKey}
                        onCountryChange={setPhoneCountryKey}
                        onChange={handlePhoneChange}
                      />
                    </div>
                    <div>
                      <Label htmlFor="bank_name">Название банка</Label>
                      <Input id="bank_name" placeholder="Название банка..." value={clientFormData.legal_profile?.bank_name || ""} onChange={handleFormChange} />
                    </div>
                    <div>
                      <Label htmlFor="iban">IBAN</Label>
                      <Input id="iban" placeholder="IBAN..." value={clientFormData.legal_profile?.iban || ""} onChange={handleFormChange} />
                    </div>
                    <div>
                      <Label htmlFor="bik">БИК</Label>
                      <Input id="bik" placeholder="БИК..." value={clientFormData.legal_profile?.bik || ""} onChange={handleFormChange} />
                    </div>
                    <div>
                      <Label htmlFor="kbe">КБЕ</Label>
                      <Input id="kbe" placeholder="КБЕ..." value={clientFormData.legal_profile?.kbe || ""} onChange={handleFormChange} />
                    </div>
                    <div className="md:col-span-2 lg:col-span-3">
                      <Label htmlFor="additional_info">Дополнительная информация</Label>
                      <Textarea id="additional_info" placeholder="Комментарии и заметки..." value={clientFormData.legal_profile?.additional_info || ""} onChange={handleFormChange} rows={3} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Отмена</Button>
            <Button onClick={handleSubmit}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewingClient} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setViewingClient(null);
          setClientProfile(null);
          // Clean up blob URL to prevent memory leaks
          if (clientPhotoUrl) {
            URL.revokeObjectURL(clientPhotoUrl);
          }
          setClientPhotoUrl(null);
          setClientPhotoError(false);
        }
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{viewingClient?.name || `${viewingClient?.last_name} ${viewingClient?.first_name}`}</DialogTitle>
            <DialogDescription>Детальная информация о клиенте</DialogDescription>
          </DialogHeader>
          {viewingClient && (
            <ScrollArea className="max-h-[70vh] p-4">
              <div className="space-y-8">
                {/* Individual Client Fields */}
                {viewingClient.client_type === "individual" && (
                  <>
                    {/* Photo */}
                    {clientPhotoUrl && (
                      <div className="space-y-4">
                        <h3 className="font-semibold text-lg">ФОТО</h3>
                        <Separator />
                        <div className="flex justify-center">
                          {!clientPhotoError ? (
                            <img
                              src={clientPhotoUrl}
                              alt="Client photo"
                              className="max-h-96 max-w-full rounded-lg border object-contain bg-white"
                              onError={() => setClientPhotoError(true)}
                            />
                          ) : (
                            <div className="flex h-48 w-40 items-center justify-center rounded-lg border bg-white px-3 text-center text-sm text-muted-foreground">
                              Фото загружено, но этот формат не поддерживается предпросмотром браузера
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Country and Trip Purpose */}
                    <div className="space-y-4 border-t pt-4">
                      <h3 className="font-semibold text-lg">СТРАНА И ЦЕЛЬ ПОЕЗДКИ</h3>
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DetailItem label="Страна" value={viewingClient.country} />
                        <DetailItem label="Цель поездки" value={viewingClient.trip_purpose} />
                      </div>
                    </div>

                    {/* Personal Data */}
                    <div className="space-y-4 border-t pt-4">
                      <h3 className="font-semibold text-lg">ЛИЧНЫЕ ДАННЫЕ</h3>
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <DetailItem label="Фамилия" value={viewingClient.last_name} />
                        <DetailItem label="Имя" value={viewingClient.first_name} />
                        <DetailItem label="Отчество" value={viewingClient.middle_name} />
                        <DetailItem label="ИИН" value={viewingClient.iin} />
                        <DetailItem label="Прежняя фамилия" value={viewingClient.previous_last_name} />
                        <DetailItem label="Дата рождения" value={viewingClient.birth_date} />
                        <DetailItem label="Пол" value={viewingClient.sex} />
                        <DetailItem label="Гражданство" value={viewingClient.citizenship} />
                        <DetailItem label="Место рождения" value={viewingClient.birth_place} />
                      </div>
                    </div>

                    {/* Documents */}
                    <div className="space-y-4 border-t pt-4">
                      <h3 className="font-semibold text-lg">ДОКУМЕНТЫ</h3>
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DetailItem label="Номер удостоверения" value={viewingClient.id_number} />
                        <DetailItem
                          label="Серия и номер паспорта"
                          value={
                            viewingClient.individual_profile?.passport_identity ||
                            viewingClient.passport_identity ||
                            [
                              viewingClient.individual_profile?.passport_series || viewingClient.passport_series,
                              viewingClient.individual_profile?.passport_number || viewingClient.passport_number,
                            ].filter(Boolean).join(" ")
                          }
                        />
                        <DetailItem label="Дата выдачи паспорта" value={viewingClient.passport_issue_date} />
                        <DetailItem label="Дата окончания паспорта" value={viewingClient.passport_expire_date} />
                      </div>
                    </div>

                    {/* Marital Status */}
                    <div className="space-y-4 border-t pt-4">
                      <h3 className="font-semibold text-lg">СЕМЕЙНОЕ ПОЛОЖЕНИЕ</h3>
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DetailItem label="Гражданское состояние" value={viewingClient.marital_status} />
                        <DetailItem label="Есть ли дети" value={viewingClient.has_children ? "Да" : "Нет"} />
                        <DetailItem label="ФИО супруга(и)" value={viewingClient.spouse_name} />
                        <DetailItem label="Телефон супруга(и)" value={viewingClient.spouse_contacts} />
                        <DetailItem label="Дети" value={viewingClient.children_list} />
                        <DetailItem label="ФИО доверенного лица" value={viewingClient.individual_profile?.trusted_person || viewingClient.trusted_person} />
                        <DetailItem label="Телефон доверенного лица" value={viewingClient.individual_profile?.trusted_person_phone || viewingClient.trusted_person_phone} />
                      </div>
                    </div>

                    {/* Contacts and Address */}
                    <div className="space-y-4 border-t pt-4">
                      <h3 className="font-semibold text-lg">КОНТАКТЫ И АДРЕС</h3>
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DetailItem label="Адрес прописки" value={viewingClient.registration_address} />
                        <DetailItem label="Адрес проживания" value={viewingClient.actual_address} />
                        <DetailItem label="Телефон" value={viewingClient.phone} />
                        <DetailItem label="Email" value={viewingClient.email} />
                      </div>
                    </div>

                    {/* Work and Education */}
                    <div className="space-y-4 border-t pt-4">
                      <h3 className="font-semibold text-lg">РАБОТА И ОБРАЗОВАНИЕ</h3>
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DetailItem label="Специальность" value={viewingClient.individual_profile?.specialty || viewingClient.specialty} />
                        <DetailItem label="Уровень образования" value={
                          (() => {
                            const level = viewingClient.individual_profile?.education_level || viewingClient.education_level;
                            const levelMap: Record<string, string> = {
                              higher: "Высшее",
                              secondary_special: "Средне-специальное",
                              secondary: "Среднее",
                              primary: "Начальное",
                              incomplete_higher: "Неоконченное высшее"
                            };
                            return level ? (levelMap[level] || level) : "";
                          })()
                        } />
                        <DetailItem label="Образование" value={viewingClient.individual_profile?.education || viewingClient.education} />
                        <DetailItem label="Название учебного заведения" value={viewingClient.individual_profile?.education_institution_name || viewingClient.education_institution_name} />
                        <DetailItem label="Адрес учебного заведения" value={viewingClient.individual_profile?.education_institution_address || viewingClient.education_institution_address} />
                        <DetailItem label="Место работы" value={viewingClient.individual_profile?.job || viewingClient.job} />
                        <DetailItem label="Должность" value={viewingClient.individual_profile?.position || viewingClient.position} />
                        <DetailItem label="Поездки за 5 лет" value={viewingClient.individual_profile?.trips_last5_years || viewingClient.trips_last5_years} />
                        <DetailItem label="Родственники в стране назначения" value={viewingClient.individual_profile?.relatives_in_destination || viewingClient.relatives_in_destination} />
                        <DetailItem label="Полученные визы" value={viewingClient.individual_profile?.visas_received || viewingClient.visas_received} />
                        <DetailItem label="Отказы в визах" value={viewingClient.individual_profile?.visa_refusals || viewingClient.visa_refusals} />
                      </div>
                    </div>

                    {/* Medical Information */}
                    <div className="space-y-4 border-t pt-4">
                      <h3 className="font-semibold text-lg">МЕДИЦИНСКАЯ ИНФОРМАЦИЯ</h3>
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DetailItem label="Рост" value={viewingClient.individual_profile?.height?.toString() || viewingClient.height?.toString()} />
                        <DetailItem label="Вес" value={viewingClient.individual_profile?.weight?.toString() || viewingClient.weight?.toString()} />
                        <DetailItem label="Категории водительских прав" value={viewingClient.individual_profile?.driver_license_categories || viewingClient.driver_license_categories} />
                        <DetailItem label="Серия и номер водительских прав" value={viewingClient.individual_profile?.driver_license_number || viewingClient.driver_license_number} />
                        <DetailItem label="Дата выдачи водительских прав" value={viewingClient.driver_license_issue_date} />
                        <DetailItem label="Дата окончания водительских прав" value={viewingClient.driver_license_expire_date} />
                        <DetailItem label="Терапевт" value={viewingClient.individual_profile?.therapist_name || viewingClient.therapist_name} />
                        <DetailItem label="Клиника" value={viewingClient.individual_profile?.clinic_name || viewingClient.clinic_name} />
                        <DetailItem label="Заболевания за 3 года" value={viewingClient.individual_profile?.diseases_last3_years || viewingClient.diseases_last3_years} />
                      </div>
                    </div>
                  </>
                )}

                {/* Legal Client Fields */}
                {viewingClient.client_type === "legal" && (
                  <>
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">ИНФОРМАЦИЯ О КОМПАНИИ</h3>
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DetailItem label="Название компании" value={viewingClient.legal_profile?.company_name || viewingClient.name} />
                        <DetailItem label="БИН" value={viewingClient.legal_profile?.bin || viewingClient.bin_iin} />
                        <DetailItem label="Юридический адрес" value={viewingClient.legal_profile?.legal_address || viewingClient.address} />
                        <DetailItem label="Фактический адрес" value={viewingClient.legal_profile?.actual_address || viewingClient.actual_address} />
                      </div>
                    </div>

                    <div className="space-y-4 border-t pt-4">
                      <h3 className="font-semibold text-lg">КОНТАКТНОЕ ЛИЦО</h3>
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DetailItem label="ФИО контактного лица" value={viewingClient.legal_profile?.contact_person_name || viewingClient.contact_info} />
                        <DetailItem label="Телефон контактного лица" value={viewingClient.legal_profile?.contact_person_phone || viewingClient.phone} />
                      </div>
                    </div>

                    <div className="space-y-4 border-t pt-4">
                      <h3 className="font-semibold text-lg">БАНКОВСКИЕ РЕКВИЗИТЫ</h3>
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DetailItem label="Название банка" value={viewingClient.legal_profile?.bank_name} />
                        <DetailItem label="IBAN" value={viewingClient.legal_profile?.iban} />
                        <DetailItem label="БИК" value={viewingClient.legal_profile?.bik} />
                        <DetailItem label="КБЕ" value={viewingClient.legal_profile?.kbe} />
                      </div>
                    </div>

                    <div className="space-y-4 border-t pt-4">
                      <h3 className="font-semibold text-lg">ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ</h3>
                      <Separator />
                      <DetailItem label="Дополнительная информация" value={viewingClient.legal_profile?.additional_info} />
                    </div>
                  </>
                )}

                {/* Call History */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold text-lg">ИСТОРИЯ ЗВОНКОВ</h3>
                  <Separator />
                  {clientCallsLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Spinner className="h-4 w-4" />
                      Загрузка...
                    </div>
                  )}
                  {!clientCallsLoading && clientCallsError && (
                    <p className="text-sm text-muted-foreground py-2">{clientCallsError}</p>
                  )}
                  {!clientCallsLoading && !clientCallsError && clientCalls.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">Звонков нет</p>
                  )}
                  {!clientCallsLoading && !clientCallsError && clientCalls.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Дата и время</TableHead>
                          <TableHead>Направление</TableHead>
                          <TableHead>Статус</TableHead>
                          <TableHead>Номер</TableHead>
                          <TableHead>Менеджер</TableHead>
                          <TableHead>Длительность</TableHead>
                          <TableHead>Запись</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientCalls.map((call) => (
                          <TableRow key={call.id}>
                            <TableCell className="whitespace-nowrap text-sm">
                              {formatCallDateTime(call.started_at || call.created_at)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {CALL_DIRECTION_LABELS[call.direction] ?? call.direction}
                            </TableCell>
                            <TableCell>
                              <Badge variant={CALL_STATUS_VARIANTS[call.status] ?? "outline"}>
                                {CALL_STATUS_LABELS[call.status] ?? call.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{call.phone}</TableCell>
                            <TableCell className="text-sm">{call.manager_name ?? "—"}</TableCell>
                            <TableCell className="text-sm">
                              {formatCallDuration(call.duration_seconds)}
                            </TableCell>
                            <TableCell>
                              {call.recording_url ? (
                                <a
                                  href={call.recording_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                >
                                  <PlayCircle className="h-4 w-4" />
                                  Слушать
                                </a>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingClient(null)}>Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архивировать клиента?</AlertDialogTitle>
            <AlertDialogDescription>
              Запись будет перемещена в архив. Её можно восстановить позже.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveClient}>Архивировать</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isUnarchiveDialogOpen} onOpenChange={setIsUnarchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Разархивировать клиента?</AlertDialogTitle>
            <AlertDialogDescription>
              Запись будет возвращена из архива в активный список.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnarchiveClient}>Разархивировать</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
