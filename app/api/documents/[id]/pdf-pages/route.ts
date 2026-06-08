import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'

// Extend Window interface for our custom properties
declare global {
  interface Window {
    pdfDoc: any
    totalPages: number
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params

  try {
    // Get the backend API URL from environment or use default
    const backendUrl = process.env.BACKEND_API_URL || 'https://api.kubcrm.kz'
    
    // First, get the PDF file from your existing API
    const pdfResponse = await fetch(`${backendUrl}/documents/${documentId}/file`)
    
    if (!pdfResponse.ok) {
      throw new Error('Failed to fetch PDF document')
    }

    const pdfBuffer = await pdfResponse.arrayBuffer()
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64')

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()
    
    // Use PDF.js to render PDF pages properly
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
          <style>
            body { margin: 0; padding: 20px; background: #f5f5f5; }
            #canvas { border: 1px solid #ccc; background: white; display: block; margin: 0 auto; }
            .loading { text-align: center; padding: 50px; font-family: Arial, sans-serif; }
          </style>
        </head>
        <body>
          <div class="loading" id="loading">Loading PDF...</div>
          <canvas id="canvas"></canvas>
          <script>
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            
            const pdfData = atob('${pdfBase64}');
            const loadingTask = pdfjsLib.getDocument({data: pdfData});
            
            loadingTask.promise.then(function(pdf) {
              console.log('PDF loaded with ' + pdf.numPages + ' pages');
              window.pdfDoc = pdf;
              window.totalPages = pdf.numPages;
              document.getElementById('loading').style.display = 'none';
              
              // Render first page
              return pdf.getPage(1).then(function(page) {
                const canvas = document.getElementById('canvas');
                const context = canvas.getContext('2d');
                const viewport = page.getViewport({scale: 1.5});
                
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                const renderContext = {
                  canvasContext: context,
                  viewport: viewport
                };
                
                return page.render(renderContext).promise;
              });
            }).catch(function(error) {
              console.error('Error loading PDF:', error);
              document.getElementById('loading').textContent = 'Error loading PDF: ' + error.message;
            });
          </script>
        </body>
      </html>
    `)

    // Wait for PDF to load and render
    await page.waitForFunction(() => (window as any).pdfDoc !== undefined, { timeout: 10000 })

    // Get total pages
    const totalPages = await page.evaluate(() => (window as any).totalPages || 1)

    // Render first few pages as images
    const pages: string[] = []
    const maxPages = Math.min(totalPages, 5) // Render first 5 pages initially

    for (let i = 1; i <= maxPages; i++) {
      try {
        // Navigate to specific page and render
        await page.evaluate((pageNum: number) => {
          return (window as any).pdfDoc.getPage(pageNum).then(function(page: any) {
            const canvas = document.getElementById('canvas') as HTMLCanvasElement;
            if (!canvas) return Promise.reject('Canvas not found');
            
            const context = canvas.getContext('2d');
            if (!context) return Promise.reject('Canvas context not found');
            
            const viewport = page.getViewport({scale: 1.5});
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const renderContext = {
              canvasContext: context,
              viewport: viewport
            };
            
            return page.render(renderContext).promise;
          })
        }, i)

        // Wait for rendering to complete
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Take screenshot of canvas
        const canvas = await page.$('#canvas')
        if (canvas) {
          const screenshot = await canvas.screenshot({ type: 'png' })
          pages.push(`data:image/png;base64,${Buffer.from(screenshot).toString('base64')}`)
        }
      } catch (error) {
        console.error(`Error rendering page ${i}:`, error)
        break
      }
    }

    await browser.close()

    return NextResponse.json({
      totalPages,
      pages
    })

  } catch (error) {
    console.error('Error rendering PDF pages:', error)
    return NextResponse.json(
      { error: 'Failed to render PDF pages', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
