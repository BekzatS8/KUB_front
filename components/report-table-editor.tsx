"use client";

/**
 * Редактируемая таблица-отчёт (ТЗ 04.07.2026, п.3).
 *
 * Замена Excel-файлов на Яндекс.Диске: менеджер ведёт свой отчёт прямо в CRM
 * (дата, имя, телефон, комментарий, статус...), руководитель открывает отчёт
 * любого сотрудника на просмотр.
 *
 * Как в Excel: ширину столбцов можно тянуть мышью за границу заголовка, а
 * ячейки — многострочные: при переносе текста высота строки растёт вниз.
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Save } from "lucide-react";
import type { ReportTableContent } from "@/src/api/reports-table.api";

interface Props {
  content: ReportTableContent;
  readOnly?: boolean;
  saving?: boolean;
  onSave?: (content: ReportTableContent) => void;
}

const ACTIONS_COL_WIDTH = 44;
const MIN_COL_WIDTH = 60;

// Ширина столбца по умолчанию (px), подобрана по названию: дата — под год,
// телефон — узко, комментарий — широко (обратная связь 10.07.2026).
function defaultWidth(name: string): number {
  const n = name.trim().toLowerCase();
  if (n.includes("коммент")) return 320;
  if (n.includes("дата")) return 140;
  if (n.includes("телефон") || n.includes("номер")) return 130;
  if (n.includes("имя") || n.includes("фио")) return 160;
  return 150;
}

// Приведение колонок отчёта к канону (обратная связь 10.07.2026, п.1):
//  • «Статус» → «Тип визы»;
//  • «Город» скрываем (удаляем колонку и её ячейки);
//  • «Комментарий» уводим в самый конец.
const HIDDEN_COLUMNS = ["город"];
const RENAME_COLUMNS: Record<string, string> = { "статус": "Тип визы" };

function canonicalizeColumns(srcColumns: string[]): { label: string; srcIndex: number }[] {
  const kept: { label: string; srcIndex: number }[] = [];
  const comments: { label: string; srcIndex: number }[] = [];
  srcColumns.forEach((col, i) => {
    const key = col.trim().toLowerCase();
    if (HIDDEN_COLUMNS.includes(key)) return;
    const label = RENAME_COLUMNS[key] ?? col;
    const entry = { label, srcIndex: i };
    if (key.includes("коммент")) comments.push(entry);
    else kept.push(entry);
  });
  return [...kept, ...comments];
}

function normalize(content: ReportTableContent | null | undefined): Required<ReportTableContent> {
  const srcColumns =
    content?.columns?.length ? content.columns : ["Дата", "Имя", "Телефон", "Тип визы", "Комментарий"];
  const mapping = canonicalizeColumns(srcColumns);
  const columns = mapping.map((m) => m.label);
  const rows = (content?.rows || []).map((r) => mapping.map((m) => r[m.srcIndex] ?? ""));
  // ширины переносим по тому же маппингу (индексы столбцов после каноникализации
  // сдвигаются), недостающие — по умолчанию из названия столбца
  const srcWidths = content?.widths;
  const widths = mapping.map((m, i) => {
    const w = srcWidths?.[m.srcIndex];
    return typeof w === "number" && w >= MIN_COL_WIDTH ? w : defaultWidth(columns[i]);
  });
  return { columns, rows, widths };
}

// Многострочная ячейка: высота растёт под текст (авто-resize по scrollHeight).
function AutoCell({
  value,
  width,
  readOnly,
  onChange,
}: {
  value: string;
  width: number;
  readOnly?: boolean;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(() => {
    // пересчёт высоты и при смене текста, и при смене ширины столбца (перенос
    // строк меняется — ячейка должна вырасти/сжаться)
    resize();
  }, [value, width]);
  return (
    <textarea
      ref={ref}
      value={value}
      readOnly={readOnly}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      onInput={resize}
      className="block w-full resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent px-3 py-2 text-sm leading-5 focus:outline-none focus:ring-1 focus:ring-blue-300"
    />
  );
}

export function ReportTableEditor({ content, readOnly, saving, onSave }: Props) {
  const [data, setData] = useState<Required<ReportTableContent>>(() => normalize(content));
  const [dirty, setDirty] = useState(false);
  const initialised = useRef(false);

  useEffect(() => {
    setData(normalize(content));
    setDirty(false);
    initialised.current = true;
  }, [content]);

  const update = (fn: (prev: Required<ReportTableContent>) => Required<ReportTableContent>) => {
    setData((prev) => fn(prev));
    setDirty(true);
  };

  const setCell = (ri: number, ci: number, value: string) =>
    update((prev) => {
      const rows = prev.rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? value : c)) : r));
      return { ...prev, rows };
    });

  const addRow = () =>
    update((prev) => ({ ...prev, rows: [...prev.rows, prev.columns.map(() => "")] }));

  const removeRow = (ri: number) =>
    update((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== ri) }));

  const setColumn = (ci: number, value: string) =>
    update((prev) => ({
      ...prev,
      columns: prev.columns.map((c, i) => (i === ci ? value : c)),
    }));

  const addColumn = () =>
    update((prev) => ({
      columns: [...prev.columns, `Колонка ${prev.columns.length + 1}`],
      rows: prev.rows.map((r) => [...r, ""]),
      widths: [...prev.widths, 150],
    }));

  const removeColumn = (ci: number) =>
    update((prev) => ({
      columns: prev.columns.filter((_, i) => i !== ci),
      rows: prev.rows.map((r) => r.filter((_, i) => i !== ci)),
      widths: prev.widths.filter((_, i) => i !== ci),
    }));

  const setWidth = (ci: number, w: number) =>
    update((prev) => ({
      ...prev,
      widths: prev.widths.map((x, i) => (i === ci ? Math.max(MIN_COL_WIDTH, Math.round(w)) : x)),
    }));

  // Перетаскивание границы столбца (как в Excel).
  const dragRef = useRef<{ ci: number; startX: number; startW: number } | null>(null);
  const startResize = (e: React.MouseEvent, ci: number) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { ci, startX: e.clientX, startW: data.widths[ci] };
    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setWidth(d.ci, d.startW + (ev.clientX - d.startX));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const tableWidth =
    data.widths.reduce((s, w) => s + w, 0) + (readOnly ? 0 : ACTIONS_COL_WIDTH);

  return (
    <div className="space-y-3">
      <div className="max-h-[72vh] overflow-auto rounded-lg border bg-white">
        <table className="border-collapse text-sm" style={{ tableLayout: "fixed", width: tableWidth }}>
          <colgroup>
            {data.columns.map((_, ci) => (
              <col key={ci} style={{ width: data.widths[ci] }} />
            ))}
            {!readOnly && <col style={{ width: ACTIONS_COL_WIDTH }} />}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50">
              {data.columns.map((col, ci) => (
                <th
                  key={ci}
                  className="relative border-b border-r bg-slate-50 p-1 text-left align-top"
                >
                  <div className="flex items-start gap-1">
                    <textarea
                      value={col}
                      readOnly={readOnly}
                      rows={1}
                      onChange={(e) => setColumn(ci, e.target.value)}
                      className="block w-full resize-none overflow-hidden whitespace-pre-wrap break-words rounded bg-transparent px-2 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                    {!readOnly && data.columns.length > 1 && (
                      <button
                        type="button"
                        title="Удалить колонку"
                        onClick={() => removeColumn(ci)}
                        className="mt-0.5 shrink-0 rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {!readOnly && (
                    /* граница-ручка: тянем ширину столбца */
                    <div
                      onMouseDown={(e) => startResize(e, ci)}
                      title="Потяните, чтобы изменить ширину"
                      className="absolute -right-[3px] top-0 z-20 h-full w-1.5 cursor-col-resize select-none hover:bg-blue-400/60"
                    />
                  )}
                </th>
              ))}
              {!readOnly && <th className="border-b bg-slate-50" />}
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 && (
              <tr>
                <td
                  colSpan={data.columns.length + (readOnly ? 0 : 1)}
                  className="p-6 text-center text-slate-400"
                >
                  {readOnly ? "Отчёт пуст" : "Нажмите «Добавить строку», чтобы начать вести отчёт"}
                </td>
              </tr>
            )}
            {data.rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-slate-50/50">
                {row.map((cell, ci) => (
                  <td key={ci} className="border-b border-r p-0 align-top">
                    <AutoCell
                      value={cell}
                      width={data.widths[ci]}
                      readOnly={readOnly}
                      onChange={(v) => setCell(ri, ci, v)}
                    />
                  </td>
                ))}
                {!readOnly && (
                  <td className="border-b p-1 text-center align-top">
                    <button
                      type="button"
                      title="Удалить строку"
                      onClick={() => removeRow(ri)}
                      className="rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-1.5 h-4 w-4" />
            Добавить строку
          </Button>
          <Button variant="outline" size="sm" onClick={addColumn}>
            <Plus className="mr-1.5 h-4 w-4" />
            Добавить колонку
          </Button>
          <Button size="sm" onClick={() => onSave?.(data)} disabled={saving || !dirty}>
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? "Сохранение..." : dirty ? "Сохранить" : "Сохранено"}
          </Button>
        </div>
      )}
    </div>
  );
}
