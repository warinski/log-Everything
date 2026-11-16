'use client';

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
  children: React.ReactNode;
}

function DashboardContent({ userId, userName, children }: DashboardLayoutClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get('search') || '';

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

  const handleCreateCategory = async (newCatData: Record<string, unknown>) => {
    await createCategory({ ...newCatData, userId });
    await loadCategories();
    router.refresh();
  };

  const handleSaveLog = async (logData: Record<string, unknown>, isEditing: boolean, logId?: string) => {
    if (isEditing && logId) {
      await updateLog(logId, userId, logData as any);
    } else {
      await createLog({ ...logData, userId });
    }
    router.refresh();
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
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden relative">
      {/* 1. Full-Width Top Header Spanning the Entire Viewport */}
      {/* Mobile / 11" iPad Header */}
      <header className="xl:hidden h-16 bg-white border-b border-blue-100 px-4 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-2xs w-full">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl bg-blue-50/50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md">
              <Layers3 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-extrabold text-gray-950 tracking-tighter">
              Logger<span className="text-blue-600">Logger</span>
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          style={{ backgroundColor: '#2563EB' }}
          className="flex items-center gap-1.5 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </header>

      {/* Desktop Full-Width Header */}
      <header className="hidden xl:flex h-20 bg-white border-b border-blue-100 items-center justify-between px-6 shrink-0 sticky top-0 z-30 w-full shadow-2xs">
        {/* Left: Brand Logo & Text */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md">
            <Layers3 className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-extrabold text-gray-950 tracking-tighter">
            Logger<span className="text-blue-600">Logger</span>
          </span>
        </div>

        {/* Right: Search Bar & New Log Entry Button side-by-side with matched height */}
        <div className="flex items-center gap-3">
          <div className="w-72 sm:w-80 lg:w-96">
            <input
              type="text"
              value={currentSearch}
              onChange={handleSearchChange}
              placeholder="Search logs, attributes, or tags..."
              className="w-full h-[42px] bg-blue-50/30 border border-blue-100 rounded-xl px-4 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-all box-border"
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            style={{ backgroundColor: '#2563EB' }}
            className="h-[42px] flex items-center justify-center gap-2 hover:bg-blue-700 text-white text-sm font-semibold px-5 rounded-xl shadow-xs transition-all cursor-pointer shrink-0 box-border"
          >
            <Plus className="w-4 h-4" /> New Log Entry
          </button>
        </div>
      </header>

      {/* Mobile search bar sub-header */}
      <div className="xl:hidden p-3 bg-white border-b border-blue-100 shrink-0 w-full">
        <input
          type="text"
          value={currentSearch}
          onChange={handleSearchChange}
          placeholder="Search logs, attributes, or tags..."
          style={{ fontSize: '16px' }}
          className="w-full bg-blue-50/30 border border-blue-100 rounded-xl px-3.5 py-2 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-blue-500"
        />
      </div>

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
          <Sidebar userName={userName} />
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

export default function DashboardLayoutClient({ userId, userName, children }: DashboardLayoutClientProps) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-gray-400">Loading dashboard...</div>}>
      <DashboardContent userId={userId} userName={userName}>
        {children}
      </DashboardContent>
    </Suspense>
  );
}