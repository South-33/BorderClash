import { loadDashboardData } from '@/lib/data';
import { DashboardClient } from './DashboardClient';

export const dynamic = 'force-static';

export default async function DashboardPage() {
  const initialData = await loadDashboardData();
  return <DashboardClient initialData={initialData} />;
}
