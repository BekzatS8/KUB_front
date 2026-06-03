"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, Filter } from "lucide-react"
import { cn } from "@/lib/utils"

interface CollapsibleFilterProps {
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
}

export function CollapsibleFilter({ children, defaultOpen = false, className }: CollapsibleFilterProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={cn("w-full", className)}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="mb-4 flex items-center gap-2 h-9 px-3"
      >
        <Filter className="h-4 w-4" />
        <span>Фильтры</span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>
      
      {isOpen && (
        <div className="animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  )
}
