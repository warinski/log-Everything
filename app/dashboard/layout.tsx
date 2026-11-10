import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import DashboardLayoutClient from '@/components/DashboardLayoutClient';

export const instant = false; // 👈 Allows the route to be a blocking route for dynamic requests like auth()

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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