'use client';

import { useState } from 'react';
import { User, Lock, Mail, ShieldCheck, Download, Moon, Sun, CheckCircle2, AlertCircle } from 'lucide-react';
import { updateUserProfile } from '@/lib/actions/userActions';

interface SettingsClientProps {
  user: {
    userId: string;
    name: string;
    email: string;
  };
}

export default function SettingsClient({ user }: SettingsClientProps) {
  const [name, setName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    try {
      setIsLoading(true);
      await updateUserProfile(user.userId, {
        name,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });

      setMessage({ type: 'success', text: 'Account settings updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update settings.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col space-y-6 px-2 sm:px-4 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-xl font-bold tracking-tight text-gray-900">User Settings</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Manage your profile credentials, security, and preferences.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl flex items-center gap-2.5 text-xs sm:text-sm font-medium ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Profile & Password Form */}
      <form onSubmit={handleSaveProfile} className="bg-white border border-blue-100 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-6">
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" /> Profile Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ fontSize: '16px' }}
                className="w-full px-3.5 py-2.5 bg-white border border-blue-100 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Email Address (Read-only)</label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-gray-50 border border-blue-100/60 rounded-xl text-gray-500 text-xs sm:text-sm">
                <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
            </div>
          </div>
        </div>

        <hr className="border-blue-50" />

        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-600" /> Change Password
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Required only if changing password"
                style={{ fontSize: '16px' }}
                className="w-full px-3.5 py-2.5 bg-white border border-blue-100 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  style={{ fontSize: '16px' }}
                  className="w-full px-3.5 py-2.5 bg-white border border-blue-100 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  style={{ fontSize: '16px' }}
                  className="w-full px-3.5 py-2.5 bg-white border border-blue-100 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Additional Settings Sections (Data & Preferences) */}
      <div className="bg-white border border-blue-100 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" /> Data & Security Overview
        </h2>
        <p className="text-xs text-gray-500">
          Your account is fully authenticated and secured with enterprise-grade encryption. You can download a complete backup of all logs and category templates anytime from the <a href="/dashboard/analytics" className="text-blue-600 font-semibold hover:underline">Insights & Analytics</a> page.
        </p>
      </div>
    </div>
  );
}