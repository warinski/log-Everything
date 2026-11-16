import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import AnalyticsClient from '@/components/AnalyticsClient';

export const instant = false; // 👈 Allows blocking route on navigation for uncached auth session

export default async function AnalyticsPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect('/login');
  }

  // Extract the real MongoDB user ID from the session
  const userId = (session.user as any).id;

  return <AnalyticsClient userId={userId} />;
}