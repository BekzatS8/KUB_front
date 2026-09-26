"use client";

import { useMemo, useState } from "react";
import { Building2, Check, ChevronsUpDown, Inbox, User as UserIcon, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Значение фильтра доски: "mine" | "all" | "branch:<id>" | "<id сотрудника>".
export const BRANCH_FILTER_PREFIX = "branch:";

export type BoardFilterBranch = { id: number; name: string };
export type BoardFilterEmployee = { id: number; name: string; branchId: number | null; branchName?: string };

type Group = { key: string; title: string; branchId: number | null; employees: BoardFilterEmployee[] };

// Фильтр «чьи карточки показывать». При доступе к нескольким филиалам
// сотрудники сгруппированы по филиалам, и можно выбрать как весь филиал, так
// и одного человека; поиск ищет и по имени, и по названию филиала.
export function BoardOwnerFilter({
  value,
  onChange,
  branches,
  employees,
  allLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  branches: BoardFilterBranch[];
  employees: BoardFilterEmployee[];
  allLabel: string;
}) {
  const [open, setOpen] = useState(false);

  const groups = useMemo<Group[]>(() => {
    const byName = (a: BoardFilterEmployee, b: BoardFilterEmployee) => a.name.localeCompare(b.name, "ru");
    if (branches.length === 0) {
      return employees.length
        ? [{ key: "people", title: "Сотрудники", branchId: null, employees: [...employees].sort(byName) }]
        : [];
    }
    const out: Group[] = branches.map((b) => ({
      key: `b${b.id}`,
      title: b.name,
      branchId: b.id,
      employees: employees.filter((e) => e.branchId === b.id).sort(byName),
    }));
    const known = new Set(branches.map((b) => b.id));
    // Сотрудники неактивных или недоступных филиалов — в отдельной группе
    // со своим названием филиала, чтобы их не потерять.
    const other = employees.filter((e) => e.branchId !== null && !known.has(e.branchId));
    for (const e of other) {
      let g = out.find((x) => x.branchId === e.branchId);
      if (!g) {
        g = { key: `b${e.branchId}`, title: e.branchName || `Филиал #${e.branchId}`, branchId: e.branchId, employees: [] };
        out.push(g);
      }
      g.employees.push(e);
    }
    const noBranch = employees.filter((e) => e.branchId === null).sort(byName);
    if (noBranch.length) out.push({ key: "none", title: "Без филиала", branchId: null, employees: noBranch });
    return out;
  }, [branches, employees]);

  const label = useMemo(() => {
    if (value === "mine") return "Мои и новые заявки";
    if (value === "all") return allLabel;
    if (value.startsWith(BRANCH_FILTER_PREFIX)) {
      const id = Number(value.slice(BRANCH_FILTER_PREFIX.length));
      const g = groups.find((x) => x.branchId === id);
      return `Весь филиал: ${g?.title || `#${id}`}`;
    }
    const e = employees.find((x) => String(x.id) === value);
    if (!e) return "Сотрудник";
    const g = groups.find((x) => x.branchId !== null && x.branchId === e.branchId);
    return g ? `${e.name} · ${g.title}` : e.name;
  }, [value, allLabel, groups, employees]);

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const mark = (v: string) => (
    <Check className={cn("mr-2 h-4 w-4 shrink-0", value === v ? "opacity-100" : "opacity-0")} />
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-10 w-full justify-between border-slate-300 bg-white px-3 text-sm font-normal sm:w-80"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-white p-0"
        align="end"
      >
        <Command>
          <CommandInput placeholder="Филиал или сотрудник..." />
          <CommandList className="max-h-[min(24rem,calc(100vh-10rem))] overscroll-contain">
            <CommandEmpty>Ничего не найдено</CommandEmpty>
            <CommandGroup>
              <CommandItem value="Мои и новые заявки ::mine" onSelect={() => select("mine")}>
                {mark("mine")}
                <Inbox className="mr-2 h-4 w-4 shrink-0 text-slate-500" />
                Мои и новые заявки
              </CommandItem>
              <CommandItem value={`${allLabel} ::all`} onSelect={() => select("all")}>
                {mark("all")}
                <Users className="mr-2 h-4 w-4 shrink-0 text-slate-500" />
                {allLabel}
              </CommandItem>
            </CommandGroup>
            {groups.map((g) => (
              <div key={g.key}>
                <CommandSeparator />
                <CommandGroup heading={g.branchId !== null ? `${g.title} · ${g.employees.length}` : g.title}>
                  {g.branchId !== null && branches.length > 0 && (
                    <CommandItem
                      value={`${g.title} весь филиал ::${BRANCH_FILTER_PREFIX}${g.branchId}`}
                      onSelect={() => select(`${BRANCH_FILTER_PREFIX}${g.branchId}`)}
                      className="font-medium"
                    >
                      {mark(`${BRANCH_FILTER_PREFIX}${g.branchId}`)}
                      <Building2 className="mr-2 h-4 w-4 shrink-0 text-blue-600" />
                      Весь филиал
                    </CommandItem>
                  )}
                  {g.employees.map((e) => (
                    <CommandItem
                      key={e.id}
                      // Название филиала в value — поиск «Алматы» покажет и
                      // филиал, и его сотрудников.
                      value={`${e.name} ${g.title} ::${e.id}`}
                      onSelect={() => select(String(e.id))}
                      className={branches.length > 0 ? "pl-6" : undefined}
                    >
                      {mark(String(e.id))}
                      <UserIcon className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                      <span className="break-words">{e.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
