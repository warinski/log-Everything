'use client';

import { useEffect, useState } from 'react';
import { Bookmark, Plus, Trash2, Check, X, RotateCw, Pencil, Undo2, Loader2 } from 'lucide-react';
import { SavedAnalyticsView } from '@/lib/analytics/savedViews';

const UNDO_TOAST_DURATION_MS = 6000;

interface SavedViewsBarProps {
  views: SavedAnalyticsView[];
  activeViewId: string | null;
  lastAppliedViewId?: string | null;
  deletedView?: SavedAnalyticsView | null;
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

  const lastAppliedView =
    lastAppliedViewId && activeViewId !== lastAppliedViewId
      ? views.find((v) => v.id === lastAppliedViewId) ?? null
      : null;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = viewName.trim();
    if (!trimmed) return;
    onSaveCurrentView(trimmed);
    setViewName('');
    setIsCreating(false);
  };

  const startEditing = (view: SavedAnalyticsView) => {
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

      <div className="bg-white border border-blue-100 rounded-2xl px-3.5 py-2.5 shadow-2xs flex items-center justify-between gap-3 flex-wrap min-w-0">
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
            <div className="flex items-center gap-1.5 flex-wrap">
              {views.map((view) => {
                const isActive = activeViewId === view.id;
                const isEditing = editingViewId === view.id;
                const isConfirmingDelete = confirmingDeleteId === view.id;

                if (isEditing) {
                  return (
                    <div
                      key={view.id}
                      className="inline-flex items-center gap-1 rounded-xl border border-blue-300 bg-white px-1.5 py-0.5 shadow-2xs"
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
                        style={{ fontSize: '11px' }}
                        className="h-5.5 text-[11px] leading-tight bg-transparent px-1 text-gray-900 focus:outline-none w-28"
                      />
                      <button
                        type="button"
                        onClick={() => commitEditing(view.id)}
                        aria-label="Confirm rename"
                        title="Save name"
                        className="h-5.5 w-5.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 cursor-pointer flex items-center justify-center"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        aria-label="Cancel rename"
                        title="Cancel"
                        className="h-5.5 w-5.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                }

                if (isConfirmingDelete) {
                  return (
                    <div
                      key={view.id}
                      className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50/80 px-2 py-0.5 text-xs shadow-2xs"
                    >
                      <span className="text-[11px] font-semibold text-red-700 truncate max-w-[120px]">
                        Delete “{view.name}”?
                      </span>
                      <button
                        type="button"
                        onClick={() => handleConfirmDelete(view.id)}
                        aria-label={`Confirm delete ${view.name}`}
                        title="Confirm delete"
                        className="h-5 px-1.5 rounded-md bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700 cursor-pointer inline-flex items-center gap-0.5"
                      >
                        <Check className="w-3 h-3" />
                        <span>Yes</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        aria-label="Cancel delete"
                        title="Cancel delete"
                        className="h-5 px-1.5 rounded-md bg-white text-gray-600 border border-gray-200 text-[11px] font-semibold hover:bg-gray-100 cursor-pointer inline-flex items-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={view.id}
                    className={`group inline-flex items-center rounded-xl border text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-blue-50/60 text-blue-700 border-blue-100 hover:bg-blue-100/70'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onApplyView(view)}
                      className="px-2.5 py-1 truncate max-w-[180px] cursor-pointer text-left"
                      title={`Apply "${view.name}"`}
                    >
                      {view.name}
                    </button>

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
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(view.id)}
                      aria-label={`Delete ${view.name}`}
                      title={`Delete "${view.name}"`}
                      className={`pr-1.5 pl-0.5 py-1 rounded-r-xl cursor-pointer transition-opacity ${
                        isActive
                          ? 'text-blue-100 hover:text-white'
                          : 'text-blue-400 hover:text-red-500'
                      }`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {lastAppliedView && onUpdateView && !isCreating && (
            <button
              type="button"
              onClick={() => onUpdateView(lastAppliedView.id)}
              title={`Overwrite "${lastAppliedView.name}" with current filters, sort, and chart options`}
              className="h-7 px-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1"
            >
              <RotateCw className="w-3 h-3" />
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
                className="h-6.5 text-[11px] leading-tight bg-white border border-blue-200 rounded-lg px-2 text-gray-800 focus:outline-none focus:border-blue-500 w-36"
              />
              <button
                type="submit"
                aria-label="Confirm save view"
                className="h-6.5 px-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer flex items-center"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setViewName('');
                }}
                aria-label="Cancel save view"
                className="h-6.5 px-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 cursor-pointer flex items-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="h-7 px-2.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save View</span>
            </button>
          )}
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