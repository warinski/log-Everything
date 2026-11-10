import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getFilteredLogs } from '@/lib/actions/logActions';
import DashboardClient from '@/components/DashboardClient';

export const instant = false; // 👈 Allows the page to be a blocking route for dynamic authentication navigation

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string }> & { search?: string; category?: string };
}) {
  const session = await auth();

  if (!session || !session.user) {
    redirect('/login');
  }

  // Extract the real MongoDB user ID from the session callback
  const userId = (session.user as any).id;
  const userName = session.user.name || 'User';

  const resolvedSearchParams = await searchParams;
  const searchQuery = resolvedSearchParams?.search || '';
  const categoryId = resolvedSearchParams?.category || '';

  // Fetch filtered logs server-side based on search and category parameters
  const initialLogs = await getFilteredLogs({
    userId,
    searchQuery,
    categoryId: categoryId === 'all' ? undefined : categoryId,
  });

  return (
    <DashboardClient 
      initialLogs={initialLogs} 
      userId={userId} 
      userName={userName} 
    />
  );
}