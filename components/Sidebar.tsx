'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  SlidersHorizontal,
  Tags,
  FolderKanban,
  BarChart3,
  Settings,
  LogOut,
  Users,
  Loader2,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { canAccessUserManagement, type PermissionUser } from '@/lib/permissions';

interface SidebarProps {
  userName: string;
  userRole?: string;
  userPlan?: string;
  userFeatures?: string[];
}

export default function Sidebar({
  userName,
  userRole,
  userPlan,
  userFeatures,
}: SidebarProps) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const permissionUser: PermissionUser = {
    role: userRole,
    plan: userPlan,
    features: userFeatures,
  };

  const showUserManagement = canAccessUserManagement(permissionUser);

  const navItems = [
    { name: 'Logs Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Field Explorer', href: '/dashboard/explorer', icon: SlidersHorizontal },
    { name: 'Insights & Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Categories & Templates', href: '/dashboard/categories', icon: FolderKanban },
    // { name: 'Tags Management', href: '/dashboard/tags', icon: Tags },
    ...(showUserManagement
      ? [{ name: 'User Management', href: '/dashboard/users', icon: Users }]
      : []),
  ];

  const handleLinkClick = (href: string) => {
    if (href !== pathname) {
      setPendingHref(href);
    }
  };

  const isSettingsActive = pathname === '/dashboard/settings' || pendingHref === '/dashboard/settings';
  const isSettingsPending = pendingHref === '/dashboard/settings' && pathname !== '/dashboard/settings';

  return (
    <aside className="w-full md:w-64 bg-white border-r border-blue-100 flex flex-col justify-between shrink-0 h-full">
      {/* Navigation Links with Instant Click + Active Highlighting */}
      <nav className="space-y-1.5 px-3 pt-4">
        {navItems.map((item) => {
          const isCurrent = pathname === item.href;
          const isPending = pendingHref === item.href && !isCurrent;
          const isHighlighted = isCurrent || pendingHref === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => handleLinkClick(item.href)}
              aria-busy={isPending}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all ${
                isHighlighted
                  ? 'bg-blue-50 text-blue-600 font-semibold shadow-xs'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
              }`}
            >
              <item.icon
                className={`w-4 h-4 shrink-0 ${isHighlighted ? 'text-blue-600' : 'text-gray-400'}`}
              />
              <span className="text-sm whitespace-nowrap tracking-tight flex-1">
                {item.name}
              </span>
              {isPending && (
                <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-blue-100 space-y-3">
        <Link
          href="/dashboard/settings"
          onClick={() => handleLinkClick('/dashboard/settings')}
          aria-busy={isSettingsPending}
          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer ${
            isSettingsActive
              ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs border border-blue-100/80'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Settings
            className={`w-4 h-4 shrink-0 ${isSettingsActive ? 'text-blue-600' : 'text-gray-400'}`}
          />
          <span className="flex-1">Settings</span>
          {isSettingsPending && (
            <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
          )}
        </Link>

        <div className="px-3 py-2 bg-blue-50/30 rounded-xl text-xs text-gray-500 border border-blue-100/50 truncate">
          <span className="font-semibold block text-gray-700">{userName}</span>
          <span className="text-[10px] text-blue-500 font-medium">
            {userRole === 'super_user' ? 'Super-User' : 'Authenticated'}
          </span>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>
    </aside>
  );
}