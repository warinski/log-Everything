'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookmarkCheck,
  Search,
  ExternalLink,
  Pencil,
  Trash2,
  Check,
  X,
  BarChart3,
  Undo2,
  Loader2,
} from 'lucide-react';
import { SavedAnalyticsView } from '@/lib/analytics/savedViews';
import {
  renameSavedView,
  deleteSavedView,
  restoreSavedView,
} from '@/lib/actions/savedViewActions';

const UNDO_TOAST_DURATION_MS = 6000;

interface SavedViewsManagerClientProps {
  userId: string;
  initialViews: SavedAnalyticsView[];
  categories: any[];
}

export default function SavedViewsManagerClient({
  userId,
  initialViews,
  categories,
}: SavedViewsManagerClientProps) {
  const router = useRouter();
  const [views, setViews] = useState<SavedAnalyticsView[]>(initialViews);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [deletedViewsStack, setDeletedViewsStack] = useState<SavedAnalyticsView[]>([]);
  const [toastSeq, setToastSeq] = useState(0);
  const [isUndoing, setIsUndoing] = useState(false);

  const latestDeletedViews =
    deletedViewsStack.length > 0
      ? deletedViewsStack[deletedViewsStack.length - 1]
      : null;

  useEffect(() => {
    if (!latestDeletedViews) {
      setIsUndoing(false);
      return;
    }
    setToastSeq((prev) => prev + 1);
    setIsUndoing(false);

    const timer = window.setTimeout(() => {
      setDeletedViewsStack([]);
    }, UNDO_TOAST_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [latestDeletedViews]);

  useEffect(() => {
    if (selectedIds.length === 0) {
      setConfirmingBulkDelete(false);
    }
  }, [selectedIds.length]);

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories || []) {
      if (cat?._id && cat?.name) {
        map.set(String(cat._id), String(cat.name));
      }
    }
    return map;
  }, [categories]);

  const filteredViews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return views;
    return views.filter((v) => {
      const catNames = (v.selectedCategories || [])
        .map((id) => categoryNameMap.get(id) || id)
        .join(' ')
        .toLowerCase();
      return (
        v.name.toLowerCase().includes(q) ||
        (v.searchQuery || '').toLowerCase().includes(q) ||
        catNames.includes(q) ||
        (v.timelineGranularity || '').toLowerCase().includes(q)
      );
    });
  }, [views, searchQuery, categoryNameMap]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allFilteredSelected =
    filteredViews.length > 0 &&
    filteredViews.every((v) => selectedSet.has(v.id));

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredIdSet = new Set(filteredViews.map((v) => v.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...filteredViews.map((v) => v.id)]);
      setSelectedIds(Array.from(merged));
    }
  };

  const startRename = (view: SavedAnalyticsView) => {
    setConfirmingDeleteId(null);
    setConfirmingBulkDelete(false);
    setEditingId(view.id);
    setEditingName(view.name);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingName('');
  };

  const commitRename = async (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    setBusyId(id);
    try {
      const updated = await renameSavedView(id, userId, trimmed);
      setViews((prev) => prev.map((v) => (v.id === id ? updated : v)));
      setEditingId(null);
      setEditingName('');
    } finally {
      setBusyId(null);
    }
  };

  const handleSingleDelete = async (id: string) => {
    const targetView = views.find((v) => v.id === id) ?? null;
    setConfirmingDeleteId(null);
    setBusyId(id);
    try {
      await deleteSavedView(id, userId);
      setViews((prev) => prev.filter((v) => v.id !== id));
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      if (targetView) {
        setDeletedViewsStack([targetView]);
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const targets = views.filter((v) => selectedSet.has(v.id));
    setConfirmingBulkDelete(false);
    setIsBulkDeleting(true);
    try {
      await Promise.all(selectedIds.map((id) => deleteSavedView(id, userId)));
      setViews((prev) => prev.filter((v) => !selectedSet.has(v.id)));
      setSelectedIds([]);
      if (targets.length > 0) {
        setDeletedViewsStack(targets);
      }
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleUndoDelete = async () => {
    if (deletedViewsStack.length === 0 || isUndoing) return;
    const toRestoreList = [...deletedViewsStack];
    setIsUndoing(true);
    try {
      const restoredViews = await Promise.all(
        toRestoreList.map((item) => {
          const { id: _oldId, createdAt: _oldCreatedAt, ...payload } = item;
          return restoreSavedView(userId, payload);
        })
      );
      setViews((prev) => {
        const existingIds = new Set(prev.map((v) => v.id));
        const uniqueRestored = restoredViews.filter((rv) => !existingIds.has(rv.id));
        return [...uniqueRestored, ...prev];
      });
      setDeletedViewsStack([]);
    } catch (error) {
      console.error('Failed to restore saved view(s):', error);
    } finally {
      setIsUndoing(false);
    }
  };

  const handleLaunchView = (viewId: string) => {
    router.push(`/dashboard/analytics?view=${encodeURIComponent(viewId)}`);
  };

  const describeScope = (view: SavedAnalyticsView) => {
    const parts: string[] = [];
    const catIds = view.selectedCategories || [];
    if (catIds.length > 0) {
      const names = catIds.map((id) => categoryNameMap.get(id) || 'Category');
      parts.push(names.join(', '));
    } else {
      parts.push('All categories');
    }
    if (view.searchQuery?.trim()) {
      parts.push(`"${view.searchQuery.trim()}"`);
    }
    if (view.dateFrom || view.dateTo) {
      parts.push(`${view.dateFrom || 'Any'} → ${view.dateTo || 'Now'}`);
    }
    if (view.timelineGranularity) {
      parts.push(`${view.timelineGranularity} trend`);
    }
    return parts.join(' · ');
  };

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-2.5 sm:space-y-3.5 px-2 sm:px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookmarkCheck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
            <h1 className="text-sm sm:text-xl font-bold tracking-tight text-gray-900">
              Saved Views
            </h1>
          </div>

          <Link
            href="/dashboard/analytics"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-2xs shrink-0"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Open Analytics</span>
          </Link>
        </div>

        {/* Search & Bulk Actions Toolbar */}
        <div className="bg-white border border-blue-100 rounded-2xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved views by name, category, filter, or granularity..."
              style={{ fontSize: '15px' }}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:border-blue-400"
            />
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {confirmingBulkDelete ? (
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/90 px-2.5 py-1 text-xs">
                  <span className="font-semibold text-red-700">
                    Delete {selectedIds.length} view{selectedIds.length > 1 ? 's' : ''}?
                  </span>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={isBulkDeleting}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Yes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingBulkDelete(false)}
                    disabled={isBulkDeleting}
                    aria-label="Cancel bulk delete"
                    className="p-1 rounded-lg bg-white text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-xs font-semibold text-gray-600">
                    {selectedIds.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmingBulkDelete(true)}
                    disabled={isBulkDeleting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isBulkDeleting ? 'Deleting...' : 'Delete Selected'}</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Views Table / List (Horizontally Scrollable on Mobile) */}
        {filteredViews.length === 0 ? (
          <div className="bg-white border border-blue-100 rounded-2xl p-10 text-center space-y-2 shadow-2xs">
            <p className="text-sm font-semibold text-gray-800">
              {views.length === 0
                ? 'No saved views yet.'
                : 'No saved views match your search.'}
            </p>
            <p className="text-xs text-gray-500">
              {views.length === 0
                ? 'Configure filters, sorting, or chart settings in Insights & Analytics and save a view to access it here.'
                : 'Try clearing or adjusting your search query.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-blue-100 rounded-2xl shadow-2xs overflow-x-auto">
            <table className="w-full min-w-[540px] sm:min-w-0 text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-blue-50/40 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-3 sm:px-4 w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      aria-label="Select all visible saved views"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3 sm:px-4 min-w-[150px] sm:min-w-[180px] whitespace-nowrap">
                    View Name
                  </th>
                  <th className="py-3 px-3 sm:px-4 min-w-[260px] sm:min-w-[300px] whitespace-nowrap">
                    Filters & Chart Config
                  </th>
                  <th className="py-3 px-3 sm:px-4 text-right whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                {filteredViews.map((view) => {
                  const isEditing = editingId === view.id;
                  const isBusy = busyId === view.id;
                  const isConfirmingDelete = confirmingDeleteId === view.id;

                  return (
                    <tr
                      key={view.id}
                      className="hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="py-3 px-3 sm:px-4 align-middle">
                        <input
                          type="checkbox"
                          checked={selectedSet.has(view.id)}
                          onChange={() => toggleSelectOne(view.id)}
                          aria-label={`Select ${view.name}`}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 sm:px-4 align-middle font-semibold text-gray-900 min-w-[150px] sm:min-w-[180px]">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitRename(view.id);
                                if (e.key === 'Escape') cancelRename();
                              }}
                              autoFocus
                              className="px-2.5 py-1 rounded-lg border border-blue-300 text-xs text-gray-900 focus:outline-none w-36"
                            />
                            <button
                              type="button"
                              onClick={() => commitRename(view.id)}
                              disabled={isBusy}
                              aria-label="Save view name"
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer shrink-0"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelRename}
                              aria-label="Cancel renaming"
                              className="p-1 text-gray-400 hover:bg-gray-100 rounded-md cursor-pointer shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="whitespace-nowrap">{view.name}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 sm:px-4 align-middle text-xs text-gray-600 min-w-[260px] sm:min-w-[300px]">
                        {describeScope(view)}
                      </td>
                      <td className="py-3 px-3 sm:px-4 align-middle whitespace-nowrap">
                        {isConfirmingDelete ? (
                          <div className="inline-flex items-center justify-end gap-1 rounded-lg border border-red-200 bg-red-50/90 px-2 py-1 text-xs">
                            <span className="text-[11px] font-semibold text-red-700 whitespace-nowrap">
                              Delete?
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSingleDelete(view.id)}
                              disabled={isBusy}
                              aria-label={`Confirm delete ${view.name}`}
                              className="h-5.5 px-1.5 rounded-md bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-[11px] font-semibold cursor-pointer inline-flex items-center gap-0.5"
                            >
                              <Check className="w-3 h-3" />
                              <span>Yes</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteId(null)}
                              disabled={isBusy}
                              aria-label={`Cancel delete ${view.name}`}
                              className="h-5.5 px-1.5 rounded-md bg-white text-gray-600 border border-gray-200 hover:bg-gray-100 cursor-pointer inline-flex items-center"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleLaunchView(view.id)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                              <span>Launch</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => startRename(view)}
                              disabled={isBusy}
                              aria-label={`Rename ${view.name}`}
                              title={`Rename "${view.name}"`}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setConfirmingDeleteId(view.id);
                              }}
                              disabled={isBusy}
                              aria-label={`Delete ${view.name}`}
                              title={`Delete "${view.name}"`}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Undo Toast with Perimeter Timer Trace */}
      {latestDeletedViews && (
        <div
          key={toastSeq}
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 max-w-sm w-[calc(100vw-2rem)] sm:w-auto bg-gray-900 text-white rounded-xl px-3.5 py-2.5 shadow-lg flex items-center justify-between gap-3"
        >
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          >
            <rect
              x="0.75"
              y="0.75"
              width="calc(100% - 1.5px)"
              height="calc(100% - 1.5px)"
              rx="12"
              ry="12"
              pathLength={100}
              fill="none"
              stroke="rgba(148, 163, 184, 0.25)"
              strokeWidth="1.5"
            />
            <rect
              x="0.75"
              y="0.75"
              width="calc(100% - 1.5px)"
              height="calc(100% - 1.5px)"
              rx="12"
              ry="12"
              pathLength={100}
              fill="none"
              stroke="#60A5FA"
              strokeWidth="1.5"
              strokeLinecap="round"
              className={`manager-toast-perimeter ${
                isUndoing ? 'manager-toast-perimeter--paused' : ''
              }`}
            />
          </svg>

          <span className="relative text-xs font-medium truncate">
            {deletedViewsStack.length === 1 ? (
              <>
                Deleted view “
                <strong className="font-semibold">
                  {deletedViewsStack[0].name}
                </strong>
                ”
              </>
            ) : (
              <>
                Deleted{' '}
                <strong className="font-semibold">
                  {deletedViewsStack.length}
                </strong>{' '}
                saved views
              </>
            )}
          </span>

          <div className="relative flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={isUndoing}
              onClick={handleUndoDelete}
              className="h-6.5 px-2.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 disabled:opacity-60"
            >
              {isUndoing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Undo2 className="w-3.5 h-3.5" />
              )}
              <span>{isUndoing ? 'Undoing...' : 'Undo'}</span>
            </button>
            <button
              type="button"
              disabled={isUndoing}
              onClick={() => setDeletedViewsStack([])}
              aria-label="Dismiss notification"
              className="p-1 text-gray-400 hover:text-white rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}