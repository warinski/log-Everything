'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Layers3, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { resetPassword } from '@/lib/actions/authActions';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!token) {
      setError('Missing reset token. Please request a new password reset link.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await resetPassword(token, newPassword);
      setSuccessMessage(res.message || 'Password updated successfully.');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 space-y-6">
      {/* LoggerLogger Branding Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md">
          <Layers3 className="w-6 h-6 text-white" />
        </div>
        <span className="text-xl font-extrabold text-gray-950 tracking-tighter">
          Logger<span className="text-blue-600">Logger</span>
        </span>
      </div>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-gray-900">Reset Password</h1>
        <p className="text-xs text-gray-500 mt-1">Choose a new password for your account.</p>
      </div>

      {!token && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2.5 font-medium">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>
            Invalid reset link.{' '}
            <Link href="/forgot-password" className="underline font-semibold">
              Request a new one
            </Link>
            .
          </span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2.5 font-medium">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2.5 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage} Redirecting to sign in...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            New Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-1.5 pr-9 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/25 text-gray-900 bg-white"
              placeholder="At least 6 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Confirm New Password
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/25 text-gray-900 bg-white"
            placeholder="Re-enter new password"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !token}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition-colors shadow-sm cursor-pointer disabled:opacity-50"
        >
          {isLoading ? 'Updating Password...' : 'Reset Password'}
        </button>
      </form>

      <p className="text-center text-xs text-gray-500">
        Remembered your password?{' '}
        <Link href="/login" className="text-blue-600 font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Suspense
        fallback={
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-xs text-gray-500">
            Loading reset form...
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}