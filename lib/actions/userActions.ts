'use server';

import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import { User, type UserPlan, type UserRole } from '@/lib/models/User';
import { Log } from '@/lib/models/Log';
import { Category } from '@/lib/models/Category';
import { canAccessUserManagement } from '@/lib/permissions';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

async function requireSuperUser() {
  const session = await auth();
  const userId = (session?.user as any)?.id;

  if (!userId) {
    throw new Error('Unauthorized: Please sign in.');
  }

  await dbConnect();
  const currentUser = await User.findById(userId).lean();

  if (!currentUser || !canAccessUserManagement(currentUser as any)) {
    throw new Error('Forbidden: Super-user access required.');
  }

  return {
    userId: String((currentUser as any)._id),
    user: currentUser as any,
  };
}

export interface ManagedUserRow {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  plan: UserPlan;
  features: string[];
  isActive: boolean;
  logCount: number;
  categoryCount: number;
  createdAt?: string;
}

export async function getAllUsersForAdmin(): Promise<ManagedUserRow[]> {
  await requireSuperUser();

  const [users, logCounts, categoryCounts] = await Promise.all([
    User.find({})
      .select('-password')
      .sort({ createdAt: -1 })
      .lean(),
    Log.aggregate([{ $group: { _id: '$userId', count: { $sum: 1 } } }]),
    Category.aggregate([{ $group: { _id: '$userId', count: { $sum: 1 } } }]),
  ]);

  const logMap = new Map<string, number>(
    logCounts.map((item: any) => [String(item._id), item.count])
  );
  const categoryMap = new Map<string, number>(
    categoryCounts.map((item: any) => [String(item._id), item.count])
  );

  return users.map((u: any) => {
    const id = String(u._id);
    return {
      _id: id,
      name: String(u.name || ''),
      email: String(u.email || ''),
      role: (u.role || 'user') as UserRole,
      plan: (u.plan || 'free') as UserPlan,
      features: Array.isArray(u.features) ? u.features.map(String) : [],
      isActive: u.isActive !== false,
      logCount: logMap.get(id) || 0,
      categoryCount: categoryMap.get(id) || 0,
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : undefined,
    };
  });
}

export async function updateUserAccess(
  targetUserId: string,
  updates: {
    role?: UserRole;
    plan?: UserPlan;
    features?: string[];
    isActive?: boolean;
  }
) {
  const { userId: currentAdminId } = await requireSuperUser();

  // Prevent a super_user from accidentally removing their own super_user role or suspending themselves
  if (targetUserId === currentAdminId) {
    if (updates.role && updates.role !== 'super_user') {
      throw new Error('You cannot remove your own super-user role.');
    }
    if (updates.isActive === false) {
      throw new Error('You cannot deactivate your own account.');
    }
  }

  const sanitizedFeatures = Array.isArray(updates.features)
    ? Array.from(new Set(updates.features.map((f) => String(f).trim()).filter(Boolean)))
    : undefined;

  const updated = await User.findByIdAndUpdate(
    targetUserId,
    {
      $set: {
        ...(updates.role !== undefined && { role: updates.role }),
        ...(updates.plan !== undefined && { plan: updates.plan }),
        ...(sanitizedFeatures !== undefined && { features: sanitizedFeatures }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive }),
      },
    },
    { new: true, runValidators: true }
  )
    .select('-password')
    .lean();

  if (!updated) {
    throw new Error('Target user not found.');
  }

  revalidatePath('/dashboard/users');
  return JSON.parse(JSON.stringify(updated));
}

export async function updateUserProfile(
  userId: string,
  data: { name?: string; currentPassword?: string; newPassword?: string }
) {
  try {
    await dbConnect();

    const user = await User.findOne({ $or: [{ _id: userId }, { email: userId }] });
    if (!user) {
      throw new Error('User not found.');
    }

    if (data.name) {
      user.name = data.name.trim();
    }

    if (data.newPassword) {
      if (!data.currentPassword) {
        throw new Error('Current password is required to set a new password.');
      }
      const isMatch = await bcrypt.compare(data.currentPassword, user.password);
      if (!isMatch) {
        throw new Error('Incorrect current password.');
      }
      user.password = await bcrypt.hash(data.newPassword, 10);
    }

    await user.save();

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/settings');
    return { success: true, message: 'Settings updated successfully!' };
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    throw new Error(error.message || 'Failed to update profile.');
  }
}