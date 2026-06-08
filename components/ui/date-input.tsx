"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type DateInputMode = "date" | "datetime";

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
};

type DateInputProps = {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  mode?: DateInputMode;
  placeholder?: string;
  minYear?: number;
  maxYear?: number;
  disabled?: boolean;
  className?: string;
};

const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function isRealDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function parseValue(value?: string): DateParts | null {
  if (!value) return null;

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/
  );
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = match[4] ? Number(match[4]) : 0;
  const minute = match[5] ? Number(match[5]) : 0;

  if (!isRealDate(year, month, day)) return null;

  return { year, month, day, hour, minute };
}

function parseText(text: string, mode: DateInputMode): DateParts | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/[^\d]/g, "");
  let day = 0;
  let month = 0;
  let year = 0;
  let hour = 0;
  let minute = 0;

  const separated = trimmed.match(
    /^(\d{1,2})[.\-/\s](\d{1,2})[.\-/\s](\d{4})(?:\s+(\d{1,2})[:.](\d{1,2}))?$/
  );

  if (separated) {
    day = Number(separated[1]);
    month = Number(separated[2]);
    year = Number(separated[3]);
    hour = separated[4] ? Number(separated[4]) : 0;
    minute = separated[5] ? Number(separated[5]) : 0;
  } else if (compact.length >= 8) {
    day = Number(compact.slice(0, 2));
    month = Number(compact.slice(2, 4));
    year = Number(compact.slice(4, 8));
    if (mode === "datetime" && compact.length >= 12) {
      hour = Number(compact.slice(8, 10));
      minute = Number(compact.slice(10, 12));
    }
  } else {
    return null;
  }

  if (!isRealDate(year, month, day)) return null;
  if (mode === "datetime" && (hour > 23 || minute > 59)) return null;

  return { year, month, day, hour, minute };
}

function formatText(parts: DateParts | null, mode: DateInputMode) {
  if (!parts) return "";

  const dateText = `${pad(parts.day)}.${pad(parts.month)}.${parts.year}`;
  if (mode === "date") return dateText;

  return `${dateText} ${pad(parts.hour || 0)}:${pad(parts.minute || 0)}`;
}

