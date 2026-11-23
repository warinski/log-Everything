'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import FilterBar from '@/components/FilterBar';
import LogCard, { LogItem } from '@/components/LogCard';
import LogModal, { CategoryTemplate } from '@/components/LogModal';
import { useUndoToast } from '@/components/UndoToastProvider';
import { getFilteredLogs, deleteLog, createLog, updateLog } from '@/lib/actions/logActions';
import { getUserCategories, createCategory } from '@/lib/actions/categoryActions';

interface DashboardClientProps {
  userId: string;
  userName?: string | null;
  initialLogs?: LogItem[];
  initialCategories?: CategoryTemplate[];
}

export default function DashboardClient({
  userId,
  initialLogs = [],
  initialCategories = [],
}: DashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showUndoToast } = useUndoToast();
  const urlSearchQuery = searchParams.get('search') || '';

  const [categories, setCategories] = useState<CategoryTemplate[]>(initialCategories);
  const [logs, setLogs] = useState<LogItem[]>(initialLogs);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<LogItem | null>(null);

  const activeSearch = debouncedSearchQuery || urlSearchQuery;
  const requestSeqRef = useRef(0);
  const hasInitializedRef = useRef(false);

  const filtersRef = useRef({
    selectedCategory: '',
    selectedTags: [] as string[],
    activeSearch: '',
  });

  filtersRef.current = {
    selectedCategory,
    selectedTags,
    activeSearch,
  };

  // Debounce search input by 250ms before querying the backend
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadCategories = useCallback(async () => {
    try {
      const fetchedCats = await getUserCategories(userId);
      setCategories(fetchedCats || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, [userId]);

  const filterLogsAgainstState = useCallback(
    (items: any[], cat: string, tags: string[], search: string) => {
      const normalizedCat = cat.trim();
      const q = search.trim().toLowerCase();

      return (items || []).filter((log: any) => {
        if (normalizedCat) {
          const rawLogCatId =
            typeof log.categoryId === 'string'
              ? log.categoryId
              : log.categoryId?._id || log.categoryId?.toString() || '';
          if (String(rawLogCatId).trim() !== normalizedCat) {
            return false;
          }
        }

        if (tags.length > 0) {
          const logTags = Array.isArray(log.tags) ? log.tags : [];
          if (!tags.every((t) => logTags.includes(t))) {
            return false;
          }
        }

        if (q) {
          const inTitle = typeof log.title === 'string' && log.title.toLowerCase().includes(q);
          const inNotes = typeof log.notes === 'string' && log.notes.toLowerCase().includes(q);
          const inCatName =
            typeof log.categoryName === 'string' && log.categoryName.toLowerCase().includes(q);
          const inTags =
            Array.isArray(log.tags) &&
            log.tags.some((t: unknown) => String(t).toLowerCase().includes(q));
          const inAttrs =
            log.attributes &&
            typeof log.attributes === 'object' &&
            Object.entries(log.attributes).some(
              ([k, v]) =>
                k.replace(/_/g, ' ').toLowerCase().includes(q) ||
                (v !== undefined && v !== null && String(v).toLowerCase().includes(q))
            );

          if (!inTitle && !inNotes && !inCatName && !inTags && !inAttrs) {
            return false;
          }
        }

        return true;
      });
    },
    []
  );

  // Refresh only filtered logs while preserving active filter and search states
  const refreshLogs = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    const { selectedCategory: cat, selectedTags: tags, activeSearch: search } = filtersRef.current;

    try {
      const filteredLogs = await getFilteredLogs({
        userId,
        categoryId: cat || undefined,
        tags: tags.length > 0 ? tags : undefined,
        searchQuery: search.trim() || undefined,
      });

      if (seq !== requestSeqRef.current) return;

      const strictlyFiltered = filterLogsAgainstState(filteredLogs || [], cat, tags, search);
      setLogs(strictlyFiltered);
    } catch (error) {
      if (seq !== requestSeqRef.current) return;
      console.error('Failed to refresh logs:', error);
    } finally {
      if (seq === requestSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, [userId, filterLogsAgainstState]);

  const loadData = useCallback(
    async (showSpinner = true) => {
      const seq = ++requestSeqRef.current;
      const { selectedCategory: cat, selectedTags: tags, activeSearch: search } = filtersRef.current;

      try {
        if (showSpinner) setIsLoading(true);
        const [fetchedCats, fetchedLogs] = await Promise.all([
          getUserCategories(userId),
          getFilteredLogs({
            userId,
            categoryId: cat || undefined,
            tags: tags.length > 0 ? tags : undefined,
            searchQuery: search.trim() || undefined,
          }),
        ]);

        if (seq !== requestSeqRef.current) return;

        setCategories(fetchedCats || []);
        setLogs(filterLogsAgainstState(fetchedLogs || [], cat, tags, search));
      } catch (error) {
        if (seq !== requestSeqRef.current) return;
        console.error('Failed to load dashboard data:', error);
      } finally {
        if (showSpinner) {
          setIsLoading(false);
        }
      }
    },
    [userId, filterLogsAgainstState]
  );

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  useEffect(() => {
    if (!hasInitializedRef.current && initialLogs.length > 0) {
      setLogs(initialLogs);
    }
  }, [initialLogs]);

  // Initial load + global window events
  useEffect(() => {
    hasInitializedRef.current = true;
    loadData(true);

    const handleLogRefresh = () => {
      refreshLogs();
    };

    const handleCategoryRefresh = () => {
      loadCategories();
      refreshLogs();
    };

    const handleEditLogEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setEditingLog(customEvent.detail);
      }
    };

    window.addEventListener('logCreated', handleLogRefresh);
    window.addEventListener('categoryCreated', handleCategoryRefresh);
    window.addEventListener('editLog', handleEditLogEvent as EventListener);

    return () => {
      window.removeEventListener('logCreated', handleLogRefresh);
      window.removeEventListener('categoryCreated', handleCategoryRefresh);
      window.removeEventListener('editLog', handleEditLogEvent as EventListener);
    };
  }, [loadData, loadCategories, refreshLogs]);

  // Re-query filtered logs whenever category, tags, or search changes
  useEffect(() => {
    if (!hasInitializedRef.current) return;
    refreshLogs();
  }, [selectedCategory, selectedTags, activeSearch, refreshLogs]);

  const handleSaveLog = async (payload: any, isEditing: boolean, logId?: string) => {
    if (isEditing && logId) {
      await updateLog(logId, userId, payload);
    } else {
      await createLog({ ...payload, userId });
    }
    router.refresh();
    await refreshLogs();
  };

  const handleCreateCategory = async (catData: any): Promise<any> => {
    const result: any = await createCategory(catData);

    if (result && result.categoryId) {
      const newCatObj: CategoryTemplate = {
        _id: result.categoryId,
        name: catData.name,
        icon: catData.icon || '📁',
        color: catData.color || '#3B82F6',
        fields: catData.fields || [],
      };
      setCategories((prev) => {
        if (prev.some((c) => c._id === result.categoryId)) return prev;
        return [...prev, newCatObj].sort((a, b) => a.name.localeCompare(b.name));
      });
    }

    window.dispatchEvent(new CustomEvent('categoryCreated'));
    router.refresh();
    await loadCategories();
    await refreshLogs();
    return result;
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
    setDebouncedSearchQuery('');

    if (urlSearchQuery) {
      window.history.pushState({}, '', '/dashboard');
    }
    refreshLogs();
  };

  const handleDeleteLog = async (id: string) => {
    const deletedSnapshot = logs.find((log) => log._id === id);

    try {
      await deleteLog(id, userId);
      setLogs((prev) => prev.filter((log) => log._id !== id));

      if (deletedSnapshot) {
        showUndoToast({
          message: `Deleted "${deletedSnapshot.title || 'log'}"`,
          onUndo: async () => {
            const restored = await createLog({
              userId,
              categoryId: deletedSnapshot.categoryId,
              categoryName: deletedSnapshot.categoryName,
              categoryIcon: deletedSnapshot.categoryIcon,
              categoryColor: deletedSnapshot.categoryColor,
              title: deletedSnapshot.title,
              notes: deletedSnapshot.notes,
              tags: deletedSnapshot.tags,
              attributes: deletedSnapshot.attributes,
              timestamp: deletedSnapshot.timestamp
                ? new Date(deletedSnapshot.timestamp)
                : undefined,
            });
            setLogs((prev) => [restored, ...prev]);
            router.refresh();
          },
        });
      }
    } catch (error) {
      console.error('Failed to delete log:', error);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 flex flex-col h-[calc(100vh-5rem)] sm:h-[calc(100vh-7rem)] px-2 sm:px-4">
      <div className="shrink-0 space-y-3 sm:space-y-4">
        <div>
          <h1 className="text-sm sm:text-xl font-bold tracking-tight text-gray-900">Activity Timeline</h1>
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

      <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 space-y-3 sm:space-y-4 min-h-0 [-webkit-overflow-scrolling:touch]">
        {isLoading ? (
          <div className="bg-white border border-blue-100 rounded-2xl p-12 text-center text-sm text-gray-400 shadow-2xs">
            Loading logs from database...
          </div>
        ) : logs.length > 0 ? (
          <div className="space-y-3 sm:space-y-4 pb-6">
            {logs
              .slice()
              .sort((a: any, b: any) => {
                const dateA = new Date(a.timestamp || a.loggedAt || a.createdAt).getTime();
                const dateB = new Date(b.timestamp || b.loggedAt || b.createdAt).getTime();
                return dateB - dateA;
              })
              .map((log) => (
                <LogCard
                  key={log._id}
                  log={log}
                  userId={userId}
                  onEdit={(item) => setEditingLog(item)}
                  onDelete={handleDeleteLog}
                  onTagClick={addTagFilter}
                  onSuccess={refreshLogs}
                />
              ))}
          </div>
        ) : (
          <div className="bg-white border border-blue-100 rounded-2xl p-12 text-center space-y-3 shadow-2xs">
            <p className="text-sm text-gray-500">No log entries found matching your criteria.</p>
            <button onClick={clearAllFilters} className="text-xs font-semibold text-blue-600 hover:underline">
              Clear filters
            </button>
          </div>
        )}
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
        onCategoriesRefresh={loadCategories}
        onSuccess={() => refreshLogs()}
      />
    </div>
  );
}