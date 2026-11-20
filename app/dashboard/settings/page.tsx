import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import SettingsClient from '@/components/SettingsClient';
import dbConnect from '@/lib/mongodb';
import { User } from '@/lib/models/User';

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const userId = (session.user as any).id || session.user.email;

  await dbConnect();
  const dbUser = await User.findOne({
    $or: [{ _id: userId }, { email: session.user.email }],
  }).lean();

  const userData = {
    userId: dbUser ? String((dbUser as any)._id) : String(userId),
    name: (dbUser as any)?.name || session.user.name || '',
    email: (dbUser as any)?.email || session.user.email || '',
    role: (dbUser as any)?.role || 'user',
    plan: (dbUser as any)?.plan || 'free',
    features: Array.isArray((dbUser as any)?.features) ? (dbUser as any).features : [],
  };

  return <SettingsClient user={userData} />;
}