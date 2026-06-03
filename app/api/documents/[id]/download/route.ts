import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const documentId = params.id

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
    const response = await fetch(`${backendUrl}/documents/${documentId}/download`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend API error:', response.status, errorText)
      throw new Error(`Failed to download document: ${response.status} ${errorText}`)
    }

    const blob = await response.blob()
    
    // Return the blob with appropriate headers
    return new NextResponse(blob, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/pdf',
        'Content-Disposition': response.headers.get('Content-Disposition') || `attachment; filename="document-${documentId}.pdf"`,
      },
    })

  } catch (error) {
    console.error('Error downloading document:', error)
    return NextResponse.json(
      { error: 'Failed to download document', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
