'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  Plus,
  Trash2,
  Check,
  X,
  Save,
  Pencil,
  Undo2,
  Loader2,
  ChevronDown,
  Search,
  ExternalLink,
} from 'lucide-react';
import { SavedAnalyticsView } from '@/lib/analytics/savedViews';

const UNDO_TOAST_DURATION_MS = 6000;
const MOBILE_MAX_PILLS = 2;
const DESKTOP_MAX_PILLS = 4;

interface SavedViewsBarProps {
  views: SavedAnalyticsView[];
  activeViewId: string | null;
  lastAppliedViewId?: string | null;
  deletedView?: SavedAnalyticsView | null;
  manageHref?: string;
  onApplyView: (view: SavedAnalyticsView) => void;
  onSaveCurrentView: (name: string) => void;
  onUpdateView?: (id: string) => void;
  onRenameView?: (id: string, newName: string) => void;
  onDeleteView: (id: string) => void;
  onUndoDelete?: () => Promise<void> | void;
  onDismissUndoToast?: () => void;
}

export default function SavedViewsBar({
  views,
  activeViewId,
  lastAppliedViewId,
  deletedView = null,
  manageHref = '/dashboard/saved-views',
  onApplyView,
  onSaveCurrentView,
  onUpdateView,
  onRenameView,
  onDeleteView,
  onUndoDelete,
  onDismissUndoToast,
}: SavedViewsBarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [viewName, setViewName] = useState('');

  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [toastSeq, setToastSeq] = useState(0);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!deletedView) {
      setIsUndoing(false);
      return;
    }
    setToastSeq((prev) => prev + 1);
    setIsUndoing(false);

    if (!onDismissUndoToast) return;
    const timer = window.setTimeout(() => {
      onDismissUndoToast();
    }, UNDO_TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [deletedView, onDismissUndoToast]);

  useEffect(() => {
    if (!isPickerOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsPickerOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isPickerOpen]);

  const lastAppliedView =
    lastAppliedViewId && activeViewId !== lastAppliedViewId
      ? views.find((v) => v.id === lastAppliedViewId) ?? null
      : null;

  const desktopPillViews = useMemo(() => {
    const base = views.slice(0, DESKTOP_MAX_PILLS);
    if (!activeViewId) return base;
    const activeAlreadyShown = base.some((v) => v.id === activeViewId);
    if (activeAlreadyShown) return base;
    const activeView = views.find((v) => v.id === activeViewId);
    if (!activeView) return base;
    return [activeView, ...base.slice(0, Math.max(0, DESKTOP_MAX_PILLS - 1))];
  }, [views, activeViewId]);

  const overflowCount = Math.max(0, views.length - desktopPillViews.length);

  const filteredPickerViews = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return views;
    return views.filter((v) => {
      const cats = (v.selectedCategories || []).join(' ').toLowerCase();
      return (
        v.name.toLowerCase().includes(q) ||
        (v.searchQuery || '').toLowerCase().includes(q) ||
        cats.includes(q)
      );
    });
  }, [views, pickerSearch]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = viewName.trim();
    if (!trimmed) return;
    onSaveCurrentView(trimmed);
    setViewName('');
    setIsCreating(false);
  };

  const startEditing = (view: SavedAnalyticsView) => {
    setIsPickerOpen(false);
    setConfirmingDeleteId(null);
    setEditingViewId(view.id);
    setEditingName(view.name);
  };

  const cancelEditing = () => {
    setEditingViewId(null);
    setEditingName('');
  };

  const commitEditing = (id: string) => {
    const trimmed = editingName.trim();
    if (trimmed && onRenameView) {
      onRenameView(id, trimmed);
    }
    setEditingViewId(null);
    setEditingName('');
  };

  const handleConfirmDelete = (id: string) => {
    setConfirmingDeleteId(null);
    onDeleteView(id);
  };

  const handleUndoClick = async () => {
    if (!onUndoDelete || isUndoing) return;
    try {
      setIsUndoing(true);
      await onUndoDelete();
    } finally {
      setIsUndoing(false);
    }
  };

  const handleMobileSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if (!selectedId) return;
    const found = views.find((v) => v.id === selectedId);
    if (found) {
      onApplyView(found);
    }
  };

  const renderPill = (
    view: SavedAnalyticsView,
    options?: { isEqualHalfMobile?: boolean; maxLabelWidthClass?: string }
  ) => {
    const isActive = activeViewId === view.id;
    const isEditing = editingViewId === view.id;
    const isConfirmingDelete = confirmingDeleteId === view.id;
    const isEqualHalf = Boolean(options?.isEqualHalfMobile);
    const maxLabelWidthClass = options?.maxLabelWidthClass ?? 'max-w-[160px]';

    if (isEditing) {
      return (
        <div
          key={view.id}
          className={`inline-flex items-center gap-1 rounded-xl border border-blue-300 bg-white px-1.5 py-1 shadow-2xs min-w-0 ${
            isEqualHalf ? 'w-full' : ''
          }`}
        >
          <input
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitEditing(view.id);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEditing();
              }
            }}
            autoFocus
            aria-label={`Rename ${view.name}`}
            style={{ fontSize: '12px' }}
            className={`h-6 text-xs leading-tight bg-transparent px-1 text-gray-900 focus:outline-none min-w-0 ${
              isEqualHalf ? 'flex-1' : 'w-28'
            }`}
          />
          <button
            type="button"
            onClick={() => commitEditing(view.id)}
            aria-label="Confirm rename"
            title="Save name"
            className="h-6 w-6 rounded-md bg-blue-600 text-white hover:bg-blue-700 cursor-pointer flex items-center justify-center shrink-0"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={cancelEditing}
            aria-label="Cancel rename"
            title="Cancel"
            className="h-6 w-6 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer flex items-center justify-center shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    if (isConfirmingDelete) {
      return (
        <div
          key={view.id}
          className={`inline-flex items-center justify-between gap-1 rounded-xl border border-red-200 bg-red-50/80 px-2 py-1 text-xs shadow-2xs min-w-0 ${
            isEqualHalf ? 'w-full' : ''
          }`}
        >
          <span className="text-xs font-semibold text-red-700 truncate min-w-0">
            Delete “{view.name}”?
          </span>
          <div className="inline-flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleConfirmDelete(view.id)}
              aria-label={`Confirm delete ${view.name}`}
              title="Confirm delete"
              className="h-5.5 px-1.5 rounded-md bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700 cursor-pointer inline-flex items-center gap-0.5"
            >
              <Check className="w-3 h-3" />
              <span>Yes</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDeleteId(null)}
              aria-label="Cancel delete"
              title="Cancel delete"
              className="h-5.5 px-1.5 rounded-md bg-white text-gray-600 border border-gray-200 text-[11px] font-semibold hover:bg-gray-100 cursor-pointer inline-flex items-center"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={view.id}
        className={`group inline-flex items-center justify-between rounded-xl border font-semibold transition-colors min-w-0 ${
          isEqualHalf ? 'w-full py-0.5 text-xs' : 'max-w-full text-xs'
        } ${
          isActive
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-blue-50/60 text-blue-700 border-blue-100 hover:bg-blue-100/70'
        }`}
      >
        <button
          type="button"
          onClick={() => onApplyView(view)}
          className={`truncate cursor-pointer text-left min-w-0 ${
            isEqualHalf ? 'flex-1 px-2.5 py-1.5 text-xs' : `px-2.5 py-1 ${maxLabelWidthClass}`
          }`}
          title={`Apply "${view.name}"`}
        >
          {view.name}
        </button>

        <div className={`inline-flex items-center shrink-0 ${isEqualHalf ? 'pr-1.5 gap-0.5' : 'pr-1'}`}>
          {onRenameView && (
            <button
              type="button"
              onClick={() => startEditing(view)}
              aria-label={`Rename ${view.name}`}
              title={`Rename "${view.name}"`}
              className={`px-1 py-1 cursor-pointer transition-opacity ${
                isActive
                  ? 'text-blue-100 hover:text-white'
                  : 'text-blue-400 hover:text-blue-700'
              }`}
            >
              <Pencil className={isEqualHalf ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setConfirmingDeleteId(view.id)}
            aria-label={`Delete ${view.name}`}
            title={`Delete "${view.name}"`}
            className={`pl-0.5 pr-0.5 py-1 rounded-r-xl cursor-pointer transition-opacity ${
              isActive
                ? 'text-blue-100 hover:text-white'
                : 'text-blue-400 hover:text-red-500'
            }`}
          >
            <Trash2 className={isEqualHalf ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
          </button>
        </div>
      </div>
    );
  };

  const renderMobileHeaderRow = () => {
    const updateRightClass = manageHref ? 'right-[7.25rem]' : 'right-[5.25rem]';
    const createRightClass = manageHref ? 'right-7' : 'right-0';

    return (
      <div className="relative flex items-center justify-between gap-2 min-w-0 h-6.5">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
          <Bookmark className="w-3.5 h-3.5 text-blue-600" />
          <span>Saved Views</span>
        </span>

        {lastAppliedView && onUpdateView && !isCreating && (
          <button
            type="button"
            onClick={() => onUpdateView(lastAppliedView.id)}
            title={`Overwrite "${lastAppliedView.name}" with current filters, sort, and chart options`}
            aria-label={`Update ${lastAppliedView.name}`}
            className={`absolute left-0 ${updateRightClass} top-1/2 -translate-y-1/2 z-20 h-6.5 px-2 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-[11px] leading-none font-semibold hover:bg-blue-100 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs min-w-0`}
          >
            <Save className="w-3 h-3 shrink-0" />
            <span className="truncate">Update “{lastAppliedView.name}”</span>
          </button>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {isCreating ? (
            <form
              onSubmit={handleCreateSubmit}
              className={`absolute left-0 ${createRightClass} top-1/2 -translate-y-1/2 z-20 flex items-center gap-1 bg-white rounded-md`}
            >
              <input
                type="text"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="View name..."
                autoFocus
                style={{ fontSize: '11px' }}
                className="h-6.5 text-[11px] leading-tight bg-white border border-blue-300 rounded-md px-2 text-gray-800 focus:outline-none focus:border-blue-500 flex-1 min-w-0 shadow-2xs"
              />
              <button
                type="submit"
                aria-label="Confirm save view"
                className="h-6.5 px-1.5 rounded-md bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 cursor-pointer flex items-center shrink-0"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setViewName('');
                }}
                aria-label="Cancel save view"
                className="h-6.5 px-1.5 rounded-md bg-gray-100 text-gray-600 text-[11px] font-semibold hover:bg-gray-200 cursor-pointer flex items-center shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="h-6.5 px-2.5 rounded-md bg-blue-600 text-white text-[11px] leading-none font-semibold hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3 h-3" />
              <span>Save View</span>
            </button>
          )}

          {manageHref && (
            <Link
              href={manageHref}
              aria-label="Manage all saved views"
              title="Manage all saved views"
              className="h-6.5 w-6.5 rounded-md bg-white border border-blue-100 hover:bg-blue-50/70 text-gray-700 transition-colors inline-flex items-center justify-center shrink-0"
            >
              <ExternalLink className="w-3 h-3 text-gray-500" />
            </Link>
          )}
        </div>
      </div>
    );
  };

  const renderDesktopActionControls = () => (
    <div className="flex items-center justify-end gap-1.5 flex-wrap shrink-0 w-full sm:w-auto">
      {lastAppliedView && onUpdateView && !isCreating && (
        <button
          type="button"
          onClick={() => onUpdateView(lastAppliedView.id)}
          title={`Overwrite "${lastAppliedView.name}" with current filters, sort, and chart options`}
          className="h-7 px-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1"
        >
          <Save className="w-3 h-3" />
          <span>Update “{lastAppliedView.name}”</span>
        </button>
      )}

      {isCreating ? (
        <form onSubmit={handleCreateSubmit} className="flex items-center gap-1.5">
          <input
            type="text"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder="View name..."
            autoFocus
            style={{ fontSize: '11px' }}
            className="h-6 text-[11px] leading-tight bg-white border border-blue-200 rounded-md px-2 text-gray-800 focus:outline-none focus:border-blue-500 w-28 sm:w-32"
          />
          <button
            type="submit"
            aria-label="Confirm save view"
            className="h-6 px-2 rounded-md bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 cursor-pointer flex items-center shrink-0"
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreating(false);
              setViewName('');
            }}
            aria-label="Cancel save view"
            className="h-6 px-2 rounded-md bg-gray-100 text-gray-600 text-[11px] font-semibold hover:bg-gray-200 cursor-pointer flex items-center shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="h-6 px-2.5 rounded-md bg-blue-600 text-white text-[11px] leading-none font-semibold hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          <span>Save View</span>
        </button>
      )}

      {manageHref && (
        <Link
          href={manageHref}
          aria-label="Manage all saved views"
          title="Manage all saved views"
          className="h-6 px-2 rounded-md bg-white border border-blue-100 hover:bg-blue-50/70 text-gray-700 text-[11px] leading-none font-semibold transition-colors inline-flex items-center justify-center"
        >
          <ExternalLink className="w-3 h-3 text-gray-500" />
        </Link>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes savedViewPerimeterTrace {
          from {
            stroke-dashoffset: 0;
          }
          to {
            stroke-dashoffset: 100;
          }
        }
        .saved-view-toast-perimeter {
          stroke-dasharray: 100;
          stroke-dashoffset: 0;
          animation: savedViewPerimeterTrace ${UNDO_TOAST_DURATION_MS}ms linear forwards;
        }
        .saved-view-toast-perimeter--paused {
          animation-play-state: paused;
        }
      `}</style>

      <div className="bg-white border border-blue-100 rounded-2xl px-3.5 py-2.5 shadow-2xs min-w-0">
        {/* Narrow Screen Layout (< sm): Line 1 = Bounded Lane from 'Saved Views' Left Edge to '+ Save View' Left Edge; Line 2 = 2 Equal Pills (<= 2) or Dropdown (> 2) */}
        <div className="sm:hidden flex flex-col gap-2 min-w-0">
          {renderMobileHeaderRow()}

          {views.length === 0 ? (
            <span className="text-xs text-gray-400">
              No saved views yet—set filters or sorting and click Save View.
            </span>
          ) : views.length <= MOBILE_MAX_PILLS ? (
            <div className="grid grid-cols-2 gap-2 min-w-0">
              {views.map((view) => renderPill(view, { isEqualHalfMobile: true }))}
            </div>
          ) : (
            <div className="w-full min-w-0">
              <select
                value={activeViewId ?? ''}
                onChange={handleMobileSelectChange}
                aria-label="Select a saved view"
                style={{ fontSize: '12px' }}
                className="w-full h-8 rounded-xl border border-blue-100 bg-blue-50/50 px-2.5 text-xs font-semibold text-gray-800 focus:outline-none focus:border-blue-400"
              >
                <option value="">Choose a saved view ({views.length})...</option>
                {views.map((view) => (
                  <option key={view.id} value={view.id}>
                    {view.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Desktop Layout (sm+): Single Responsive Row with Pills + Searchable Overflow + Actions */}
        <div className="hidden sm:flex items-center justify-between gap-3 flex-wrap min-w-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <Bookmark className="w-3.5 h-3.5 text-blue-600" />
              <span>Saved Views</span>
            </span>

            {views.length === 0 ? (
              <span className="text-xs text-gray-400">
                No saved views yet—set your filters or sorting and click Save View.
              </span>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {desktopPillViews.map((view) =>
                  renderPill(view, { maxLabelWidthClass: 'max-w-[160px]' })
                )}

                {views.length > DESKTOP_MAX_PILLS && (
                  <div className="relative" ref={pickerRef}>
                    <button
                      type="button"
                      onClick={() => setIsPickerOpen((prev) => !prev)}
                      className="h-7 px-2.5 rounded-xl bg-white border border-blue-100 hover:bg-blue-50/70 text-gray-700 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>
                        {overflowCount > 0 ? `+${overflowCount} more` : 'All views'}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                    </button>

                    {isPickerOpen && (
                      <div className="absolute left-0 mt-1.5 w-72 bg-white border border-blue-100 rounded-xl shadow-lg p-2 z-30 space-y-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={pickerSearch}
                            onChange={(e) => setPickerSearch(e.target.value)}
                            placeholder="Filter views..."
                            autoFocus
                            style={{ fontSize: '12px' }}
                            className="w-full h-7 pl-8 pr-2.5 rounded-lg border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-blue-400"
                          />
                        </div>

                        <div className="max-h-56 overflow-y-auto analytics-scrollbar space-y-1 pr-0.5">
                          {filteredPickerViews.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-3">
                              No matching views
                            </p>
                          ) : (
                            filteredPickerViews.map((view) => {
                              const isActive = activeViewId === view.id;
                              return (
                                <div
                                  key={view.id}
                                  className={`flex items-center justify-between gap-1 rounded-lg px-2 py-1 text-xs ${
                                    isActive
                                      ? 'bg-blue-600 text-white font-semibold'
                                      : 'hover:bg-blue-50/70 text-gray-700'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onApplyView(view);
                                      setIsPickerOpen(false);
                                      setPickerSearch('');
                                    }}
                                    className="flex-1 text-left truncate cursor-pointer py-0.5"
                                    title={`Apply "${view.name}"`}
                                  >
                                    {view.name}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmingDeleteId(view.id)}
                                    aria-label={`Delete ${view.name}`}
                                    title={`Delete "${view.name}"`}
                                    className={`p-1 rounded cursor-pointer ${
                                      isActive
                                        ? 'text-blue-100 hover:text-white'
                                        : 'text-gray-400 hover:text-red-500'
                                    }`}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {renderDesktopActionControls()}
        </div>
      </div>

      {/* Floating Undo Toast with Perimeter Timer Trace */}
      {deletedView && onUndoDelete && (
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
              className={`saved-view-toast-perimeter ${
                isUndoing ? 'saved-view-toast-perimeter--paused' : ''
              }`}
            />
          </svg>

          <span className="relative text-xs font-medium truncate">
            Deleted view “<strong className="font-semibold">{deletedView.name}</strong>”
          </span>
          <div className="relative flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={isUndoing}
              onClick={handleUndoClick}
              className="h-6.5 px-2.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 disabled:opacity-60"
            >
              {isUndoing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Undo2 className="w-3.5 h-3.5" />
              )}
              <span>{isUndoing ? 'Undoing...' : 'Undo'}</span>
            </button>
            {onDismissUndoToast && (
              <button
                type="button"
                disabled={isUndoing}
                onClick={onDismissUndoToast}
                aria-label="Dismiss notification"
                className="p-1 text-gray-400 hover:text-white rounded-md transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}