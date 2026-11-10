'use server';

import dbConnect from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import bcrypt from 'bcryptjs';

export async function registerUser(formData: {
  name: string;
  email: string;
  password: string;
}) {
  try {
    await dbConnect();

    const { name, email, password } = formData;

    if (!name || !email || !password) {
      throw new Error('Please fill in all fields.');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new Error('An account with this email already exists.');
    }

    // Hash the password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new user
    await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Registration error:', error);
    throw new Error(error.message || 'Failed to register user.');
  }
}