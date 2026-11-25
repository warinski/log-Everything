'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Lock,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Crown,
  Settings,
} from 'lucide-react';
import { updateUserProfile } from '@/lib/actions/userActions';
import {
  hasFeature,
  isSuperUser,
  type FeatureKey,
  type PermissionUser,
} from '@/lib/permissions';

interface SettingsClientProps {
  user: {
    userId: string;
    name: string;
    email: string;
    role?: string;
    plan?: string;
    features?: string[];
  };
}

const PLAN_LABELS: Record<string, { label: string; description: string; badgeClass: string }> = {
  free: {
    label: 'Free',
    description: 'Core event logging, timeline feed, and standard category templates.',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  standard: {
    label: 'Standard',
    description: 'Includes Free capabilities plus unlocked analytics features.',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  pro: {
    label: 'Pro',
    description: 'Includes expanded analytics and higher category capacity.',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
};

const FEATURE_DISPLAY: {
  key: Exclude<FeatureKey, 'user_management'>;
  name: string;
  detail: string;
}[] = [
  {
    key: 'advanced_analytics',
    name: 'Advanced Analytics',
    detail: 'Deeper trend breakdowns and frequency/aggregation insights.',
  },
  {
    key: 'unlimited_categories',
    name: 'Unlimited Categories',
    detail: 'Create custom category templates without tier caps.',
  },
  {
    key: 'view_all_logs',
    name: 'View All Logs',
    detail: 'Cross-account log visibility for elevated accounts.',
  },
];

export default function SettingsClient({ user }: SettingsClientProps) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const planKey = (user.plan || 'free').toLowerCase();
  const planInfo = PLAN_LABELS[planKey] || {
    label: planKey.charAt(0).toUpperCase() + planKey.slice(1),
    description: 'Active account plan configured for your profile.',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  };

  const permissionUser: PermissionUser = {
    role: user.role,
    plan: user.plan,
    features: user.features,
  };
  const superUser = isSuperUser(permissionUser);

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
      router.refresh();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update settings.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col space-y-6 px-2 sm:px-4 pb-12">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
        <h1 className="text-sm sm:text-xl font-bold tracking-tight text-gray-900">
          User Settings
        </h1>
      </div>

      {message && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-2.5 text-xs sm:text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
              : 'bg-red-50 text-red-800 border border-red-100'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Account Plan & Entitlements */}
      <div className="bg-white border border-blue-100 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" /> Account Plan & Entitlements
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {superUser && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-blue-600 text-white border-blue-600">
                <Crown className="w-3.5 h-3.5" /> Super-User (Unrestricted)
              </span>
            )}
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${planInfo.badgeClass}`}
            >
              Base Plan: {planInfo.label}
            </span>
          </div>
        </div>

        {superUser ? (
          <div className="rounded-xl border border-blue-200/80 bg-blue-50/40 px-3.5 py-2.5 text-xs sm:text-sm text-blue-950">
            <span className="font-semibold">Elevated Super-User Privileges:</span> Your account holds the{' '}
            <code className="font-mono text-xs bg-white/80 px-1.5 py-0.5 rounded border border-blue-100">
              super_user
            </code>{' '}
            role, which automatically unlocks all platform capabilities and grants access to{' '}
            <a href="/dashboard/users" className="font-semibold text-blue-700 underline">
              User Management
            </a>{' '}
            regardless of your underlying base plan ({planInfo.label}).
          </div>
        ) : (
          <p className="text-xs sm:text-sm text-gray-600">{planInfo.description}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {FEATURE_DISPLAY.map((feat) => {
            const enabled = hasFeature(permissionUser, feat.key);
            const isCustomOverride =
              !superUser && Array.isArray(user.features) && user.features.includes(feat.key);

            const badgeLabel = superUser
              ? 'Super-User Access'
              : enabled
                ? 'Enabled'
                : 'Locked';

            const badgeStyle = superUser
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : enabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-gray-100 text-gray-500 border-gray-200';

            return (
              <div
                key={feat.key}
                className="p-3 rounded-xl border border-blue-100/80 bg-blue-50/20 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-gray-900">{feat.name}</span>
                    {isCustomOverride && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                        Grant
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">{feat.detail}</p>
                </div>

                <span
                  className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${badgeStyle}`}
                >
                  {badgeLabel}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-gray-400">
          {superUser
            ? 'Super-user access overrides plan limits. You can still test standard plan or feature behavior on non-super-user accounts via User Management.'
            : 'If your plan or features were recently updated, sign out and back in to refresh your session.'}
        </p>
      </div>

      {/* Profile & Password Form */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white border border-blue-100 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-6"
      >
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" /> Profile Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                Full Name
              </label>
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
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                Email Address (Read-only)
              </label>
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
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                Current Password
              </label>
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
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  New Password
                </label>
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
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Confirm New Password
                </label>
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
          Your account is fully authenticated and secured with enterprise-grade encryption. You can download a complete backup of all logs and category templates anytime from the{' '}
          <a href="/dashboard/analytics" className="text-blue-600 font-semibold hover:underline">
            Insights & Analytics
          </a>{' '}
          page.
        </p>
      </div>
    </div>
  );
}