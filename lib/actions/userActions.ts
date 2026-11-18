'use server';

import dbConnect from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

export async function updateUserProfile(userId: string, data: { name?: string; currentPassword?: string; newPassword?: string }) {
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
    return { success: true, message: 'Settings updated successfully!' };
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    throw new Error(error.message || 'Failed to update profile.');
  }
}