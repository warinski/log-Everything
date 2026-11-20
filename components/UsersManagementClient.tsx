'use client';

import { useState, useMemo } from 'react';
import { ShieldCheck, Users, Search, Check, Sparkles, AlertCircle } from 'lucide-react';
import {
  updateUserAccess,
  type ManagedUserRow,
} from '@/lib/actions/userActions';
import type { UserPlan, UserRole } from '@/lib/models/User';
import type { FeatureKey } from '@/lib/permissions';

interface UsersManagementClientProps {
  initialUsers: ManagedUserRow[];
  currentUserId: string;
}

const AVAILABLE_FEATURES: { key: FeatureKey; label: string }[] = [
  { key: 'advanced_analytics', label: 'Advanced Analytics' },
  { key: 'unlimited_categories', label: 'Unlimited Categories' },
  { key: 'view_all_logs', label: 'View All Logs' },
  { key: 'user_management', label: 'User Management' },
];

export default function UsersManagementClient({
  initialUsers,
  currentUserId,
}: UsersManagementClientProps) {
  const [users, setUsers] = useState<ManagedUserRow[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.plan.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

  const handleUpdateUser = async (
    targetUser: ManagedUserRow,
    patch: {
      role?: UserRole;
      plan?: UserPlan;
      features?: string[];
      isActive?: boolean;
    }
  ) => {
    setFeedback(null);
    setSavingUserId(targetUser._id);

    try {
      await updateUserAccess(targetUser._id, patch);

      setUsers((prev) =>
        prev.map((u) =>
          u._id === targetUser._id
            ? {
                ...u,
                ...(patch.role !== undefined && { role: patch.role }),
                ...(patch.plan !== undefined && { plan: patch.plan }),
                ...(patch.features !== undefined && { features: patch.features }),
                ...(patch.isActive !== undefined && { isActive: patch.isActive }),
              }
            : u
        )
      );

      setFeedback({
        type: 'success',
        message: `Updated access settings for ${targetUser.name || targetUser.email}.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to update user settings.',
      });
    } finally {
      setSavingUserId(null);
    }
  };

  const toggleFeatureOverride = (targetUser: ManagedUserRow, featureKey: FeatureKey) => {
    const exists = targetUser.features.includes(featureKey);
    const nextFeatures = exists
      ? targetUser.features.filter((f) => f !== featureKey)
      : [...targetUser.features, featureKey];

    handleUpdateUser(targetUser, { features: nextFeatures });
  };

  const superUserCount = users.filter((u) => u.role === 'super_user').length;
  const paidUserCount = users.filter((u) => u.plan !== 'free').length;

  return (
    <div className="max-w-6xl mx-auto space-y-5 px-2 sm:px-4 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-gray-900">
              User Management
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
              <ShieldCheck className="w-3.5 h-3.5" /> Super-User
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage account roles, subscription plans, and custom feature entitlements.
          </p>
        </div>

        {/* Quick Summary Pills */}
        <div className="flex items-center gap-2 text-xs">
          <div className="rounded-xl bg-white border border-blue-100 px-3 py-1.5 font-medium text-gray-700 shadow-2xs">
            Total: <span className="font-bold text-gray-900">{users.length}</span>
          </div>
          <div className="rounded-xl bg-white border border-blue-100 px-3 py-1.5 font-medium text-gray-700 shadow-2xs">
            Super-Users: <span className="font-bold text-blue-600">{superUserCount}</span>
          </div>
          <div className="rounded-xl bg-white border border-blue-100 px-3 py-1.5 font-medium text-gray-700 shadow-2xs">
            Paid Plans: <span className="font-bold text-indigo-600">{paidUserCount}</span>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Search & Role Filter */}
      <div className="bg-white border border-blue-100 rounded-2xl p-3.5 shadow-2xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, role, or plan..."
            className="w-full rounded-xl border border-blue-100 pl-9 pr-3 py-2 text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
          className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs sm:text-sm text-gray-800 focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="all">All Roles</option>
          <option value="user">Standard Users</option>
          <option value="super_user">Super-Users</option>
        </select>
      </div>

      {/* Users Table / Cards */}
      <div className="bg-white border border-blue-100 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-blue-100 bg-blue-50/40 text-[11px] font-bold uppercase tracking-wider text-gray-600">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Usage</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4">Feature Overrides</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50 text-xs sm:text-sm">
              {filteredUsers.map((user) => {
                const isSelf = user._id === currentUserId;
                const isSaving = savingUserId === user._id;

                return (
                  <tr key={user._id} className="hover:bg-blue-50/20 transition-colors align-top">
                    {/* User Info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{user.name}</span>
                        {isSelf && (
                          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                      {user.createdAt && (
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          Joined {new Date(user.createdAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>

                    {/* Usage Counts */}
                    <td className="py-3.5 px-4 text-xs text-gray-600 whitespace-nowrap">
                      <div>
                        <span className="font-semibold text-gray-900">{user.logCount}</span> logs
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900">{user.categoryCount}</span>{' '}
                        categories
                      </div>
                    </td>

                    {/* Role Selector */}
                    <td className="py-3.5 px-4">
                      <select
                        disabled={isSelf || isSaving}
                        value={user.role}
                        onChange={(e) =>
                          handleUpdateUser(user, { role: e.target.value as UserRole })
                        }
                        className="rounded-lg border border-blue-100 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 focus:outline-none focus:border-blue-500 disabled:opacity-60 cursor-pointer"
                      >
                        <option value="user">User</option>
                        <option value="super_user">Super-User</option>
                      </select>
                    </td>

                    {/* Plan Selector */}
                    <td className="py-3.5 px-4">
                      <select
                        disabled={isSaving}
                        value={user.plan}
                        onChange={(e) =>
                          handleUpdateUser(user, { plan: e.target.value as UserPlan })
                        }
                        className="rounded-lg border border-blue-100 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 focus:outline-none focus:border-blue-500 disabled:opacity-60 cursor-pointer"
                      >
                        <option value="free">Free</option>
                        <option value="standard">Standard</option>
                        <option value="pro">Pro</option>
                      </select>
                    </td>

                    {/* Individual Feature Overrides */}
                    <td className="py-3.5 px-4">
                      {user.role === 'super_user' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                          <Sparkles className="w-3.5 h-3.5" /> All features included
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {AVAILABLE_FEATURES.map((feat) => {
                            const active = user.features.includes(feat.key);
                            return (
                              <button
                                key={feat.key}
                                type="button"
                                disabled={isSaving}
                                onClick={() => toggleFeatureOverride(user, feat.key)}
                                className={`rounded-lg px-2 py-1 text-[11px] font-medium border transition-colors cursor-pointer disabled:opacity-50 ${
                                  active
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'
                                }`}
                              >
                                {active ? `✓ ${feat.label}` : `+ ${feat.label}`}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    {/* Active / Suspended Toggle */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        disabled={isSelf || isSaving}
                        onClick={() => handleUpdateUser(user, { isActive: !user.isActive })}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-50 ${
                          user.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                        }`}
                      >
                        {user.isActive ? 'Active' : 'Suspended'}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-gray-400">
                    <Users className="w-5 h-5 mx-auto mb-1.5 text-gray-300" />
                    No users match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}