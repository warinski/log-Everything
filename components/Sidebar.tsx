'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Tags,
  FolderKanban,
  BarChart3,
  Settings,
  LogOut,
  Users,
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

  const permissionUser: PermissionUser = {
    role: userRole,
    plan: userPlan,
    features: userFeatures,
  };

  const showUserManagement = canAccessUserManagement(permissionUser);

  const navItems = [
    { name: 'Logs Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Insights & Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Categories & Templates', href: '/dashboard/categories', icon: FolderKanban },
    // { name: 'Tags Management', href: '/dashboard/tags', icon: Tags },
    ...(showUserManagement
      ? [{ name: 'User Management', href: '/dashboard/users', icon: Users }]
      : []),
  ];

  return (
    <aside className="w-full md:w-64 bg-white border-r border-blue-100 flex flex-col justify-between shrink-0 h-full">
      {/* Navigation Links with Active Highlighting */}
      <nav className="space-y-1.5 px-3 pt-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-600 font-semibold shadow-xs'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
              }`}
            >
              <item.icon
                className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
              />
              <span className="text-sm whitespace-nowrap tracking-tight">
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-blue-100 space-y-3">
        <Link
          href="/dashboard/settings"
          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer ${
            pathname === '/dashboard/settings'
              ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs border border-blue-100/80'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Settings
            className={`w-4 h-4 ${pathname === '/dashboard/settings' ? 'text-blue-600' : 'text-gray-400'}`}
          />
          Settings
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