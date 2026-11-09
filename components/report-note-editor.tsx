"use client";

/**
 * Блокнот в «Моих отчётах» (ТЗ «доработки CRM КУБ», п.12): обычный текстовый
 * документ для своих заметок рядом с таблицами-отчётами. Поиск по тексту —
 * переходом к следующему совпадению.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReportTableContent } from "@/src/api/reports-table.api";

interface Props {
  content: ReportTableContent;
  readOnly?: boolean;
  saving?: boolean;
  onSave?: (content: ReportTableContent) => void;
}

export function ReportNoteEditor({ content, readOnly, saving, onSave }: Props) {
  const [text, setText] = useState(content.text || "");
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState(0);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(content.text || "");
    setDirty(false);
  }, [content]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as number[];
    const lower = text.toLowerCase();
    const out: number[] = [];
    for (let i = lower.indexOf(q); i !== -1 && out.length < 1000; i = lower.indexOf(q, i + q.length)) out.push(i);
    return out;
  }, [text, query]);

  const goTo = (idx: number) => {
    if (matches.length === 0 || !areaRef.current) return;
    const n = ((idx % matches.length) + matches.length) % matches.length;
    setCurrent(n);
    const el = areaRef.current;
    const start = matches[n];
    el.focus();
    el.setSelectionRange(start, start + query.trim().length);
    // Прокрутить к выделению: примерно по номеру строки.
    const line = text.slice(0, start).split("\n").length - 1;
    el.scrollTop = Math.max(0, line * 22 - el.clientHeight / 3);
  };

  const save = () => {
    onSave?.({ kind: "note", text, columns: [], rows: [] });
    setDirty(false);
  };

  // Ctrl+S — сохранить, как в текстовом редакторе.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "ы")) {
      e.preventDefault();
      if (!readOnly && dirty) save();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder="Поиск в блокноте"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCurrent(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                goTo(e.shiftKey ? current - 1 : matches.length && areaRef.current?.selectionStart === matches[current] ? current + 1 : current);
              }
            }}
          />
        </div>
        {query.trim() && (
          <>
            <span className="text-xs text-slate-500">
              {matches.length ? `${current + 1} из ${matches.length}` : "Не найдено"}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!matches.length} onClick={() => goTo(current - 1)} title="Предыдущее">
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!matches.length} onClick={() => goTo(current + 1)} title="Следующее">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </>
        )}
        {!readOnly && (
          <Button size="sm" className="ml-auto gap-1.5" onClick={save} disabled={!dirty || saving}>
            <Save className="h-4 w-4" />
            {saving ? "Сохранение…" : dirty ? "Сохранить" : "Сохранено"}
          </Button>
        )}
      </div>
      <textarea
        ref={areaRef}
        value={text}
        readOnly={readOnly}
        onKeyDown={onKeyDown}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        placeholder={readOnly ? "Блокнот пуст" : "Пишите свои заметки…"}
        className="block h-[68vh] w-full resize-y rounded-lg border bg-white p-4 font-mono text-sm leading-[22px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </div>
  );
}
