import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getSavedViews } from '@/lib/actions/savedViewActions';
import { getUserCategories } from '@/lib/actions/categoryActions';
import SavedViewsManagerClient from '@/components/SavedViewsManagerClient';

export default async function SavedViewsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const userId = (session.user as any).id;
  const [views, categories] = await Promise.all([
    getSavedViews(userId),
    getUserCategories(userId),
  ]);

  return (
    <SavedViewsManagerClient
      userId={userId}
      initialViews={views}
      categories={categories || []}
    />
  );
}