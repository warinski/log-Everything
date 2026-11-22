'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Layers3, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { requestPasswordReset } from '@/lib/actions/authActions';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setStatusMessage('');

    try {
      const res = await requestPasswordReset(email);
      setStatusMessage(
        res.message ||
          'If an account exists with that email, a password reset link has been sent.'
      );
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
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
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Forgot Password</h1>
          <p className="text-xs text-gray-500 mt-1">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2.5 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {statusMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2.5 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/25 text-gray-900 bg-white"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition-colors shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isLoading ? 'Sending Reset Link...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}