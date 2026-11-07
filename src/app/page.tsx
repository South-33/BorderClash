/**
 * BorderClash Dashboard - ISR Entry Point
 * 
 * This is a Server Component that:
 * 1. Fetches data from Convex at build/revalidation time (NOT on every user request)
 * 2. Passes the data to the client component as props
 * 3. Uses on-demand revalidation (triggered after each research cycle)
 * 
 * Result: normal page views reuse the latest successful ISR snapshot instead
 * of repeating the same dashboard reads for every user.
 */

import { fetchBorderClashData, type BorderClashData } from '@/lib/convex-server';
import { DashboardClient } from './DashboardClient';

// ISR Configuration: 24-hour fallback (86400 seconds)
// Primary revalidation is on-demand via /api/revalidate (triggered after each research cycle)
// This is just a safety net in case on-demand revalidation fails
export const revalidate = 86400; // 24 hours fallback

export default async function DashboardPage() {
  // Let unrecoverable fetch errors throw during revalidation so Next.js keeps serving
  // the last successful ISR snapshot instead of caching an error shell.
  const initialData: BorderClashData = await fetchBorderClashData();
  console.log(`[ISR] Data fetched at ${new Date().toISOString()}, fetchedAt: ${initialData.fetchedAt}`);

  return <DashboardClient initialData={initialData} />;
}
