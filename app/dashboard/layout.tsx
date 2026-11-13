import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import DashboardLayoutClient from '@/components/DashboardLayoutClient';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  headers(); // Forces Next.js to treat this layout as dynamic on-demand
  const session = await auth();

  if (!session || !session.user) {
    redirect('/login');
  }

  const userId = (session.user as any).id;
  const userName = session.user.name || 'User';

  return (
    <DashboardLayoutClient userId={userId} userName={userName}>
      {children}
    </DashboardLayoutClient>
  );
}