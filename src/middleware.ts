import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to prevent browser caching of the main dashboard page.
 * 
 * This ensures users always get the latest ISR-cached version from Vercel,
 * rather than a stale version from their browser's local cache.
 * 
 * Static assets (JS, CSS, images) are NOT affected - they should be cached.
 */
export function middleware(request: NextRequest) {
    const response = NextResponse.next();

    // Only apply to the main page (not static assets, API routes, etc.)
    const pathname = request.nextUrl.pathname;

    // Skip static assets and API routes
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/static') ||
        pathname.includes('.') // Files with extensions (favicon.ico, etc.)
    ) {
        return response;
    }

    // For the main page, tell browser to NEVER cache locally
    // 'no-store' = do NOT cache at all in browser (most aggressive)
    // 'no-cache' = you CAN cache, but MUST revalidate before using
    // Combined with Pragma for legacy HTTP/1.0 compatibility
    // This allows Vercel's CDN (ISR) to work while preventing stale browser cache
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    // Debug header to track when this response was generated
    response.headers.set('X-BorderClash-Served', new Date().toISOString());

    return response;
}

export const config = {
    // Only run middleware on these paths (performance optimization)
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
