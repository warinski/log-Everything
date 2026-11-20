import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import dbConnect from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { canAccessUserManagement } from '@/lib/permissions';
import { getAllUsersForAdmin } from '@/lib/actions/userActions';
import UsersManagementClient from '@/components/UsersManagementClient';

export default async function UsersManagementPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id;

  if (!userId) {
    redirect('/login');
  }

  await dbConnect();
  const currentUser = await User.findById(userId).lean();

  if (!currentUser || !canAccessUserManagement(currentUser as any)) {
    redirect('/dashboard');
  }

  const users = await getAllUsersForAdmin();

  return (
    <UsersManagementClient
      initialUsers={users}
      currentUserId={String((currentUser as any)._id)}
    />
  );
}