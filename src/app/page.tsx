/**
 * BorderClash Dashboard - ISR Entry Point
 * 
 * This is a Server Component that:
 * 1. Fetches data from Convex at build/revalidation time (NOT on every user request)
 * 2. Passes the data to the client component as props
 * 3. Configures ISR with a 3-hour revalidation window
 * 
 * Result: Convex is hit once per 3 hours, not once per user.
 * Bandwidth reduction: ~99% at scale.
 */

import { fetchBorderClashData, type BorderClashData } from '@/lib/convex-server';
import { DashboardClient } from './DashboardClient';
import { DashboardClient as DashboardClientTest } from './DashboardClientTest';

// ============================================================================
// DEVELOPMENT TOGGLE: Set to true to use the new cascade layout logic
// Set to false to use the original dashboard
// ============================================================================
const USE_TEST_DASHBOARD = true;

// ISR Configuration: Revalidate every 3 hours (10800 seconds)
// Change this value to adjust how often the cache refreshes
export const revalidate = 10800; // 3 hours in seconds

export default async function DashboardPage() {
  // This runs at build time and during ISR revalidation
  // NOT on every user request!
  let initialData: BorderClashData | null = null;
  let error: string | null = null;

  try {
    initialData = await fetchBorderClashData();
    console.log(`[ISR] Data fetched at ${new Date().toISOString()}, fetchedAt: ${initialData.fetchedAt}`);
  } catch (e) {
    console.error('[ISR] Failed to fetch data:', e);
    error = e instanceof Error ? e.message : 'Failed to load data. Please refresh the page.';
  }

  // Pass server-fetched data to client component
  // Use test dashboard when USE_TEST_DASHBOARD is true
  if (USE_TEST_DASHBOARD) {
    return <DashboardClientTest initialData={initialData} serverError={error} />;
  }

  return <DashboardClient initialData={initialData} serverError={error} />;
}