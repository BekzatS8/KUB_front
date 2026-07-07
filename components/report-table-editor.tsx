"use client";

/**
 * Редактируемая таблица-отчёт (ТЗ 04.07.2026, п.3).
 *
 * Замена Excel-файлов на Яндекс.Диске: менеджер ведёт свой отчёт прямо в CRM
 * (дата, имя, телефон, комментарий, статус...), руководитель открывает отчёт
 * любого сотрудника на просмотр.
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

function normalize(content: ReportTableContent | null | undefined): ReportTableContent {
  const columns =
    content?.columns?.length ? content.columns : ["Дата", "Имя", "Телефон", "Комментарий", "Статус"];
  const rows = (content?.rows || []).map((r) => {
    const row = [...r];
    while (row.length < columns.length) row.push("");
    return row.slice(0, columns.length);
  });
  return { columns, rows };
}

export function ReportTableEditor({ content, readOnly, saving, onSave }: Props) {
  const [data, setData] = useState<ReportTableContent>(() => normalize(content));
  const [dirty, setDirty] = useState(false);
  const initialised = useRef(false);

  useEffect(() => {
    // подхватываем данные при первой загрузке/смене отчёта
    setData(normalize(content));
    setDirty(false);
    initialised.current = true;
  }, [content]);

  const update = (fn: (prev: ReportTableContent) => ReportTableContent) => {
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
    }));

  const removeColumn = (ci: number) =>
    update((prev) => ({
      columns: prev.columns.filter((_, i) => i !== ci),
      rows: prev.rows.map((r) => r.filter((_, i) => i !== ci)),
    }));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              {data.columns.map((col, ci) => (
                <th key={ci} className="min-w-[140px] p-1 text-left">
                  <div className="flex items-center gap-1">
                    <input
                      value={col}
                      readOnly={readOnly}
                      onChange={(e) => setColumn(ci, e.target.value)}
                      className="w-full bg-transparent px-2 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded"
                    />
                    {!readOnly && data.columns.length > 1 && (
                      <button
                        type="button"
                        title="Удалить колонку"
                        onClick={() => removeColumn(ci)}
                        className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              {!readOnly && (
                <th className="w-20 p-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addColumn}>
                    <Plus className="mr-1 h-3 w-3" />
                    Колонка
                  </Button>
                </th>
              )}
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
              <tr key={ri} className="border-b last:border-b-0 hover:bg-slate-50/50">
                {row.map((cell, ci) => (
                  <td key={ci} className="p-0">
                    <input
                      value={cell}
                      readOnly={readOnly}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                      className="w-full bg-transparent px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  </td>
                ))}
                {!readOnly && (
                  <td className="p-1 text-center">
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-1.5 h-4 w-4" />
            Добавить строку
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
