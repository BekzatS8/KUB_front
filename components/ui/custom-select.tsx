"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CustomSelectOption {
  value: string;
  label: string;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  dropdownWidth?: number;
  renderValue?: (option: CustomSelectOption) => React.ReactNode;
  renderOption?: (option: CustomSelectOption) => React.ReactNode;
  listClassName?: string;
  optionClassName?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Выберите...",
  disabled = false,
  className,
  triggerClassName,
  dropdownWidth,
  renderValue,
  renderOption,
  listClassName,
  optionClassName,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const [dropdownPosition, setDropdownPosition] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const updateDropdownPosition = React.useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const width = dropdownWidth || rect.width;
      const viewportLeft = window.scrollX + 8;
      const viewportRight = window.scrollX + window.innerWidth - width - 8;
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: Math.max(viewportLeft, Math.min(rect.left + window.scrollX, viewportRight)),
        width: rect.width,
      });
    }
  }, [dropdownWidth]);

  // Calculate dropdown position when opening and keep it attached while scrolling.
  React.useEffect(() => {
    if (!isOpen) {
      setDropdownPosition(null);
      return;
    }

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  React.useEffect(() => {
    if (isOpen) updateDropdownPosition();
  }, [isOpen, updateDropdownPosition]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideContainer = containerRef.current && !containerRef.current.contains(target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);
      
      if (isOutsideContainer && isOutsideDropdown) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) {
        if (event.key === "Enter" || event.key === " ") {
          setIsOpen(true);
          event.preventDefault();
        }
        return;
      }

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setHighlightedIndex((prev) =>
            prev < options.length - 1 ? prev + 1 : prev,
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
          event.preventDefault();
          if (options[highlightedIndex]) {
            onChange(options[highlightedIndex].value);
            setIsOpen(false);
          }
          break;
        case "Escape":
          event.preventDefault();
          setIsOpen(false);
          break;
      }
    };

    if (isOpen && containerRef.current) {
      containerRef.current.addEventListener("keydown", handleKeyDown);
      return () => {
        containerRef.current?.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, highlightedIndex, options, onChange]);

  // Reset highlighted index when opening
  React.useEffect(() => {
    if (isOpen) {
      const selectedIndex = options.findIndex((opt) => opt.value === value);
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [isOpen, value, options]);

  // Scroll highlighted option into view
  React.useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedElement = listRef.current.children[
        highlightedIndex
      ] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleDropdownWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!listRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    listRef.current.scrollTop += event.deltaY;
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isOpen && "ring-2 ring-ring ring-inset",
          triggerClassName,
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span
          className={cn(
            "min-w-0 flex-1 text-left",
            !selectedOption && "text-muted-foreground",
          )}
        >
          {selectedOption ? (renderValue ? renderValue(selectedOption) : selectedOption.label) : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 opacity-50 transition-transform",
            isOpen && "transform rotate-180",
          )}
        />
      </button>

      {/* Dropdown Menu - rendered via portal */}
      {isOpen && dropdownPosition && typeof window !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className={cn(
            "fixed overflow-hidden rounded-xl border bg-white shadow-lg pointer-events-auto",
            "animate-in fade-in-0 zoom-in-95",
          )}
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownWidth || dropdownPosition.width}px`,
            zIndex: 99999,
          }}
          role="listbox"
          onMouseDown={(e) => e.stopPropagation()}
          onWheelCapture={handleDropdownWheel}
        >
          <div
            ref={listRef}
            className={cn(
              "max-h-[min(22rem,calc(100vh-8rem))] overflow-y-auto overscroll-contain p-1 touch-pan-y [-webkit-overflow-scrolling:touch]",
              listClassName,
            )}
          >
            {options.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Нет доступных опций
              </div>
            ) : (
              options.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
                    "hover:bg-accent hover:text-accent-foreground",
                    highlightedIndex === index &&
                      "bg-accent text-accent-foreground",
                    option.value === value && "font-medium",
                    optionClassName,
                  )}
                  role="option"
                  aria-selected={option.value === value}
                >
                  {option.value === value && (
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    {renderOption ? renderOption(option) : option.label}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
