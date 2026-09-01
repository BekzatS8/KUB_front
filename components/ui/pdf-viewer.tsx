"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, X } from "lucide-react"
import { toast } from "sonner"
import { downloadDocument } from "@/src/api/documents.api"

interface PdfViewerProps {
  isOpen: boolean
  onClose: () => void
  documentId: number
  documentName?: string
}

export function PdfViewer({ isOpen, onClose, documentId, documentName }: PdfViewerProps) {
  const [loading, setLoading] = useState(true)
  const [pageImages, setPageImages] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [renderingPage, setRenderingPage] = useState<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Reset state when document changes
  useEffect(() => {
    if (isOpen && documentId) {
      setLoading(true)
      setPageImages([])
      setCurrentPage(1)
      setTotalPages(0)
      setZoom(1)
      loadPdfDocument()
    }
  }, [isOpen, documentId])

  const loadPdfDocument = async () => {
    try {
      console.log('Loading PDF document:', documentId)
      
      // Call our backend API that uses Puppeteer to render PDF pages
      const response = await fetch(`/api/documents/${documentId}/pdf-pages`)
      console.log('API response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API error response:', errorText)
        throw new Error(`Failed to load PDF document: ${response.status} ${errorText}`)
      }
      
      const data = await response.json()
      console.log('API response data:', data)
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      setTotalPages(data.totalPages || 1)
      
      // Pre-render first page
      if (data.pages && data.pages.length > 0) {
        await renderPage(1, data.pages)
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Error loading PDF:', error)
      // Don't show toast or close modal immediately - let user see the error
      toast.error('Ошибка при загрузке PDF документа')
      setLoading(false)
      // Don't auto-close the modal, let user close it manually
      // onClose()
    }
  }

  const renderPage = async (pageNumber: number, pagesData?: any[]) => {
    if (renderingPage === pageNumber) return
    
    setRenderingPage(pageNumber)
    
    try {
      // If we already have this page rendered, return it
      if (pageImages[pageNumber - 1]) {
        setRenderingPage(null)
        return
      }

      // Get page image from backend or use provided data
      let pageImageUrl: string
      
      if (pagesData && pagesData[pageNumber - 1]) {
        pageImageUrl = pagesData[pageNumber - 1]
      } else {
        const response = await fetch(`/api/documents/${documentId}/pdf-page/${pageNumber}`)
        if (!response.ok) {
          throw new Error(`Failed to render page ${pageNumber}`)
        }
        const blob = await response.blob()
        pageImageUrl = URL.createObjectURL(blob)
      }

      // Update page images array
      setPageImages(prev => {
        const newImages = [...prev]
        newImages[pageNumber - 1] = pageImageUrl
        return newImages
      })
      
    } catch (error) {
      console.error(`Error rendering page ${pageNumber}:`, error)
      toast.error(`Ошибка при отрисовке страницы ${pageNumber}`)
    } finally {
      setRenderingPage(null)
    }
  }

  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return
    
    setCurrentPage(newPage)
    
    // Pre-render adjacent pages for smoother navigation
    await renderPage(newPage)
    
    // Pre-render next and previous pages in background
    if (newPage < totalPages) {
      renderPage(newPage + 1)
    }
    if (newPage > 1) {
      renderPage(newPage - 1)
    }
  }

  const handleZoom = (delta: number) => {
    const newZoom = Math.max(0.5, Math.min(3, zoom + delta))
    setZoom(newZoom)
  }

  const handleDownload = async () => {
    try {
      // Через авторизованный API (format=pdf → подписанный PDF, если подписан).
      // Прямой fetch на Next-прокси шёл без токена → 401.
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
      console.error('Error downloading document:', error)
      toast.error('Ошибка при скачивании документа')
    }
  }

  const currentImage = pageImages[currentPage - 1]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent hideCloseButton className="max-w-6xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold truncate pr-4">
              {documentName || `Документ #${documentId}`}
            </DialogTitle>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleZoom(-0.25)}
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleZoom(0.25)}
                disabled={zoom >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                title="Скачать"
              >
                <Download className="h-4 w-4" />
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
          {/* Page Navigation */}
          <div className="flex items-center justify-between px-6 py-3 border-b">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              Предыдущая
            </Button>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                Страница {currentPage} из {totalPages}
              </span>
              {renderingPage && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
            >
              Следующая
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* PDF Content */}
          <div className="flex-1 overflow-auto bg-gray-50 p-6">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Загрузка PDF документа...</p>
                </div>
              </div>
            ) : currentImage ? (
              <div className="flex justify-center">
                <div 
                  className="bg-white shadow-lg"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.2s ease-in-out'
                  }}
                >
                  <img
                    src={currentImage}
                    alt={`Page ${currentPage}`}
                    className="max-w-full h-auto"
                    style={{
                      maxHeight: 'calc(90vh - 12rem)',
                      transform: `scale(${1/zoom})`,
                      transformOrigin: 'top left'
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Отрисовка страницы {currentPage}...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
