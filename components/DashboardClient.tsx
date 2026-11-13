'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import FilterBar from '@/components/FilterBar';
import LogCard, { LogItem } from '@/components/LogCard';
import LogModal from '@/components/LogModal';
import { getFilteredLogs, deleteLog, createLog, updateLog } from '@/lib/actions/logActions';
import { getUserCategories, createCategory } from '@/lib/actions/categoryActions';

interface DashboardClientProps {
  userId: string;
  userName?: string | null;
}

export default function DashboardClient({ userId }: DashboardClientProps) {
  const searchParams = useSearchParams();
  const urlSearchQuery = searchParams.get('search') || '';

  const [categories, setCategories] = useState<any[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Edit and Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<LogItem | null>(null);

  const activeSearch = searchQuery || urlSearchQuery;

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [fetchedCats, fetchedLogs] = await Promise.all([
        getUserCategories(userId),
        getFilteredLogs({
          userId,
          categoryId: selectedCategory || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          searchQuery: activeSearch.trim() || undefined,
        }),
      ]);
      
      setCategories(fetchedCats);
      setLogs(fetchedLogs);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, selectedTags, activeSearch, userId]);

  useEffect(() => {
    loadData();

    const handleDataRefresh = () => {
      loadData();
    };

    const handleEditLogEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setEditingLog(customEvent.detail);
      }
    };

    window.addEventListener('logCreated', handleDataRefresh);
    window.addEventListener('categoryCreated', handleDataRefresh);
    window.addEventListener('editLog', handleEditLogEvent as EventListener);

    return () => {
      window.removeEventListener('logCreated', handleDataRefresh);
      window.removeEventListener('categoryCreated', handleDataRefresh);
      window.removeEventListener('editLog', handleEditLogEvent as EventListener);
    };
  }, [loadData]);

  const handleSaveLog = async (payload: any, isEditing: boolean, logId?: string) => {
    if (isEditing && logId) {
      await updateLog(logId, userId, payload);
    } else {
      await createLog({ ...payload, userId });
    }
    loadData();
  };

  const handleCreateCategory = async (catData: any) => {
    await createCategory(catData);
    loadData();
  };

  const addTagFilter = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const removeTagFilter = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tagToRemove));
  };

  const clearAllFilters = () => {
    setSelectedCategory('');
    setSelectedTags([]);
    setSearchQuery('');
    
    if (urlSearchQuery) {
      window.history.pushState({}, '', '/dashboard');
      loadData();
    }
  };

  const handleDeleteLog = async (id: string) => {
    try {
      await deleteLog(id, userId);
      setLogs(logs.filter((log) => log._id !== id));
    } catch (error) {
      console.error('Failed to delete log:', error);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 flex flex-col h-[calc(100vh-6rem)]">
      <div className="shrink-0 space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Activity Timeline</h1>
          <p className="text-sm text-gray-500 mt-1">Browse and manage your dynamic logs from MongoDB Atlas.</p>
        </div>

        <FilterBar
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedTags={selectedTags}
          removeTag={removeTagFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onClearAll={clearAllFilters}
        />

        <div className="flex items-center justify-between text-xs text-gray-500 font-medium px-1">
          <span>Showing {logs.length} entries</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-4 min-h-0">
        {isLoading ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">Loading logs from database...</div>
        ) : logs.length > 0 ? (
          <div className="space-y-4 pb-6">
            {logs.map((log) => (
              <LogCard 
                key={log._id} 
                log={log} 
                onEdit={(item) => setEditingLog(item)} 
                onDelete={handleDeleteLog} 
                onTagClick={addTagFilter} 
              />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center space-y-3">
            <p className="text-sm text-gray-500">No log entries found matching your criteria.</p>
            <button onClick={clearAllFilters} className="text-xs font-semibold text-blue-600 hover:underline">
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Log Modal for both Creating and Editing */}
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
        onSuccess={loadData}
      />
    </div>
  );
}