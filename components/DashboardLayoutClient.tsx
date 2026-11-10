'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LayoutDashboard, Tags, FolderKanban, BarChart3, Settings, Plus, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import LogModal, { CategoryTemplate } from '@/components/LogModal';
import { LogItem } from '@/components/LogCard';
import { getUserCategories, createCategory } from '@/lib/actions/categoryActions';
import { createLog, updateLog } from '@/lib/actions/logActions';

interface DashboardLayoutClientProps {
  userId: string;
  userName: string;
  children: React.ReactNode;
}

function DashboardContent({ userId, userName, children }: DashboardLayoutClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get('search') || '';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<LogItem | null>(null);
  const [categories, setCategories] = useState<CategoryTemplate[]>([]);

  const loadCategories = useCallback(async () => {
    try {
      const data = await getUserCategories(userId);
      setCategories(data);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  }, [userId]);

  useEffect(() => {
    loadCategories();

    // Listen for custom edit events dispatched from LogCard components
    const handleEditLogEvent = (e: CustomEvent<LogItem>) => {
      setEditingLog(e.detail);
    };

    window.addEventListener('editLog', handleEditLogEvent as EventListener);
    return () => {
      window.removeEventListener('editLog', handleEditLogEvent as EventListener);
    };
  }, [loadCategories]);

  const handleCreateCategory = async (newCatData: Record<string, unknown>) => {
    await createCategory({ ...newCatData, userId });
    await loadCategories();
    router.refresh(); // 👈 Refreshes server components
  };

  const handleSaveLog = async (logData: Record<string, unknown>, isEditing: boolean, logId?: string) => {
    if (isEditing && logId) {
      await updateLog(logId, userId, logData as any);
    } else {
      await createLog({ ...logData, userId });
    }
    router.refresh(); // 👈 Refreshes server components to show new/updated logs immediately
  };

  const handleSuccessAction = () => {
    loadCategories();
    router.refresh();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    
    if (query) {
      params.set('search', query);
    } else {
      params.delete('search');
    }
    
    router.push(`/dashboard?${params.toString()}`);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 flex flex-col justify-between shrink-0">
        <div>
          <div className="h-16 flex items-center px-6 border-b border-gray-100">
            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Log Everything
            </span>
          </div>
          <nav className="p-4 space-y-1">
            <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100">
              <LayoutDashboard className="w-4 h-4 text-gray-500" /> Main Feed & Logs
            </Link>
            <Link href="/dashboard/tags" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100">
              <Tags className="w-4 h-4 text-gray-500" /> Tags Management
            </Link>
            <Link href="/dashboard/categories" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100">
              <FolderKanban className="w-4 h-4 text-gray-500" /> Categories & Templates
            </Link>
            <Link href="/dashboard/analytics" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100">
              <BarChart3 className="w-4 h-4 text-gray-500" /> Insights & Analytics
            </Link>
          </nav>
        </div>

        <div className="p-4 border-t border-gray-100 space-y-3">
          <Link href="/dashboard/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100">
            <Settings className="w-4 h-4 text-gray-500" /> Settings
          </Link>
          
          <div className="px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-500 truncate">
            <span className="font-semibold block text-gray-700">{userName}</span>
            <span className="text-[10px] text-gray-400">Authenticated</span>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4 w-full max-w-md">
            <input
              type="text"
              value={currentSearch}
              onChange={handleSearchChange}
              placeholder="Search logs, attributes, or tags..."
              className="w-full bg-gray-100 border-none rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Log Entry
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>

      <LogModal
        isOpen={isModalOpen || !!editingLog}
        onClose={() => {
          setIsModalOpen(false);
          setEditingLog(null);
        }}
        categories={categories}
        userId={userId}
        initialData={editingLog}
        onSaveLog={handleSaveLog}
        onCreateCategory={handleCreateCategory}
        onSuccess={handleSuccessAction}
      />
    </div>
  );
}

export default function DashboardLayoutClient({ userId, userName, children }: DashboardLayoutClientProps) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-gray-400">Loading dashboard...</div>}>
      <DashboardContent userId={userId} userName={userName}>
        {children}
      </DashboardContent>
    </Suspense>
  );
}