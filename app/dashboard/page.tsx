import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getFilteredLogs } from '@/lib/actions/logActions';
import { getUserCategories } from '@/lib/actions/categoryActions';
import DashboardClient from '@/components/DashboardClient';

export const instant = false;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string }>;
}) {
  const session = await auth();

  if (!session || !session.user) {
    redirect('/login');
  }

  // Extract the real MongoDB user ID from the session callback
  const userId = (session.user as { id: string }).id;
  const userName = session.user.name || 'User';

  const resolvedSearchParams = await searchParams;
  const searchQuery = resolvedSearchParams?.search || '';
  const categoryId = resolvedSearchParams?.category || '';

  // Fetch filtered logs and user categories server-side in parallel
  const [initialLogs, initialCategories] = await Promise.all([
    getFilteredLogs({
      userId,
      searchQuery,
      categoryId: categoryId === 'all' ? undefined : categoryId,
    }),
    getUserCategories(userId),
  ]);

  return (
    <DashboardClient
      initialLogs={initialLogs || []}
      initialCategories={initialCategories || []}
      userId={userId}
      userName={userName}
    />
  );
}