"use client";

import { useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboboxOption = { value: string; label: string; searchValue?: string };

// Выпадающий список с поиском (сделки, документы). Определён на уровне модуля
// (стабильная идентичность), поэтому ре-рендеры родителя не ремоунтят его —
// критично для серверного поиска, где каждое нажатие меняет state.
// onSearchChange задан — поиск идёт на сервере по всей базе (сервер отдаёт
// список не больше 100 записей за раз, поиск по загруженному их не находил).
export function ComboboxSelect({
  value,
  onChange,
  options,
  placeholder = "Выберите...",
  searchPlaceholder = "Поиск...",
  emptyText = "Ничего не найдено",
  disabled = false,
  onSearchChange,
  loading = false,
}: {
  value: string | number;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  onSearchChange?: (query: string) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Подпись выбранного пункта запоминаем: во время поиска его может не быть
  // в результатах, а кнопка всё равно должна показывать выбранное.
  const selectedLabel = useRef<{ value: string; label: string } | null>(null);
  const currentValue = value ? value.toString() : "";
  const foundLabel = options.find((option) => option.value === currentValue)?.label;
  if (currentValue && foundLabel) selectedLabel.current = { value: currentValue, label: foundLabel };
  const buttonLabel =
    foundLabel ?? (selectedLabel.current?.value === currentValue ? selectedLabel.current.label : undefined);
  // При закрытии сбрасываем и текст поиска, и серверные результаты: при
  // следующем открытии поле пустое, в списке — стартовые пункты.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSearch("");
      onSearchChange?.("");
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal bg-background px-3 py-2 text-sm border-input border rounded-xl h-10 hover:bg-accent hover:text-accent-foreground",
            !value && "text-muted-foreground",
          )}
          disabled={disabled}
        >
          <span className="truncate">{value ? buttonLabel || placeholder : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-white p-0"
        align="start"
      >
        <Command shouldFilter={!onSearchChange}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={(v) => {
              setSearch(v);
              onSearchChange?.(v);
            }}
          />
          <CommandList className="max-h-[min(18rem,calc(100vh-8rem))] touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]">
            <CommandEmpty>{loading ? "Поиск…" : emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  // cmdk использует value как идентификатор пункта: при
                  // одинаковых подписях (тёзки) пункты схлопывались в один —
                  // добавляем уникальный суффикс с option.value.
                  value={`${option.searchValue || option.label} ::${option.value}`}
                  onSelect={() => {
                    onChange(option.value);
                    handleOpenChange(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", currentValue === option.value ? "opacity-100" : "opacity-0")}
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
}
