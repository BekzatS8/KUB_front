"use client"

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload, FileText, X } from 'lucide-react'
import { uploadDocumentWithMeta } from '@/src/api/documents.api'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  // scope отдела, в который загружается документ (ТЗ п.2.1)
  scope: 'hr' | 'legal' | 'sales' | 'visa' | 'partner' | 'quality_control' | 'management'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

export default function UploadOwnDocumentModal({ open, onClose, onSuccess, scope }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  function handleClose() {
    if (loading) return
    setTitle('')
    setDescription('')
    setFile(null)
    onClose()
  }

  async function handleSubmit() {
    if (!file || !title.trim()) return
    setLoading(true)
    try {
      await uploadDocumentWithMeta({ scope, title: title.trim(), description: description.trim(), file })
      toast.success('Документ загружен')
      setTitle('')
      setDescription('')
      setFile(null)
      onSuccess()
      onClose()
    } catch {
      toast.error('Не удалось загрузить документ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Загрузить документ</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="doc-title">Название документа <span className="text-destructive">*</span></Label>
            <Input
              id="doc-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Введите название"
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="doc-description">Описание</Label>
            <Textarea
              id="doc-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Краткое описание документа"
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Файл <span className="text-destructive">*</span></Label>

            {file ? (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
                <FileText className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  disabled={loading}
                  className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
                  dragOver
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className={`h-8 w-8 ${dragOver ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-sm font-medium">Перетащите или нажмите для выбора</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">PDF, Word, Excel, TXT — до 50 МБ</p>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.xlsx,.txt"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !title.trim() || !file}>
            {loading ? 'Загрузка...' : 'Загрузить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
