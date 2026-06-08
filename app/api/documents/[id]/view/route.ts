import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'

// Extend Window interface for our custom properties
declare global {
  interface Window {
    conversionComplete?: boolean
    conversionError?: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params
  
  console.log('=== VIEW API CALLED ===')
  console.log('Document ID:', documentId)
  console.log('Request URL:', request.url)
  console.log('Request headers:', Object.fromEntries(request.headers.entries()))

  try {
    // Get the auth token from the request
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Use the same API proxy approach as the frontend
    const backendUrl = 'https://api.kubcrm.kz'
    
    // Forward the request to your existing API with authentication
    const response = await fetch(`${backendUrl}/documents/${documentId}/file`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend API error:', response.status, errorText)
      throw new Error(`Failed to view document: ${response.status} ${errorText}`)
    }

    const blob = await response.blob()
    const contentType = response.headers.get('content-type') || blob.type
    
    console.log('Document ID:', documentId)
    console.log('Response status:', response.status)
    console.log('Content type from header:', response.headers.get('content-type'))
    console.log('Content type from blob:', blob.type)
    console.log('Final content type:', contentType)

    // If it's already a PDF, return it directly
    if (contentType.toLowerCase().includes('pdf')) {
      console.log('File is already PDF, returning directly')
      return new NextResponse(blob, {
        status: response.status,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }

    // If it's a DOCX, convert to PDF using Puppeteer
    if (contentType.toLowerCase().includes('openxmlformats-officedocument.wordprocessingml.document') || 
        contentType.toLowerCase().includes('docx')) {
      console.log('Detected DOCX file, converting to PDF...')
      
      try {
        // Convert blob to base64
        const arrayBuffer = await blob.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        
        // Launch Puppeteer
        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        })

        const page = await browser.newPage()
        
        // Create a simple HTML page that will handle the DOCX to PDF conversion
        await page.setContent(`
          <!DOCTYPE html>
          <html>
          <head>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"></script>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
              .loading { text-align: center; padding: 50px; }
            </style>
          </head>
          <body>
            <div class="loading" id="loading">Converting DOCX to HTML...</div>
            <div id="content"></div>
            <script>
              const base64Data = '${base64}';
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              mammoth.extractRawText({arrayBuffer: bytes.buffer})
                .then(function(result) {
                  document.getElementById('loading').style.display = 'none';
                  document.getElementById('content').innerHTML = '<pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">' + result.value + '</pre>';
                  console.log('DOCX converted to HTML, text length:', result.value.length);
                  window.conversionComplete = true;
                })
                .catch(function(error) {
                  console.error('Error converting DOCX:', error);
                  document.getElementById('loading').textContent = 'Error converting document: ' + error.message;
                  window.conversionError = error.message;
                });
            </script>
          </body>
          </html>
        `)

        // Wait for conversion to complete with better timeout
        await page.waitForFunction(() => {
          return window.conversionComplete === true || window.conversionError !== undefined
        }, { timeout: 15000 })

        // Check if there was an error
        const conversionError = await page.evaluate(() => window.conversionError)
        if (conversionError) {
          throw new Error('DOCX conversion failed: ' + conversionError)
        }

        // Check if we got any content
        const content = await page.evaluate(() => {
          const contentDiv = document.getElementById('content')
          return contentDiv ? contentDiv.textContent : ''
        })
        
        if (!content || content.trim().length === 0) {
          throw new Error('DOCX conversion produced no content')
        }

        console.log('DOCX content length:', content.length)

        // Generate PDF
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            right: '20mm',
            bottom: '20mm',
            left: '20mm'
          }
        })

        await browser.close()

        // Return the generated PDF
        return new NextResponse(Buffer.from(pdfBuffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      } catch (conversionError) {
        console.error('DOCX conversion error:', conversionError)
        // If conversion fails, return the original file with a clear error
        return new NextResponse(blob, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': 'attachment; filename="document.docx"',
            'X-Conversion-Error': 'DOCX to PDF conversion failed',
          },
        })
      }
    }

    // If it's an Excel file, convert to PDF
    if (contentType.toLowerCase().includes('openxmlformats-officedocument.spreadsheetml.sheet') || 
        contentType.toLowerCase().includes('xlsx')) {
      console.log('Detected Excel file, converting to PDF...')
      
      try {
        // Convert blob to base64
        const arrayBuffer = await blob.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        
        // Launch Puppeteer
        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        })

        const page = await browser.newPage()
        
        // Create a simple HTML page that will handle the Excel to PDF conversion
        await page.setContent(`
          <!DOCTYPE html>
          <html>
          <head>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
              .loading { text-align: center; padding: 50px; }
              table { border-collapse: collapse; width: 100%; margin: 20px 0; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; font-weight: bold; }
              .sheet-title { font-size: 18px; font-weight: bold; margin: 20px 0 10px 0; }
            </style>
          </head>
          <body>
            <div class="loading" id="loading">Converting Excel to HTML...</div>
            <div id="content"></div>
            <script>
              const base64Data = '${base64}';
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              try {
                const workbook = XLSX.read(bytes.buffer, {type: 'array'});
                let html = '';
                
                workbook.SheetNames.forEach(function(sheetName, index) {
                  const worksheet = workbook.Sheets[sheetName];
                  const htmlTable = XLSX.utils.sheet_to_html(worksheet, {header: ''});
                  
                  html += '<div class="sheet-title">Sheet: ' + sheetName + '</div>';
                  html += htmlTable;
                  html += '<div style="page-break-after: always;"></div>';
                });
                
                document.getElementById('loading').style.display = 'none';
                document.getElementById('content').innerHTML = html;
                console.log('Excel converted to HTML');
                window.conversionComplete = true;
              } catch (error) {
                console.error('Error converting Excel:', error);
                document.getElementById('loading').textContent = 'Error converting Excel file: ' + error.message;
                window.conversionError = error.message;
              }
            </script>
          </body>
          </html>
        `)

        // Wait for conversion to complete
        await page.waitForFunction(() => {
          return window.conversionComplete === true || window.conversionError !== undefined
        }, { timeout: 15000 })

        // Check if there was an error
        const conversionError = await page.evaluate(() => window.conversionError)
        if (conversionError) {
          throw new Error('Excel conversion failed: ' + conversionError)
        }

        // Check if we got any content
        const content = await page.evaluate(() => {
          const contentDiv = document.getElementById('content')
          return contentDiv ? contentDiv.innerHTML : ''
        })
        
        if (!content || content.trim().length === 0) {
          throw new Error('Excel conversion produced no content')
        }

        console.log('Excel content length:', content.length)

        // Generate PDF
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            right: '20mm',
            bottom: '20mm',
            left: '20mm'
          }
        })

        await browser.close()

        // Return the generated PDF
        return new NextResponse(Buffer.from(pdfBuffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      } catch (conversionError) {
        console.error('Excel conversion error:', conversionError)
        // If conversion fails, return the original file with a clear error
        return new NextResponse(blob, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': 'attachment; filename="document.xlsx"',
            'X-Conversion-Error': 'Excel to PDF conversion failed',
          },
        })
      }
    }

    // For other file types, return error
    console.log('Unsupported file type detected:', contentType)
    throw new Error(`Unsupported file type: ${contentType}. Supported types: PDF, DOCX, XLSX`)

  } catch (error) {
    console.error('Error viewing document:', error)
    return NextResponse.json(
      { error: 'Failed to view document', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
