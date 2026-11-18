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

  const userId = (session.user as any).id;

  await dbConnect();
  const dbUser = await User.findOne({ $or: [{ _id: userId }, { email: session.user.email }] }).lean();

  const userData = {
    userId: userId,
    name: dbUser?.name || session.user.name || '',
    email: dbUser?.email || session.user.email || '',
  };

  return <SettingsClient user={userData} />;
}