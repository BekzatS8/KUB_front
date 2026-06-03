"use client"

import { CustomSelect } from "@/components/ui/custom-select"

type ArchiveFilterValue = "active" | "archived" | "all"

interface ArchiveFilterProps {
  value: ArchiveFilterValue
  onChange: (value: ArchiveFilterValue) => void
  className?: string
}

const archiveFilterOptions = [
  { value: "active" as const, label: "Активные" },
  { value: "archived" as const, label: "Архив" },
  { value: "all" as const, label: "Все" },
]

export function ArchiveFilter({ value, onChange, className }: ArchiveFilterProps) {
  return (
    <CustomSelect
      value={value}
      onChange={(val) => onChange(val as ArchiveFilterValue)}
      placeholder="Архив"
      options={archiveFilterOptions}
      className={className}
    />
  )
}

export type { ArchiveFilterValue }
