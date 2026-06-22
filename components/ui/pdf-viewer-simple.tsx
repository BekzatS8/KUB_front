"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Download, ExternalLink, Maximize2, Minimize2, X } from "lucide-react"
import { toast } from "sonner"
import { downloadDocument, viewDocumentFile } from "@/src/api/documents.api"
import { renderAsync } from 'docx-preview'

interface PdfViewerProps {
  isOpen: boolean
  onClose: () => void
  documentId: number
  documentName?: string
}

export function PdfViewer({ isOpen, onClose, documentId, documentName }: PdfViewerProps) {
  const [loading, setLoading] = useState(true)
  const [pdfUrl, setPdfUrl] = useState<string>("")
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null)
  const [fileType, setFileType] = useState<'pdf' | 'docx' | null>(null)
  const [error, setError] = useState<string>("")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const docxContainerRef = useRef<HTMLDivElement>(null)

  // Reset state when document changes
  useEffect(() => {
    if (isOpen && documentId) {
      setLoading(true)
      setError("")
      setFileType(null)
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
        setPdfUrl("")
      }
      setDocxBlob(null)
      loadDocument()
    }
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
        setPdfUrl("")
      }
      setDocxBlob(null)
    }
  }, [isOpen, documentId])

  // Render DOCX file
  useEffect(() => {
    const renderDocx = async () => {
      if (fileType === 'docx' && docxBlob && docxContainerRef.current) {
        try {
          docxContainerRef.current.innerHTML = ''
          await renderAsync(docxBlob, docxContainerRef.current, undefined, {
            className: 'docx-container',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            experimental: false,
          })
        } catch (error) {
          console.error('Error rendering DOCX:', error)
          setError('Ошибка при отображении DOCX файла')
        }
      }
    }
    renderDocx()
  }, [fileType, docxBlob])

  const loadDocument = async () => {
    try {
      const blob = await viewDocumentFile(documentId)
      const contentType = blob.type
      
      if (contentType && contentType.includes('pdf')) {
        setFileType('pdf')
        const url = URL.createObjectURL(blob)
        setPdfUrl(url)
        setLoading(false)
        return
      }
      
      if (contentType && (contentType.includes('wordprocessingml') || contentType.includes('docx'))) {
        setFileType('docx')
        setDocxBlob(blob)
        setLoading(false)
        return
      }
      
      setError(`Неподдерживаемый формат файла: ${contentType}`)
      setLoading(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load document')
      toast.error('Ошибка при загрузке документа')
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      const blob = await downloadDocument(documentId, "pdf")
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = documentName || `document-${documentId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Документ скачан')
    } catch (error) {
      toast.error('Ошибка при скачивании документа')
    }
  }

  const handleOpenInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent hideCloseButton className={isFullscreen ? "max-w-screen max-h-screen p-0" : "max-w-6xl max-h-[90vh] p-0"}>
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold truncate pr-4">
              {documentName || `Документ #${documentId}`}
            </DialogTitle>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInNewTab}
                disabled={!pdfUrl}
                title="Открыть в новой вкладке"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                title="Скачать"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Выйти из полноэкранного режима" : "Полноэкранный режим"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <div className="w-px h-6 bg-slate-200 mx-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                title="Закрыть"
                className="text-slate-400 hover:text-red-500 hover:bg-red-50"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex flex-col h-[calc(90vh-8rem)]">
          <div className="flex-1 overflow-auto bg-gray-100 p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Загрузка документа...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <p className="text-red-700 font-medium mb-2">Ошибка загрузки документа</p>
                    <p className="text-red-600 text-sm mb-4">{error}</p>
                    <Button onClick={loadDocument} variant="outline" size="sm">
                      Попробовать снова
                    </Button>
                  </div>
                </div>
              </div>
            ) : fileType === 'pdf' && pdfUrl ? (
              <iframe
                key={`${documentId}-${pdfUrl}`}
                ref={iframeRef}
                src={pdfUrl}
                className="w-full h-full border border-gray-300 rounded-lg bg-white"
                title="Document Viewer"
              />
            ) : fileType === 'docx' && docxBlob ? (
              <div 
                ref={docxContainerRef}
                className="w-full h-full border border-gray-300 rounded-lg bg-white overflow-auto p-8"
                key={`${documentId}`}
              />
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
