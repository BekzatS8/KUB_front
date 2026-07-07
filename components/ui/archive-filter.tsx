"use client"

import { CustomSelect } from "@/components/ui/custom-select"

type ArchiveFilterValue = "active" | "archived" | "all" | "deleted"

interface ArchiveFilterProps {
  value: ArchiveFilterValue
  onChange: (value: ArchiveFilterValue) => void
  className?: string
  /** Показывать пункт «Корзина» (мягко удалённые, ТЗ п.7.1) — для админа */
  showTrash?: boolean
}

const archiveFilterOptions = [
  { value: "active" as const, label: "Активные" },
  { value: "archived" as const, label: "Архив" },
  { value: "all" as const, label: "Все" },
]

const trashOption = { value: "deleted" as const, label: "Корзина" }

export function ArchiveFilter({ value, onChange, className, showTrash }: ArchiveFilterProps) {
  const options = showTrash ? [...archiveFilterOptions, trashOption] : archiveFilterOptions
  return (
    <CustomSelect
      value={value}
      onChange={(val) => onChange(val as ArchiveFilterValue)}
      placeholder="Архив"
      options={options}
      className={className}
    />
  )
}

export type { ArchiveFilterValue }
