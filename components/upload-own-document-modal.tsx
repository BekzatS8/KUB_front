"use client"

import { useRef, useState } from 'react'
import { toast } from 'sonner'
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
  scope: 'hr' | 'legal'
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

  function handleDragLeave() {
    setDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  async function handleSubmit() {
    if (!file || !title) return
    setLoading(true)
    try {
      await uploadDocumentWithMeta({ scope, title, description, file })
      toast.success('Документ загружен')
      onSuccess()
      onClose()
    } catch {
      toast.error('Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Загрузить документ</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="doc-title">Название документа *</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Введите название"
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
            />
          </div>

          <div className="space-y-1.5">
            <Label>Файл *</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? (
                <p className="text-sm font-medium truncate">{file.name}</p>
              ) : (
                <>
                  <p className="text-sm font-medium">Перетащите или выберите файл</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, TXT — до 50 МБ</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.xlsx,.txt"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !title || !file}>
            {loading ? 'Загрузка...' : 'Загрузить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
