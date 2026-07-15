"use client"

/**
 * Настройки → Шаблоны документов (обратная связь 14.07.2026).
 *
 * Сами шаблоны заданы в коде (docx + список полей), а вот кому какой нужен —
 * решает бизнес. Здесь админ раскидывает шаблоны по отделам: отдел видит свои
 * шаблоны на вкладке «Документы отдела» и генерирует по ним документы клиентов.
 */

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { FileText, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
    listDocumentTypes,
    setTemplateDepartments,
    type DocumentTemplate,
} from "@/src/api/documents.api"
import { DEPARTMENT_SCOPES } from "@/src/models/document-scopes"

export default function DocumentTemplatesSettingsPage() {
    const [templates, setTemplates] = useState<DocumentTemplate[]>([])
    const [loading, setLoading] = useState(true)
    // doc_type, который сейчас сохраняется — блокируем его строку
    const [saving, setSaving] = useState<string | null>(null)

    const load = () => {
        setLoading(true)
        listDocumentTypes()
            .then(setTemplates)
            .catch((err: any) => toast.error(err?.message || "Не удалось загрузить шаблоны"))
            .finally(() => setLoading(false))
    }

    useEffect(load, [])

    const toggle = async (tpl: DocumentTemplate, scope: string, checked: boolean) => {
        const current = tpl.departments || []
        const next = checked ? [...current, scope] : current.filter((s) => s !== scope)

        // оптимистично — галка не должна «залипать» на время запроса
        setTemplates((prev) =>
            prev.map((t) => (t.doc_type === tpl.doc_type ? { ...t, departments: next } : t))
        )
        setSaving(tpl.doc_type)
        try {
            await setTemplateDepartments(tpl.doc_type, next)
        } catch (err: any) {
            setTemplates((prev) =>
                prev.map((t) => (t.doc_type === tpl.doc_type ? { ...t, departments: current } : t))
            )
            toast.error(err?.message || "Не удалось сохранить")
        } finally {
            setSaving(null)
        }
    }

    const unassigned = templates.filter((t) => !t.departments?.length).length

    return (
        <div className="m-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Шаблоны документов</h1>
                    <p className="text-sm text-slate-600">
                        Отметьте, какому отделу доступен шаблон. Отдел увидит его на вкладке
                        «Документы отдела» и сможет создать по нему документ клиента.
                    </p>
                </div>
                <Button variant="outline" size="icon" onClick={load} disabled={loading}>
                    <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                </Button>
            </div>

            {unassigned > 0 && !loading && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Шаблонов без отдела: {unassigned}. Их не видит ни один отдел — такой шаблон
                    доступен только через кнопку «Создать документ».
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Раскладка по отделам</CardTitle>
                    <CardDescription>
                        Шаблон можно отдать нескольким отделам — например, расписку о возврате
                        оформляют и продажи, и юристы. Изменения сохраняются сразу.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-2">
                            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full rounded" />)}
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <FileText className="mb-3 h-10 w-10 text-gray-300" />
                            <p className="text-gray-500">Шаблоны не найдены</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-slate-50">
                                        <th className="min-w-[280px] p-3 text-left font-semibold text-slate-700">
                                            Шаблон
                                        </th>
                                        {DEPARTMENT_SCOPES.map((d) => (
                                            <th
                                                key={d.scope}
                                                className="min-w-[90px] p-3 text-center text-xs font-semibold text-slate-600"
                                            >
                                                {d.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {templates.map((tpl) => (
                                        <tr key={tpl.doc_type} className="border-b last:border-b-0 hover:bg-slate-50/50">
                                            <td className="p-3">
                                                <p className="font-medium text-slate-900">{tpl.title_ru}</p>
                                                <p className="text-xs text-slate-400">{tpl.doc_type}</p>
                                            </td>
                                            {DEPARTMENT_SCOPES.map((d) => (
                                                <td key={d.scope} className="p-3 text-center">
                                                    <Checkbox
                                                        checked={tpl.departments?.includes(d.scope) ?? false}
                                                        disabled={saving === tpl.doc_type}
                                                        onCheckedChange={(v) => toggle(tpl, d.scope, v === true)}
                                                        aria-label={`${tpl.title_ru} — ${d.label}`}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