function formatValue(parts: DateParts, mode: DateInputMode) {
  const dateValue = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  if (mode === "date") return dateValue;

  return `${dateValue}T${pad(parts.hour || 0)}:${pad(parts.minute || 0)}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function clampYear(year: number, minYear: number, maxYear: number) {
  if (!Number.isFinite(year)) return minYear;
  return Math.min(Math.max(year, minYear), maxYear);
}

export function DateInput({
  id,
  value,
  onChange,
  mode = "date",
  placeholder,
  minYear = 1900,
  maxYear = new Date().getFullYear() + 30,
  disabled = false,
  className,
}: DateInputProps) {
  const parsedValue = React.useMemo(() => parseValue(value), [value]);
  const today = React.useMemo(() => new Date(), []);
  const initialYear = parsedValue?.year || today.getFullYear();
  const initialMonth = parsedValue?.month || today.getMonth() + 1;

  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(formatText(parsedValue, mode));
  const [viewYear, setViewYear] = React.useState(
    clampYear(initialYear, minYear, maxYear)
  );
  const [viewMonth, setViewMonth] = React.useState(initialMonth);
  const [time, setTime] = React.useState(
    `${pad(parsedValue?.hour || 0)}:${pad(parsedValue?.minute || 0)}`
  );
  const [isInvalid, setIsInvalid] = React.useState(false);
  const lastWheelAtRef = React.useRef(0);

  React.useEffect(() => {
    const nextParts = parseValue(value);
    setText(formatText(nextParts, mode));
    setIsInvalid(false);

    if (nextParts) {
      setViewYear(clampYear(nextParts.year, minYear, maxYear));
      setViewMonth(nextParts.month);
      setTime(`${pad(nextParts.hour || 0)}:${pad(nextParts.minute || 0)}`);
    }
  }, [value, mode, minYear, maxYear]);

  const commitParts = (parts: DateParts, shouldClose = true) => {
    const nextParts = {
      ...parts,
      year: clampYear(parts.year, minYear, maxYear),
    };
    onChange(formatValue(nextParts, mode));
    setText(formatText(nextParts, mode));
    setIsInvalid(false);
    setViewYear(nextParts.year);
    setViewMonth(nextParts.month);
    if (mode === "datetime") {
      setTime(`${pad(nextParts.hour || 0)}:${pad(nextParts.minute || 0)}`);
    }
    if (shouldClose) setOpen(false);
  };

  const commitText = () => {
    if (!text.trim()) {
      onChange("");
      setIsInvalid(false);
      return;
    }

    const parts = parseText(text, mode);
    if (!parts) {
      setIsInvalid(true);
      return;
    }

    commitParts(parts, false);
  };

  const selectDay = (day: number) => {
    const [hourText, minuteText] = time.split(":");
    const parts = {
      year: viewYear,
      month: viewMonth,
      day,
      hour: Number(hourText || 0),
      minute: Number(minuteText || 0),
    };

    commitParts(parts, mode === "date");
  };

  const moveMonth = (step: number) => {
    const next = new Date(viewYear, viewMonth - 1 + step, 1);
    setViewYear(clampYear(next.getFullYear(), minYear, maxYear));
    setViewMonth(next.getMonth() + 1);
  };

  const moveYear = (step: number) => {
    setViewYear((year) => clampYear(year + step, minYear, maxYear));
  };

  const handleCalendarWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const now = Date.now();
    if (now - lastWheelAtRef.current < 120 || Math.abs(event.deltaY) < 3) {
      return;
    }
    lastWheelAtRef.current = now;

    const step = event.deltaY > 0 ? 1 : -1;
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      moveYear(step);
    } else {
      moveMonth(step);
    }
  };

  const clearValue = () => {
    onChange("");
    setText("");
    setIsInvalid(false);
    setOpen(false);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const selected = parsedValue;

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={text}
        disabled={disabled}
        placeholder={
          placeholder || (mode === "datetime" ? "дд.мм.гггг чч:мм" : "дд.мм.гггг")
        }
        className={cn("pr-20", isInvalid && "border-red-500 focus-visible:border-red-500")}
        onChange={(event) => {
          const nextText = event.target.value;
          setText(nextText);
          setIsInvalid(false);

          const parts = parseText(nextText, mode);
          if (parts) {
            commitParts(parts, false);
          } else if (!nextText.trim()) {
            onChange("");
          }
        }}
        onBlur={commitText}
      />
      <div className="absolute inset-y-0 right-2 flex items-center gap-1">
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={clearValue}
            disabled={disabled}
            title="Очистить дату"
          >
            <X className="size-4" />
          </Button>
        ) : null}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={disabled}
              title="Выбрать дату"
            >
              <CalendarDays className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-3" align="end" onWheelCapture={handleCalendarWheel}>
            <div className="space-y-3">
              <div className="grid grid-cols-[32px_1fr_88px_32px] items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => moveMonth(-1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <select
                  value={viewMonth}
                  onChange={(event) => setViewMonth(Number(event.target.value))}
                  className="h-9 rounded-xl border border-slate-300 bg-background px-3 text-sm outline-none focus:border-primary"
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={minYear}
                  max={maxYear}
                  value={viewYear}
                  className="h-9 px-3"
                  onChange={(event) => {
                    const year = Number(event.target.value);
                    if (event.target.value.length <= 4) {
                      setViewYear(year || minYear);
                    }
                  }}
                  onBlur={() => setViewYear((year) => clampYear(year, minYear, maxYear))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => moveMonth(1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
                {WEEKDAYS.map((weekday) => (
                  <div key={weekday} className="h-7 leading-7">
                    {weekday}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: offset }).map((_, index) => (
                  <div key={`empty-${index}`} className="size-9" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const day = index + 1;
                  const isSelected =
                    selected?.year === viewYear &&
                    selected?.month === viewMonth &&
                    selected?.day === day;

                  return (
                    <Button
                      key={day}
                      type="button"
                      variant={isSelected ? "default" : "ghost"}
                      size="icon"
                      className="size-9"
                      onClick={() => selectDay(day)}
                    >
                      {day}
                    </Button>
                  );
                })}
              </div>

              {mode === "datetime" ? (
                <div className="flex items-center gap-2 border-t pt-3">
                  <Input
                    type="time"
                    value={time}
                    className="h-9"
                    onChange={(event) => setTime(event.target.value || "00:00")}
                  />
                  <Button
                    type="button"
                    className="h-9 px-4"
                    onClick={() => {
                      const current = selected || {
                        year: viewYear,
                        month: viewMonth,
                        day: Math.min(today.getDate(), daysInMonth),
                      };
                      const [hourText, minuteText] = time.split(":");
                      commitParts({
                        ...current,
                        hour: Number(hourText || 0),
                        minute: Number(minuteText || 0),
                      });
                    }}
                  >
                    Выбрать
                  </Button>
                </div>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
