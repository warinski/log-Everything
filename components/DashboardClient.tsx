'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp } from 'lucide-react';
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

const LOGS_PER_PAGE = 10;

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const refreshDateAttributes = (
  sourceLog: LogItem,
  allCategories: CategoryTemplate[]
): Record<string, any> => {
  const attrs = sourceLog.attributes ? { ...sourceLog.attributes } : {};
  const matchingCategory = allCategories.find((c) => c._id === sourceLog.categoryId);
  const categoryFields: any[] = matchingCategory?.fields || [];

  const dateFieldKeys = new Set<string>();
  categoryFields.forEach((field) => {
    const fieldType = field.fieldType || field.type;
    if (fieldType === 'date') {
      if (field.name) dateFieldKeys.add(field.name);
      if (field.label) {
        dateFieldKeys.add(field.label.trim().toLowerCase().replace(/\s+/g, '_'));
      }
    }
  });

  const todayStr = getLocalDateString();

  Object.keys(attrs).forEach((key) => {
    const val = attrs[key];
    const isDateField =
      dateFieldKeys.has(key) ||
      (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim()));

    if (isDateField) {
      attrs[key] = todayStr;
    }
  });

  return attrs;
};

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
  const [currentPage, setCurrentPage] = useState(1);
  // Cards default to collapsed unless present & true in expandedLogIds
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<LogItem | null>(null);

  const activeSearch = debouncedSearchQuery || urlSearchQuery;
  const hasActiveFilterOrSearch = Boolean(
    selectedCategory.trim() || selectedTags.length > 0 || activeSearch.trim()
  );

  const requestSeqRef = useRef(0);
  const hasInitializedRef = useRef(false);
  const prevFilterActiveRef = useRef(false);

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
    setCurrentPage(1);
    refreshLogs();
  }, [selectedCategory, selectedTags, activeSearch, refreshLogs]);

  const sortedLogs = useMemo(() => {
    return logs.slice().sort((a: any, b: any) => {
      const dateA = new Date(a.timestamp || a.loggedAt || a.createdAt).getTime();
      const dateB = new Date(b.timestamp || b.loggedAt || b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [logs]);

  const totalPages = Math.max(1, Math.ceil(sortedLogs.length / LOGS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * LOGS_PER_PAGE;
    return sortedLogs.slice(startIndex, startIndex + LOGS_PER_PAGE);
  }, [sortedLogs, currentPage]);

  // Automatically expand matching logs when entering filtered/searched view;
  // return to collapsed default when filters/search are cleared.
  useEffect(() => {
    const wasActive = prevFilterActiveRef.current;
    prevFilterActiveRef.current = hasActiveFilterOrSearch;

    if (hasActiveFilterOrSearch) {
      if (logs.length > 0) {
        setExpandedLogIds((prev) => {
          const next = { ...prev };
          logs.forEach((log) => {
            next[log._id] = true;
          });
          return next;
        });
      }
    } else if (wasActive) {
      setExpandedLogIds({});
    }
  }, [hasActiveFilterOrSearch, logs]);

  const areAllCurrentPageExpanded = useMemo(() => {
    if (paginatedLogs.length === 0) return false;
    return paginatedLogs.every((log) => Boolean(expandedLogIds[log._id]));
  }, [paginatedLogs, expandedLogIds]);

  const handleToggleCardCollapse = useCallback((logId: string) => {
    setExpandedLogIds((prev) => ({
      ...prev,
      [logId]: !prev[logId],
    }));
  }, []);

  const handleToggleAllCurrentPage = useCallback(() => {
    setExpandedLogIds((prev) => {
      const next = { ...prev };
      const shouldCollapseAll = paginatedLogs.every((log) => Boolean(prev[log._id]));
      paginatedLogs.forEach((log) => {
        if (shouldCollapseAll) {
          delete next[log._id];
        } else {
          next[log._id] = true;
        }
      });
      return next;
    });
  }, [paginatedLogs]);

  const startEntry = sortedLogs.length === 0 ? 0 : (currentPage - 1) * LOGS_PER_PAGE + 1;
  const endEntry = Math.min(currentPage * LOGS_PER_PAGE, sortedLogs.length);

  const handleSaveLog = async (payload: any, isEditing: boolean, logId?: string) => {
    if (isEditing && logId) {
      await updateLog(logId, userId, payload);
    } else {
      await createLog({ ...payload, userId });
    }
    router.refresh();
    await refreshLogs();
  };

  const handleLogAgain = async (sourceLog: LogItem) => {
    const now = new Date();
    const newLogPayload = {
      userId,
      categoryId: sourceLog.categoryId,
      categoryName: sourceLog.categoryName,
      categoryIcon: sourceLog.categoryIcon,
      categoryColor: sourceLog.categoryColor,
      title: sourceLog.title,
      notes: sourceLog.notes || '',
      tags: Array.isArray(sourceLog.tags) ? [...sourceLog.tags] : [],
      attributes: refreshDateAttributes(sourceLog, categories),
      timestamp: now,
    };

    await createLog(newLogPayload);
    window.dispatchEvent(new CustomEvent('logCreated'));
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
    setCurrentPage(1);

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
    <div className="max-w-5xl mx-auto space-y-2.5 sm:space-y-3.5 flex flex-col h-[calc(100vh-5rem)] sm:h-[calc(100vh-7rem)] px-2 sm:px-4">
      <div className="shrink-0 space-y-2">
        <div>
          <h1 className="text-sm sm:text-xl font-bold tracking-tight text-gray-900">
            Logs Dashboard
          </h1>
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
      </div>

      <div className="flex-1 min-h-0 bg-white border border-blue-100 rounded-2xl shadow-2xs overflow-hidden flex flex-col">
        {!isLoading && sortedLogs.length > 0 && (
          <div className="shrink-0 px-3 py-2 border-b border-blue-100 bg-white flex items-center justify-between gap-2">
            <p className="text-xs text-gray-600 min-w-0">
              <strong className="font-semibold text-gray-900">{startEntry}</strong> to{' '}
              <strong className="font-semibold text-gray-900">{endEntry}</strong> of{' '}
              <strong className="font-semibold text-gray-900">{sortedLogs.length}</strong>{' '}
              <span className="text-gray-500">
                (<strong className="font-semibold text-gray-900">{currentPage}</strong> of{' '}
                <strong className="font-semibold text-gray-900">{totalPages}</strong>)
              </span>
            </p>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleToggleAllCurrentPage}
                className="w-7 h-7 rounded-lg border border-blue-100 bg-blue-50/50 hover:bg-blue-100/70 text-blue-700 transition-colors cursor-pointer inline-flex items-center justify-center"
                title={
                  areAllCurrentPageExpanded
                    ? 'Collapse all logs on this page'
                    : 'Expand all logs on this page'
                }
                aria-label={
                  areAllCurrentPageExpanded
                    ? 'Collapse all logs on this page'
                    : 'Expand all logs on this page'
                }
              >
                {areAllCurrentPageExpanded ? (
                  <ChevronsUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronsDown className="w-3.5 h-3.5" />
                )}
              </button>

              {sortedLogs.length > LOGS_PER_PAGE && (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                    className="w-7 h-7 rounded-lg border border-blue-100 bg-white text-gray-700 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                    className="w-7 h-7 rounded-lg border border-blue-100 bg-white text-gray-700 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2 min-h-0 [-webkit-overflow-scrolling:touch]">
          {isLoading ? (
            <div className="py-12 text-center text-xs sm:text-sm text-gray-400">
              Loading logs from database...
            </div>
          ) : paginatedLogs.length > 0 ? (
            <div className="space-y-2 pb-1">
              {paginatedLogs.map((log) => (
                <LogCard
                  key={log._id}
                  log={log}
                  userId={userId}
                  isCollapsed={!Boolean(expandedLogIds[log._id])}
                  onToggleCollapse={() => handleToggleCardCollapse(log._id)}
                  onEdit={(item) => setEditingLog(item)}
                  onDelete={handleDeleteLog}
                  onTagClick={addTagFilter}
                  onLogAgain={handleLogAgain}
                  onSuccess={refreshLogs}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center space-y-2">
              <p className="text-xs sm:text-sm text-gray-500">
                No log entries found matching your criteria.
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
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