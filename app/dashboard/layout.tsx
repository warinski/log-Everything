import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import DashboardLayoutClient from '@/components/DashboardLayoutClient';
import dbConnect from '@/lib/mongodb';
import { User } from '@/lib/models/User';

async function DashboardContent({ children }: { children: React.ReactNode }) {
  headers(); // Request-bound header check
  const session = await auth();

  if (!session || !session.user) {
    redirect('/login');
  }

  const userId = (session.user as any).id;

  // 🔍 Fetch live user details directly from MongoDB to ensure updated name reflects instantly
  await dbConnect();
  const dbUser = await User.findById(userId).lean();
  const userName = dbUser?.name || session.user.name || 'User';

  return (
    <DashboardLayoutClient userId={userId} userName={userName}>
      {children}
    </DashboardLayoutClient>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Loading dashboard...</div>}>
      <DashboardContent>{children}</DashboardContent>
    </Suspense>
  );
}