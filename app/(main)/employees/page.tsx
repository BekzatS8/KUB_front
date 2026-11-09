"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Edit, Eye, FileText, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AuthenticatedAvatarImage } from "@/components/authenticated-avatar-image";
import { CustomSelect } from "@/components/ui/custom-select";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { useMe } from "@/lib/use-role-code";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { formatDate, formatMoney, initials } from "@/lib/employee-format";
import {
  type Employee, type EmployeeType, EMPLOYEE_TYPE_LABELS, list_employee_positions, list_employees,
} from "@/src/api/employees.api";

// Раздел «Сотрудники» (ТЗ «доработки CRM КУБ», п.1): список с поиском по ФИО,
// ИИН и телефону, фильтры по типу и должности, сортировка; уволенные по
// умолчанию скрыты. Таблица — в компактном стиле страницы «Пользователи» (п.7).

const COMPACT_TH = "h-9 px-3 text-[13px] font-semibold";
const COMPACT_TD = "px-3 py-2.5 align-middle";
const PAGE_SIZE = 25;

const TYPE_BADGE: Record<EmployeeType, string> = {
  permanent: "bg-emerald-100 text-emerald-800",
  intern: "bg-blue-100 text-blue-800",
  fired: "bg-slate-200 text-slate-600",
};


export default function EmployeesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { roleCode } = useMe();
  const canTemplates = roleCode === "system_admin" || roleCode === "hr";

  const [items, setItems] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [showFired, setShowFired] = useState(false);
  const [sortBy, setSortBy] = useState("full_name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [positions, setPositions] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await list_employees({
        q: query.trim() || undefined,
        type: typeFilter || undefined,
        position: positionFilter || undefined,
        include_fired: showFired ? 1 : undefined,
        sort_by: sortBy,
        order,
        page,
        size: PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err: any) {
      toast({ title: "Не удалось загрузить сотрудников", description: err?.response?.data?.message ?? err?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [query, typeFilter, positionFilter, showFired, sortBy, order, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [query, typeFilter, positionFilter, showFired, sortBy, order]);

  useEffect(() => {
    list_employee_positions().then(setPositions).catch(() => setPositions([]));
  }, [formOpen]);

  const sortHead = (key: string, label: string, className = "") => (
    <TableHead className={cn(COMPACT_TH, "cursor-pointer select-none", className)} onClick={() => {
      if (sortBy === key) setOrder(order === "asc" ? "desc" : "asc");
      else { setSortBy(key); setOrder("asc"); }
    }}>
      <span className="inline-flex items-center gap-1">
        {label}
        {sortBy === key && (order === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </span>
    </TableHead>
  );

  return (
    <>
      <div className="m-2 flex flex-col gap-2 sm:m-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">Сотрудники</h1>
          <p className="text-sm text-gray-600">Кадровые карточки, документы и подписание</p>
        </div>
        <div className="flex items-center gap-2">
          {canTemplates && (
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href="/employees/templates"><FileText className="mr-2 h-4 w-4" />Шаблоны документов</Link>
            </Button>
          )}
          <Button size="sm" className="h-8" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Добавить сотрудника
          </Button>
        </div>
      </div>

      <Card className="mx-2 sm:mx-3">
        <CardHeader className="p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-base">
              Список сотрудников <span className="text-sm font-normal text-muted-foreground">· {total}</span>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
                <Input className="h-8 pl-8 text-sm" placeholder="ФИО, ИИН или телефон" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="w-48">
                <CustomSelect value={typeFilter} onChange={setTypeFilter} placeholder="Все типы" options={[
                  { value: "", label: "Все типы" },
                  ...(Object.keys(EMPLOYEE_TYPE_LABELS) as EmployeeType[]).map((k) => ({ value: k, label: EMPLOYEE_TYPE_LABELS[k] })),
                ]} />
              </div>
              <div className="w-48">
                <CustomSelect value={positionFilter} onChange={setPositionFilter} placeholder="Все должности" options={[
                  { value: "", label: "Все должности" }, ...positions.map((p) => ({ value: p, label: p })),
                ]} />
              </div>
              <label className="flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px]">
                <input type="checkbox" checked={showFired} onChange={(e) => setShowFired(e.target.checked)} />
                Показать уволенных
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0">
          <div className="overflow-x-auto rounded-md border">
            <Table className="w-full min-w-[960px] table-fixed text-sm">
              <colgroup>
                <col className="w-[24%]" /><col className="w-[12%]" /><col className="w-[13%]" />
                <col className="w-[14%]" /><col className="w-[11%]" /><col className="w-[10%]" />
                <col className="w-[10%]" /><col className="w-[6%]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  {sortHead("full_name", "ФИО")}
                  <TableHead className={COMPACT_TH}>ИИН</TableHead>
                  <TableHead className={COMPACT_TH}>Телефон</TableHead>
                  {sortHead("position", "Должность")}
                  {sortHead("salary", "Зарплата")}
                  {sortHead("hired_at", "Начало работы")}
                  <TableHead className={COMPACT_TH}>Тип</TableHead>
                  <TableHead className={cn(COMPACT_TH, "text-right")}>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && items.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="h-20 text-center text-muted-foreground">Загрузка…</TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="h-20 text-center text-muted-foreground">Сотрудники не найдены</TableCell></TableRow>
                ) : items.map((e) => (
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => router.push(`/employees/${e.id}`)}>
                    <TableCell className={COMPACT_TD}>
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar className="h-7 w-7 shrink-0">
                          {e.has_photo && (
                            <AuthenticatedAvatarImage src={`/employees/${e.id}/photo?v=${encodeURIComponent(e.updated_at)}`} alt={e.full_name} className="h-full w-full object-cover" />
                          )}
                          <AvatarFallback className="text-[11px]">{initials(e.full_name)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate font-medium" title={e.full_name}>{e.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className={cn(COMPACT_TD, "font-mono text-[13px]")}>{e.iin}</TableCell>
                    <TableCell className={cn(COMPACT_TD, "whitespace-nowrap")}>{e.phone}</TableCell>
                    <TableCell className={COMPACT_TD}><span className="block truncate" title={e.position}>{e.position}</span></TableCell>
                    <TableCell className={cn(COMPACT_TD, "whitespace-nowrap")}>{formatMoney(e.salary)}</TableCell>
                    <TableCell className={cn(COMPACT_TD, "whitespace-nowrap")}>{formatDate(e.hired_at)}</TableCell>
                    <TableCell className={COMPACT_TD}>
                      <Badge className={cn("whitespace-nowrap px-1.5 py-0 text-xs font-medium", TYPE_BADGE[e.employee_type])} title={EMPLOYEE_TYPE_LABELS[e.employee_type]}>
                        {e.employee_type === "permanent" ? "Постоянный" : EMPLOYEE_TYPE_LABELS[e.employee_type]}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn(COMPACT_TD, "text-right")} onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex flex-nowrap items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Открыть карточку" onClick={() => router.push(`/employees/${e.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Редактировать" onClick={() => { setEditing(e); setFormOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {total > PAGE_SIZE && (
            <div className="pt-3">
              <PaginationControls currentPage={page} totalPages={Math.ceil(total / PAGE_SIZE)} onPageChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>

      <EmployeeFormDialog open={formOpen} employee={editing} positions={positions} onClose={() => setFormOpen(false)} onSaved={() => load()} />
    </>
  );
}
