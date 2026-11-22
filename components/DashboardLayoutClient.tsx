'use client';

import { UndoToastProvider, useUndoToast } from '@/components/UndoToastProvider';
import { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Menu, X, Layers3 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import LogModal, { CategoryTemplate } from '@/components/LogModal';
import { LogItem } from '@/components/LogCard';
import { getUserCategories, createCategory } from '@/lib/actions/categoryActions';
import { createLog, updateLog } from '@/lib/actions/logActions';

interface DashboardLayoutClientProps {
  userId: string;
  userName: string;
  userRole?: string;
  userPlan?: string;
  userFeatures?: string[];
  children: React.ReactNode;
}

function toDateOrUndefined(value: string | Date | undefined): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

function DashboardContent({
  userId,
  userName,
  userRole,
  userPlan,
  userFeatures,
  children,
}: DashboardLayoutClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showUndoToast } = useUndoToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

    const handleEditLogEvent = (e: CustomEvent<LogItem>) => {
      setEditingLog(e.detail);
    };

    window.addEventListener('editLog', handleEditLogEvent as EventListener);
    return () => {
      window.removeEventListener('editLog', handleEditLogEvent as EventListener);
    };
  }, [loadCategories]);

  const handleCreateCategory = async (newCatData: any) => {
    await createCategory({ ...newCatData, userId });
    await loadCategories();
    router.refresh();
  };

  const handleSaveLog = async (logData: any, isEditing: boolean, logId?: string) => {
    if (isEditing && logId) {
      const previousSnapshot = editingLog ? { ...editingLog } : null;

      await updateLog(logId, userId, logData);
      window.dispatchEvent(new CustomEvent('logCreated'));
      router.refresh();

      if (previousSnapshot) {
        showUndoToast({
          message: `Updated "${previousSnapshot.title || 'log'}"`,
          onUndo: async () => {
            await updateLog(logId, userId, {
              categoryId: previousSnapshot.categoryId,
              categoryName: previousSnapshot.categoryName,
              categoryIcon: previousSnapshot.categoryIcon,
              categoryColor: previousSnapshot.categoryColor,
              title: previousSnapshot.title,
              notes: previousSnapshot.notes,
              tags: previousSnapshot.tags,
              attributes: previousSnapshot.attributes,
              timestamp: toDateOrUndefined(previousSnapshot.timestamp),
            });
            window.dispatchEvent(new CustomEvent('logCreated'));
            router.refresh();
          },
        });
      }
    } else {
      await createLog({ ...logData, userId });
      window.dispatchEvent(new CustomEvent('logCreated'));
      router.refresh();
    }
  };

  const handleSuccessAction = () => {
    loadCategories();
    router.refresh();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden relative">
      {/* 1. Full-Width Top Header Spanning the Entire Viewport */}
      {/* Mobile / 11" iPad Header */}
      <header className="xl:hidden h-14 bg-white border-b border-blue-100 px-3 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-2xs w-full gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-xl bg-blue-50/60 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer shrink-0"
            aria-label="Toggle Navigation Menu"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm shrink-0">
              <Layers3 className="w-4 h-4 text-white" />
            </div>
            {/* Further increased mobile brand text size */}
            <span className="text-lg font-extrabold text-gray-950 tracking-tighter truncate">
              Logger<span className="text-blue-600">Logger</span>
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          style={{ backgroundColor: '#2563EB' }}
          className="flex items-center gap-1 hover:bg-blue-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </header>

      {/* Desktop Full-Width Header */}
      <header className="hidden xl:flex h-16 bg-white border-b border-blue-100 items-center justify-between px-6 shrink-0 sticky top-0 z-30 w-full shadow-2xs">
        {/* Left: Brand Logo & Text */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md">
            <Layers3 className="w-4 h-4 text-white" />
          </div>
          {/* Further increased desktop brand text size */}
          <span className="text-xl font-extrabold text-gray-950 tracking-tighter">
            Logger<span className="text-blue-600">Logger</span>
          </span>
        </div>

        {/* Right: New Log Entry Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            style={{ backgroundColor: '#2563EB' }}
            className="h-9 flex items-center justify-center gap-1.5 hover:bg-blue-700 text-white text-xs font-semibold px-4 rounded-xl shadow-xs transition-all cursor-pointer shrink-0 box-border"
          >
            <Plus className="w-4 h-4" /> New Log Entry
          </button>
        </div>
      </header>

      {/* Backdrop for mobile/iPad drawer */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/20 backdrop-blur-xs z-40 xl:hidden transition-opacity"
        />
      )}

      {/* 2. Content Area Beneath Header (Sidebar + Main Workspace) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar Navigation Drawer (Starts underneath header) */}
        <div
          className={`fixed xl:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-blue-100 flex flex-col transition-transform duration-300 ease-in-out h-full ${
            sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full xl:translate-x-0'
          }`}
          onClick={() => {
            if (window.innerWidth < 1280) setSidebarOpen(false);
          }}
        >
          <Sidebar
            userName={userName}
            userRole={userRole}
            userPlan={userPlan}
            userFeatures={userFeatures}
          />
        </div>

        {/* Main Workspace */}
        <main className="flex-1 p-3 sm:p-6 overflow-y-auto [-webkit-overflow-scrolling:touch]">
          {children}
        </main>
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

export default function DashboardLayoutClient({
  userId,
  userName,
  userRole,
  userPlan,
  userFeatures,
  children,
}: DashboardLayoutClientProps) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-gray-400">Loading dashboard...</div>}>
      <UndoToastProvider>
        <DashboardContent
          userId={userId}
          userName={userName}
          userRole={userRole}
          userPlan={userPlan}
          userFeatures={userFeatures}
        >
          {children}
        </DashboardContent>
      </UndoToastProvider>
    </Suspense>
  );
}