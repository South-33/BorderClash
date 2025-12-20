/**
 * On-Demand Revalidation API Route
 * 
 * Call this endpoint to invalidate the ISR cache and force a fresh data fetch.
 * Convex calls this after research cycles complete.
 * 
 * POST /api/revalidate
 * Headers: x-revalidate-secret: <REVALIDATE_SECRET>
 */

import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    // Verify the secret to prevent unauthorized cache purges
    const secret = request.headers.get('x-revalidate-secret');
    const expectedSecret = process.env.REVALIDATE_SECRET;

    // If no secret is configured, allow any request (development mode)
    if (expectedSecret && secret !== expectedSecret) {
        return NextResponse.json(
            { error: 'Unauthorized', message: 'Invalid or missing x-revalidate-secret header' },
            { status: 401 }
        );
    }

    try {
        // Revalidate the main page - this purges the ISR cache
        revalidatePath('/');

        // Log for debugging
        console.log(`[Revalidate] Cache purged at ${new Date().toISOString()}`);

        return NextResponse.json({
            revalidated: true,
            timestamp: Date.now(),
            message: 'Cache purged successfully. Next request will fetch fresh data.',
        });
    } catch (error) {
        console.error('[Revalidate] Error purging cache:', error);
        return NextResponse.json(
            { error: 'Revalidation failed', message: String(error) },
            { status: 500 }
        );
    }
}

// Also support GET for easy testing (with secret in query param)
export async function GET(request: NextRequest) {
    const secret = request.nextUrl.searchParams.get('secret');
    const expectedSecret = process.env.REVALIDATE_SECRET;

    if (expectedSecret && secret !== expectedSecret) {
        return NextResponse.json(
            { error: 'Unauthorized', message: 'Invalid or missing secret parameter' },
            { status: 401 }
        );
    }

    try {
        revalidatePath('/');
        console.log(`[Revalidate] Cache purged via GET at ${new Date().toISOString()}`);

        return NextResponse.json({
            revalidated: true,
            timestamp: Date.now(),
            message: 'Cache purged successfully.',
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Revalidation failed', message: String(error) },
            { status: 500 }
        );
    }
}
