"use client"

/**
 * Файлы и сканы клиента (обратная связь 20.07.2026): паспорт, удостоверение,
 * права, дипломы, справки. Загрузка по категориям, просмотр с увеличением
 * (картинки — лайтбокс, PDF — во встроенном окне), скачивание, удаление.
 */

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { FileText, Image as ImageIcon, Upload, Download, Trash2, Eye, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CustomSelect } from "@/components/ui/custom-select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  listClientAttachments,
  uploadClientAttachment,
  deleteClientAttachment,
  loadClientAttachment,
  downloadClientAttachment,
  type ClientAttachment,
} from "@/src/api/clients.api"

const CATEGORY_LABELS: Record<string, string> = {
  passport: "Паспорт",
  id_card: "Удостоверение личности",
  driver_license: "Водительское удостоверение",
  diploma: "Диплом",
  certificate: "Справка",
  other: "Прочее",
  // юрлицо-категории (на случай отображения)
  charter: "Устав",
  bin_certificate: "Свидетельство БИН",
  power_of_attorney: "Доверенность",
  bank_details: "Банковские реквизиты",
  director_id: "Удостоверение директора",
  representative_id: "Удостоверение представителя",
  signed_contract: "Подписанный договор",
  corporate_other: "Прочее (юр.)",
}

const UPLOAD_CATEGORIES = [
  { value: "passport", label: "Паспорт" },
  { value: "id_card", label: "Удостоверение личности" },
  { value: "driver_license", label: "Водительское удостоверение" },
  { value: "diploma", label: "Диплом" },
  { value: "certificate", label: "Справка" },
  { value: "other", label: "Прочее" },
]

function isImage(mime?: string | null, name?: string): boolean {
  if (mime?.startsWith("image/")) return true
  return /\.(jpe?g|png|webp|gif)$/i.test(name || "")
}

export function ClientAttachments({ clientId, canEdit }: { clientId: number; canEdit: boolean }) {
  const [files, setFiles] = useState<ClientAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState("passport")
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // просмотрщик
  const [viewer, setViewer] = useState<{ url: string; name: string; image: boolean } | null>(null)
  const [viewerLoading, setViewerLoading] = useState(false)

  const load = () => {
    setLoading(true)
    listClientAttachments(clientId)
      .then(setFiles)
      .catch((e: any) => toast.error(e?.message || "Не удалось загрузить файлы клиента"))
      .finally(() => setLoading(false))
  }
  useEffect(load, [clientId])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploading(true)
    try {
      await uploadClientAttachment(clientId, category, file)
      toast.success("Файл загружен")
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Не удалось загрузить файл")
    } finally {
      setUploading(false)
    }
  }

  const handleView = async (f: ClientAttachment) => {
    const name = f.file_path.split("/").pop() || "file"
    const image = isImage(f.mime, name)
    setViewerLoading(true)
    try {
      const url = await loadClientAttachment(clientId, f.id)
      setViewer({ url, name, image })
    } catch (err: any) {
      toast.error(err?.message || "Не удалось открыть файл")
    } finally {
      setViewerLoading(false)
    }
  }

  const handleDelete = async (f: ClientAttachment) => {
    try {
      await deleteClientAttachment(clientId, f.id)
      toast.success("Файл удалён")
      setFiles((prev) => prev.filter((x) => x.id !== f.id))
    } catch (err: any) {
      toast.error(err?.message || "Не удалось удалить файл")
    }
  }

  const closeViewer = () => {
    if (viewer?.url) URL.revokeObjectURL(viewer.url)
    setViewer(null)
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Файлы и сканы</h3>
        {canEdit && (
          <div className="flex items-center gap-2">
            <div className="w-52">
              <CustomSelect value={category} onChange={setCategory} options={UPLOAD_CATEGORIES} />
            </div>
            <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              Загрузить
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Загрузка...</div>
      ) : files.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          Файлов пока нет{canEdit ? " — выберите категорию и загрузите скан" : ""}
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((f) => {
            const name = f.file_path.split("/").pop() || "file"
            const image = isImage(f.mime, name)
            return (
              <div key={f.id} className="flex items-center gap-3 rounded-lg border p-2">
                {image ? <ImageIcon className="h-5 w-5 shrink-0 text-blue-600" /> : <FileText className="h-5 w-5 shrink-0 text-slate-600" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{CATEGORY_LABELS[f.category] || f.category}</p>
                  <p className="truncate text-xs text-muted-foreground">{name}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Просмотр" onClick={() => handleView(f)} disabled={viewerLoading}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Скачать" onClick={() => downloadClientAttachment(clientId, f.id, name)}>
                  <Download className="h-4 w-4" />
                </Button>
                {canEdit && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50" title="Удалить" onClick={() => handleDelete(f)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Просмотр с увеличением: картинки — img, остальное (PDF/doc) — iframe */}
      <Dialog open={!!viewer} onOpenChange={(o) => { if (!o) closeViewer() }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate">{viewer?.name}</DialogTitle>
          </DialogHeader>
          {viewer?.image ? (
            <img src={viewer.url} alt={viewer.name} className="max-h-[75vh] w-full rounded-lg object-contain" />
          ) : viewer ? (
            <iframe src={viewer.url} title={viewer.name} className="h-[75vh] w-full rounded-lg border" />
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
