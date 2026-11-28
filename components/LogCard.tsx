'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, Clock, Copy, Zap, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { duplicateLog, updateLog } from '@/lib/actions/logActions';

export interface LogItem {
  _id: string;
  userId: string;
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  title: string;
  tags?: string[];
  timestamp?: string | Date;
  loggedAt?: string | Date;
  notes?: string;
  attributes?: Record<string, any>;
}

type EditableField =
  | { type: 'title' }
  | { type: 'attribute'; key: string }
  | { type: 'notes' }
  | { type: 'tags' };

interface LogCardProps {
  log: LogItem;
  userId: string;
  categories?: any[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onEdit: (log: LogItem) => void;
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
  onSuccess?: () => void;
  onLogAgain?: (log: LogItem) => Promise<void> | void;
}

function formatTagsString(tags?: string[]): string {
  return Array.isArray(tags) ? tags.join(', ') : '';
}

function parseTagsString(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((t) => t.trim().replace(/^#+/, ''))
        .filter(Boolean)
    )
  );
}

export default function LogCard({
  log,
  userId,
  isCollapsed = false,
  onToggleCollapse,
  onDelete,
  onTagClick,
  onSuccess,
  onLogAgain,
}: LogCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isLoggingAgain, setIsLoggingAgain] = useState(false);
  const [isFullCardEditing, setIsFullCardEditing] = useState(false);
  const [activeSingleField, setActiveSingleField] = useState<EditableField | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [draftTitle, setDraftTitle] = useState(log.title || '');
  const [draftNotes, setDraftNotes] = useState(log.notes || '');
  const [draftTags, setDraftTags] = useState(formatTagsString(log.tags));
  const [draftAttributes, setDraftAttributes] = useState<Record<string, string>>(() => {
    const entries = Object.entries(log.attributes || {});
    return Object.fromEntries(
      entries.map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])
    );
  });

  useEffect(() => {
    if (isFullCardEditing || activeSingleField) return;
    setDraftTitle(log.title || '');
    setDraftNotes(log.notes || '');
    setDraftTags(formatTagsString(log.tags));
    const entries = Object.entries(log.attributes || {});
    setDraftAttributes(
      Object.fromEntries(
        entries.map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])
      )
    );
  }, [log, isFullCardEditing, activeSingleField]);

  useEffect(() => {
    if (!isFullCardEditing) return;

    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (cardRef.current && target && !cardRef.current.contains(target)) {
        setIsFullCardEditing(false);
        setActiveSingleField(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => document.removeEventListener('pointerdown', handlePointerDownOutside);
  }, [isFullCardEditing]);

  const hasCollapsibleDetails = Boolean(
    (log.attributes && Object.keys(log.attributes).length > 0) ||
      (log.notes && log.notes.trim().length > 0) ||
      (log.tags && log.tags.length > 0)
  );

  const showDetailsBody = isFullCardEditing || !isCollapsed;

  const dateValue = log.timestamp || log.loggedAt;
  const formattedDate = dateValue
    ? new Date(dateValue).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  const persistUpdate = async (
    payload: {
      title?: string;
      notes?: string;
      tags?: string[];
      attributes?: Record<string, any>;
    },
    closeSingleField = false
  ) => {
    if (isSavingEdit) return;
    try {
      setIsSavingEdit(true);
      await updateLog(log._id, userId, payload as any);
      if (closeSingleField) {
        setActiveSingleField(null);
      }
      onSuccess?.();
    } catch (err) {
      console.error('Failed to update log inline:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const commitTitle = async () => {
    const trimmed = draftTitle.trim();
    if (!trimmed) {
      setDraftTitle(log.title || '');
      setActiveSingleField(null);
      return;
    }
    if (trimmed !== (log.title || '')) {
      await persistUpdate({ title: trimmed }, true);
    } else {
      setActiveSingleField(null);
    }
  };

  const commitAttribute = async (attrKey: string) => {
    const currentRaw =
      log.attributes && Object.prototype.hasOwnProperty.call(log.attributes, attrKey)
        ? String(log.attributes[attrKey] ?? '')
        : '';
    const nextVal = draftAttributes[attrKey] ?? '';

    if (nextVal !== currentRaw) {
      const existingVal = log.attributes?.[attrKey];
      const coerced =
        typeof existingVal === 'number' && nextVal.trim() !== '' && !Number.isNaN(Number(nextVal))
          ? Number(nextVal)
          : nextVal;

      const updatedAttributes = {
        ...(log.attributes || {}),
        [attrKey]: coerced,
      };
      await persistUpdate({ attributes: updatedAttributes }, true);
    } else {
      setActiveSingleField(null);
    }
  };

  const commitNotes = async () => {
    if (draftNotes !== (log.notes || '')) {
      await persistUpdate({ notes: draftNotes }, true);
    } else {
      setActiveSingleField(null);
    }
  };

  const commitTags = async () => {
    const parsed = parseTagsString(draftTags);
    const prevTags = Array.isArray(log.tags) ? log.tags : [];
    const changed =
      parsed.length !== prevTags.length || parsed.some((tag, idx) => tag !== prevTags[idx]);

    if (changed) {
      setDraftTags(formatTagsString(parsed));
      await persistUpdate({ tags: parsed }, true);
    } else {
      setActiveSingleField(null);
    }
  };

  const commitFullCardEdits = async (e?: React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    const trimmedTitle = draftTitle.trim() || log.title;
    const parsedTags = parseTagsString(draftTags);
    const mergedAttributes: Record<string, any> = { ...(log.attributes || {}) };

    for (const [key, rawVal] of Object.entries(draftAttributes)) {
      const prevVal = mergedAttributes[key];
      mergedAttributes[key] =
        typeof prevVal === 'number' && rawVal.trim() !== '' && !Number.isNaN(Number(rawVal))
          ? Number(rawVal)
          : rawVal;
    }

    await persistUpdate(
      {
        title: trimmedTitle,
        notes: draftNotes,
        tags: parsedTags,
        attributes: mergedAttributes,
      },
      true
    );
    setIsFullCardEditing(false);
  };

  const handleCardClick = () => {
    if (!isFullCardEditing && !activeSingleField && onToggleCollapse) {
      onToggleCollapse();
    }
  };

  const handleDuplicateClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDuplicating) return;
    try {
      setIsDuplicating(true);
      await duplicateLog(log._id, userId);
      if (onSuccess) {
        onSuccess();
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to duplicate log:', err);
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleLogAgainClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoggingAgain || !onLogAgain) return;
    try {
      setIsLoggingAgain(true);
      await onLogAgain(log);
    } catch (err) {
      console.error('Failed to log again:', err);
    } finally {
      setIsLoggingAgain(false);
    }
  };

  const handleEditToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveSingleField(null);
    setIsFullCardEditing((prev) => {
      const next = !prev;
      if (next) {
        setDraftTitle(log.title || '');
        setDraftNotes(log.notes || '');
        setDraftTags(formatTagsString(log.tags));
        const entries = Object.entries(log.attributes || {});
        setDraftAttributes(
          Object.fromEntries(
            entries.map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])
          )
        );
      }
      return next;
    });
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isConfirmed = window.confirm('Are you sure you want to delete this log entry?');
    if (isConfirmed) {
      onDelete(log._id);
    }
  };

  const handleToggleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFullCardEditing) return;
    onToggleCollapse?.();
  };

  const isEditingTitle = isFullCardEditing || activeSingleField?.type === 'title';
  const isEditingNotes = isFullCardEditing || activeSingleField?.type === 'notes';
  const isEditingTags = isFullCardEditing || activeSingleField?.type === 'tags';
  const isEditingAttribute = (key: string) =>
    isFullCardEditing || (activeSingleField?.type === 'attribute' && activeSingleField.key === key);

  const collapseToggleButton =
    onToggleCollapse && hasCollapsibleDetails && !isFullCardEditing ? (
      <button
        type="button"
        onClick={handleToggleButtonClick}
        className="p-1.5 sm:p-1 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
        title={isCollapsed ? 'Expand Log Details' : 'Collapse Log Details'}
        aria-label={isCollapsed ? 'Expand Log Details' : 'Collapse Log Details'}
        aria-expanded={!isCollapsed}
      >
        {isCollapsed ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronUp className="w-4 h-4" />
        )}
      </button>
    ) : null;

  const actionButtons = (
    <div className="flex items-center gap-5 sm:gap-1 shrink-0">
      {isFullCardEditing && (
        <button
          type="button"
          onClick={commitFullCardEdits}
          disabled={isSavingEdit}
          className="p-1.5 sm:p-1 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          title="Save Changes"
          aria-label="Save Changes"
        >
          <Check className="w-4 h-4" />
        </button>
      )}

      {onLogAgain && (
        <button
          type="button"
          onClick={handleLogAgainClick}
          disabled={isLoggingAgain}
          className="p-1.5 sm:p-1 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer disabled:opacity-50"
          title="Log Again (Now)"
          aria-label="Log Again"
        >
          <Zap className={`w-4 h-4 ${isLoggingAgain ? 'animate-pulse' : ''}`} />
        </button>
      )}

      <button
        type="button"
        onClick={handleDuplicateClick}
        disabled={isDuplicating}
        className="p-1.5 sm:p-1 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50"
        title="Duplicate Log"
        aria-label="Duplicate Log"
      >
        <Copy className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={handleEditToggleClick}
        className={`p-1.5 sm:p-1 rounded-lg transition-colors cursor-pointer ${
          isFullCardEditing
            ? 'text-blue-700 bg-blue-100 hover:bg-blue-200'
            : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
        }`}
        title={isFullCardEditing ? 'Exit Edit Mode' : 'Edit Log'}
        aria-label={isFullCardEditing ? 'Exit Edit Mode' : 'Edit Log'}
        aria-pressed={isFullCardEditing}
      >
        <Pencil className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={handleDeleteClick}
        className="p-1.5 sm:p-1 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
        title="Delete Log"
        aria-label="Delete Log"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <span className="hidden sm:inline-flex">{collapseToggleButton}</span>
    </div>
  );

  const categoryBadge = log.categoryName ? (
    <span
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] leading-none font-medium max-w-full border"
      style={{
        backgroundColor: log.categoryColor ? `${log.categoryColor}15` : '#EFF6FF',
        color: log.categoryColor || '#2563EB',
        borderColor: log.categoryColor ? `${log.categoryColor}40` : '#BFDBFE',
      }}
    >
      <span className="text-[11px] leading-none shrink-0">{log.categoryIcon || '❓'}</span>
      <span className="leading-none break-words min-w-0">{log.categoryName}</span>
    </span>
  ) : null;

  const timestampPill = formattedDate ? (
    <div className="inline-flex items-center gap-1 text-[11px] leading-none font-medium text-gray-500 bg-blue-50/50 px-1.5 py-0.5 rounded-md border border-blue-100/60 shrink-0">
      <Clock className="w-3 h-3 text-blue-500 shrink-0" />
      <span className="leading-none">{formattedDate}</span>
    </div>
  ) : null;

  const attributeEntries = Object.entries(log.attributes || {});

  return (
    <div
      ref={cardRef}
      onClick={onToggleCollapse && !isFullCardEditing ? handleCardClick : undefined}
      role={onToggleCollapse && !isFullCardEditing ? 'button' : undefined}
      tabIndex={onToggleCollapse && !isFullCardEditing ? 0 : undefined}
      onKeyDown={
        onToggleCollapse && !isFullCardEditing
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick();
              }
            }
          : undefined
      }
      className={`bg-white border rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 shadow-2xs space-y-1.5 sm:space-y-2 transition-all min-w-0 ${
        isFullCardEditing
          ? 'border-blue-400 ring-2 ring-blue-100'
          : 'border-blue-100 hover:border-blue-300'
      } ${onToggleCollapse && !isFullCardEditing ? 'cursor-pointer select-none sm:select-auto' : ''}`}
    >
      <div className="flex flex-col gap-1 min-w-0">
        {/* Top Row: Title takes priority on the left, actions + mobile chevron on the right */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1" onClick={(e) => isEditingTitle && e.stopPropagation()}>
            {isEditingTitle ? (
              <input
                type="text"
                autoFocus={!isFullCardEditing && activeSingleField?.type === 'title'}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={() => {
                  if (!isFullCardEditing) {
                    void commitTitle();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!isFullCardEditing) {
                      void commitTitle();
                    } else {
                      void commitFullCardEdits();
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setDraftTitle(log.title || '');
                    setActiveSingleField(null);
                  }
                }}
                placeholder="Log title..."
                style={{ fontSize: '18px', lineHeight: 1.2 }}
                className="w-full rounded-md border border-blue-300 bg-blue-50/40 px-1.5 py-0 font-sans font-medium text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            ) : (
              <h3
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setDraftTitle(log.title || '');
                  setActiveSingleField({ type: 'title' });
                }}
                title="Double-click to edit title"
                className="font-sans text-[18px] sm:text-[18px] font-medium text-gray-900 leading-[1.2] break-words"
              >
                {log.title}
              </h3>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-0.5 shrink-0">
            <span className="sm:hidden">{collapseToggleButton}</span>
            <span className="hidden sm:inline-flex">{actionButtons}</span>
          </div>
        </div>

        {/* Mobile Metadata Row: Category + Timestamp snug under title, with Action Icons below */}
        <div className="sm:hidden flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center flex-wrap gap-1.5 min-w-0">
            {categoryBadge}
            {timestampPill}
          </div>
          <div className="flex items-center justify-end">{actionButtons}</div>
        </div>

        {/* Desktop Metadata Row: Category + Timestamp snug underneath Title */}
        <div className="hidden sm:flex items-center flex-wrap gap-1.5 min-w-0">
          {categoryBadge}
          {timestampPill}
        </div>
      </div>

      {showDetailsBody && (
        <>
          {/* Dynamic Attributes Grid */}
          {attributeEntries.length > 0 && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-1.5 px-2.5 bg-blue-50/30 rounded-lg border border-blue-100/50 text-xs min-w-0"
            >
              {attributeEntries.map(([key, value]) => {
                const editingThisAttr = isEditingAttribute(key);
                return (
                  <div key={key} className="min-w-0">
                    <span className="text-blue-400 block uppercase text-[10px] truncate">
                      {key.replace(/_/g, ' ')}
                    </span>
                    {editingThisAttr ? (
                      <input
                        type="text"
                        autoFocus={
                          !isFullCardEditing &&
                          activeSingleField?.type === 'attribute' &&
                          activeSingleField.key === key
                        }
                        value={draftAttributes[key] ?? ''}
                        onChange={(e) =>
                          setDraftAttributes((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        onBlur={() => {
                          if (!isFullCardEditing) {
                            void commitAttribute(key);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (!isFullCardEditing) {
                              void commitAttribute(key);
                            } else {
                              void commitFullCardEdits();
                            }
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setDraftAttributes((prev) => ({
                              ...prev,
                              [key]: value === null || value === undefined ? '' : String(value),
                            }));
                            setActiveSingleField(null);
                          }
                        }}
                        style={{ fontSize: '14px', lineHeight: 1.25 }}
                        className="w-full rounded border border-blue-300 bg-white px-1 py-0 font-sans font-semibold text-gray-700 focus:outline-none focus:border-blue-500"
                      />
                    ) : (
                      <span
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setDraftAttributes((prev) => ({
                            ...prev,
                            [key]: value === null || value === undefined ? '' : String(value),
                          }));
                          setActiveSingleField({ type: 'attribute', key });
                        }}
                        title="Double-click to edit field"
                        className="font-sans text-xs font-semibold text-gray-700 leading-tight break-words inline-block"
                      >
                        {String(value)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes / Details */}
          {(log.notes || isFullCardEditing || activeSingleField?.type === 'notes') && (
            <div onClick={(e) => isEditingNotes && e.stopPropagation()}>
              {isEditingNotes ? (
                <textarea
                  rows={1}
                  autoFocus={!isFullCardEditing && activeSingleField?.type === 'notes'}
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  onBlur={() => {
                    if (!isFullCardEditing) {
                      void commitNotes();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setDraftNotes(log.notes || '');
                      setActiveSingleField(null);
                    }
                  }}
                  placeholder="Notes..."
                  style={{ fontSize: '14px', lineHeight: 1.4 }}
                  className="w-full rounded-md border border-blue-300 bg-blue-50/40 px-1.5 py-0.5 font-sans font-normal text-gray-600 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              ) : (
                <p
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setDraftNotes(log.notes || '');
                    setActiveSingleField({ type: 'notes' });
                  }}
                  title="Double-click to edit notes"
                  className="font-sans text-xs font-normal text-gray-600 leading-normal whitespace-pre-wrap break-words"
                >
                  {log.notes}
                </p>
              )}
            </div>
          )}

          {/* Tags */}
          {((log.tags && log.tags.length > 0) ||
            isFullCardEditing ||
            activeSingleField?.type === 'tags') && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex flex-wrap items-center gap-1.5 pt-0.5"
            >
              {isEditingTags ? (
                <input
                  type="text"
                  autoFocus={!isFullCardEditing && activeSingleField?.type === 'tags'}
                  value={draftTags}
                  onChange={(e) => setDraftTags(e.target.value)}
                  onBlur={() => {
                    if (!isFullCardEditing) {
                      void commitTags();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!isFullCardEditing) {
                        void commitTags();
                      } else {
                        void commitFullCardEdits();
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setDraftTags(formatTagsString(log.tags));
                      setActiveSingleField(null);
                    }
                  }}
                  placeholder="Comma-separated tags..."
                  style={{ fontSize: '14px', lineHeight: 1.4 }}
                  className="w-full rounded-md border border-blue-300 bg-blue-50/40 px-1.5 py-0.5 font-sans font-medium text-blue-700 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              ) : (
                <div
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setDraftTags(formatTagsString(log.tags));
                    setActiveSingleField({ type: 'tags' });
                  }}
                  title="Double-click to edit tags"
                  className="flex flex-wrap gap-1.5"
                >
                  {(log.tags || []).map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTagClick(tag);
                      }}
                      className="font-sans text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md transition-colors font-medium cursor-pointer"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}