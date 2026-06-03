import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware: Enforce HTTPS and validate public sign routes.
 *
 * 1. Redirects HTTP → HTTPS in production (when not localhost).
 * 2. On /public/sign/[token] routes, validates basic token format.
 */
export function middleware(request: NextRequest) {
    const { protocol, host, pathname } = request.nextUrl

    // ── 1. Enforce HTTPS ──────────────────────────────────────────
    // In production, if the request is HTTP, redirect to HTTPS.
    // Skip for localhost / development environments.
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1')
    const isDevelopment = process.env.NODE_ENV === 'development'

    if (!isDevelopment && !isLocalhost && protocol === 'http:') {
        const httpsUrl = request.nextUrl.clone()
        httpsUrl.protocol = 'https:'
        return NextResponse.redirect(httpsUrl, 301)
    }

    // ── 2. Public sign page validation ────────────────────────────
    // Basic token format check for /public/sign/[token]
    const signMatch = pathname.match(/^\/public\/sign\/([^/]+)$/)
    if (signMatch) {
        const token = signMatch[1]
        // Token must be alphanumeric/dashes/underscores, 8-256 chars
        const tokenRegex = /^[a-zA-Z0-9_-]{8,256}$/
        if (!tokenRegex.test(token)) {
            return new NextResponse('Invalid token format', { status: 400 })
        }
    }

    // ── 3. Add security response headers ──────────────────────────
    const response = NextResponse.next()

    // HSTS header for all responses
    if (!isDevelopment) {
        response.headers.set(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains'
        )
    }

    return response
}

// Apply middleware to all routes except static assets and API
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public static files (logo, images)
         */
        '/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
