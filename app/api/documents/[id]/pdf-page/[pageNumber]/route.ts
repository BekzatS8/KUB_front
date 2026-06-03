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
  { params }: { params: { id: string; pageNumber: string } }
) {
  const documentId = params.id
  const pageNumber = parseInt(params.pageNumber)

  if (isNaN(pageNumber) || pageNumber < 1) {
    return NextResponse.json(
      { error: 'Invalid page number' },
      { status: 400 }
    )
  }

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
    
    // Use PDF.js to render specific page
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
          <div class="loading" id="loading">Loading PDF page ${pageNumber}...</div>
          <canvas id="canvas"></canvas>
          <script>
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            
            const pdfData = atob('${pdfBase64}');
            const loadingTask = pdfjsLib.getDocument({data: pdfData});
            const targetPage = ${pageNumber};
            
            loadingTask.promise.then(function(pdf) {
              console.log('PDF loaded with ' + pdf.numPages + ' pages');
              window.pdfDoc = pdf;
              window.totalPages = pdf.numPages;
              
              if (targetPage > pdf.numPages) {
                throw new Error('Page number exceeds total pages');
              }
              
              document.getElementById('loading').style.display = 'none';
              
              // Render specific page
              return pdf.getPage(targetPage).then(function(page) {
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

    // Render the specific page
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
    }, pageNumber)

    // Wait for rendering to complete
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Take screenshot of canvas
    const canvas = await page.$('#canvas')
    if (!canvas) {
      throw new Error('Canvas not found')
    }

    const screenshot = await canvas.screenshot({ type: 'png' })
    await browser.close()

    // Return the image as response
    return new NextResponse(Buffer.from(screenshot), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })

  } catch (error) {
    console.error(`Error rendering PDF page ${pageNumber}:`, error)
    return NextResponse.json(
      { error: 'Failed to render PDF page' },
      { status: 500 }
    )
  }
}
