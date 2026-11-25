import { SlidersHorizontal } from 'lucide-react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getFilteredLogs } from '@/lib/actions/logActions';
import { getUserCategories } from '@/lib/actions/categoryActions';
import FieldValueExplorer from '@/components/FieldValueExplorer';

export const instant = false;

export default async function ExplorerPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect('/login');
  }

  const userId = (session.user as any).id;

  const [initialLogs, initialCategories] = await Promise.all([
    getFilteredLogs({ userId }),
    getUserCategories(userId),
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-2.5 sm:space-y-3.5 px-2 sm:px-4">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
        <h1 className="text-sm sm:text-xl font-bold tracking-tight text-gray-900">
          Field Explorer
        </h1>
      </div>

      <FieldValueExplorer
        userId={userId}
        categories={initialCategories || []}
        logs={initialLogs || []}
      />
    </div>
  );
}