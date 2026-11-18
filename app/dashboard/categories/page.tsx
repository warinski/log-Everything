// import { getServerSession } from 'next-auth';
import { auth } from '@/auth';
// If your authOptions are in a shared lib file (e.g., '@/lib/auth' or '@/app/api/auth/[...nextauth]/authOptions'), import from there.
// Alternatively, if you want a quick fix without needing authOptions imported here:
import { redirect } from 'next/navigation';
import CategoriesClient from '@/components/CategoriesClient';

export default async function CategoriesPage() {
//   const session = await getServerSession();
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const userId = (session.user as any).id || session.user.email || 'user_test_123';

  return <CategoriesClient userId={userId} />;
}