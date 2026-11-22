'use server';

import crypto from 'crypto';
import dbConnect from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

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

export async function requestPasswordReset(email: string) {
  try {
    await dbConnect();

    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error('Please enter a valid email address.');
    }

    const genericMessage =
      'If an account exists with that email, a password reset link has been sent.';

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return { success: true, message: genericMessage };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = hashResetToken(rawToken);
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    if (resend) {
      const fromAddress =
        process.env.EMAIL_FROM || 'LoggerLogger <onboarding@resend.dev>';

      const { error } = await resend.emails.send({
        from: fromAddress,
        to: user.email,
        subject: 'Reset your LoggerLogger password',
        html: `
          <div style="font-family: sans-serif; line-height: 1.5; color: #111827;">
            <h2>Reset your password</h2>
            <p>We received a request to reset the password for your LoggerLogger account.</p>
            <p>
              <a href="${resetUrl}" style="display: inline-block; padding: 10px 16px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Reset Password
              </a>
            </p>
            <p style="font-size: 12px; color: #6b7280;">
              This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        `,
      });

      if (error) {
        console.error('Resend email error:', error);
        throw new Error('Failed to send reset email. Please try again later.');
      }
    } else {
      console.log(`[Password Reset] Reset link for ${user.email}: ${resetUrl}`);
    }

    return { success: true, message: genericMessage };
  } catch (error: any) {
    console.error('Password reset request error:', error);
    throw new Error(error.message || 'Failed to request password reset.');
  }
}

export async function resetPassword(token: string, newPassword: string) {
  try {
    await dbConnect();

    if (!token || typeof token !== 'string') {
      throw new Error('Invalid or missing reset token.');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }

    const hashedToken = hashResetToken(token.trim());
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new Error('This password reset link is invalid or has expired.');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return {
      success: true,
      message: 'Your password has been reset. You can now sign in.',
    };
  } catch (error: any) {
    console.error('Reset password error:', error);
    throw new Error(error.message || 'Failed to reset password.');
  }
}