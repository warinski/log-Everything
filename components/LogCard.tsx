'use client';

import { useState } from 'react';
import { Pencil, Trash2, Clock, Copy, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { duplicateLog } from '@/lib/actions/logActions';

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

export default function LogCard({
  log,
  userId,
  isCollapsed = false,
  onToggleCollapse,
  onEdit,
  onDelete,
  onTagClick,
  onSuccess,
  onLogAgain,
}: LogCardProps) {
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isLoggingAgain, setIsLoggingAgain] = useState(false);

  const hasCollapsibleDetails = Boolean(
    (log.attributes && Object.keys(log.attributes).length > 0) ||
      (log.notes && log.notes.trim().length > 0) ||
      (log.tags && log.tags.length > 0)
  );

  const dateValue = log.timestamp || log.loggedAt;
  const formattedDate = dateValue
    ? new Date(dateValue).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  const handleCardClick = () => {
    if (onToggleCollapse) {
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

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(log);
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
    onToggleCollapse?.();
  };

  const collapseToggleButton =
    onToggleCollapse && hasCollapsibleDetails ? (
      <button
        type="button"
        onClick={handleToggleButtonClick}
        className="p-1 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
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
    <div className="flex items-center gap-0.5 shrink-0">
      {onLogAgain && (
        <button
          type="button"
          onClick={handleLogAgainClick}
          disabled={isLoggingAgain}
          className="p-1 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer disabled:opacity-50"
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
        className="p-1 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50"
        title="Duplicate Log"
        aria-label="Duplicate Log"
      >
        <Copy className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={handleEditClick}
        className="p-1 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
        title="Edit Log"
        aria-label="Edit Log"
      >
        <Pencil className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={handleDeleteClick}
        className="p-1 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
        title="Delete Log"
        aria-label="Delete Log"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <span className="hidden sm:inline-flex">{collapseToggleButton}</span>
    </div>
  );

  return (
    <div
      onClick={onToggleCollapse ? handleCardClick : undefined}
      role={onToggleCollapse ? 'button' : undefined}
      tabIndex={onToggleCollapse ? 0 : undefined}
      onKeyDown={
        onToggleCollapse
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick();
              }
            }
          : undefined
      }
      className={`bg-white border border-blue-100 rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 shadow-2xs space-y-1.5 sm:space-y-2 hover:border-blue-300 transition-all min-w-0 ${
        onToggleCollapse ? 'cursor-pointer select-none sm:select-auto' : ''
      }`}
    >
      <div className="space-y-1.5 min-w-0">
        {/* Mobile: Category above Timestamp + Action Icons */}
        <div className="sm:hidden space-y-1.5 min-w-0">
          {log.categoryName && (
            <div className="min-w-0">
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold max-w-full border"
                style={{
                  backgroundColor: log.categoryColor ? `${log.categoryColor}15` : '#EFF6FF',
                  color: log.categoryColor || '#2563EB',
                  borderColor: log.categoryColor ? `${log.categoryColor}40` : '#BFDBFE',
                }}
              >
                <span className="text-xs leading-none shrink-0">{log.categoryIcon || '❓'}</span>
                <span className="break-words min-w-0">{log.categoryName}</span>
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 min-w-0">
            {formattedDate ? (
              <div className="flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-blue-50/50 px-2 py-0.5 rounded-md border border-blue-100/60 shrink-0">
                <Clock className="w-3 h-3 text-blue-500 shrink-0" />
                <span>{formattedDate}</span>
              </div>
            ) : (
              <span />
            )}
            {actionButtons}
          </div>
        </div>

        {/* Desktop: Category + Timestamp on left, Action Icons on right */}
        <div className="hidden sm:flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center flex-wrap gap-2 flex-1 min-w-0">
            {log.categoryName && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs sm:text-sm font-semibold min-w-0 max-w-full border"
                style={{
                  backgroundColor: log.categoryColor ? `${log.categoryColor}15` : '#EFF6FF',
                  color: log.categoryColor || '#2563EB',
                  borderColor: log.categoryColor ? `${log.categoryColor}40` : '#BFDBFE',
                }}
              >
                <span className="text-base leading-none shrink-0">{log.categoryIcon || '❓'}</span>
                <span className="break-words min-w-0">{log.categoryName}</span>
              </span>
            )}

            {formattedDate && (
              <div className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-blue-50/50 px-2 py-0.5 rounded-md border border-blue-100/60 shrink-0">
                <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>{formattedDate}</span>
              </div>
            )}
          </div>
          {actionButtons}
        </div>

        <div className="flex items-start justify-between gap-2 min-w-0">
          <h3 className="text-sm sm:text-[15px] font-bold text-gray-900 leading-snug break-words min-w-0 flex-1">
            {log.title}
          </h3>
          <span className="sm:hidden shrink-0">{collapseToggleButton}</span>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Dynamic Attributes Grid */}
          {log.attributes && Object.keys(log.attributes).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-1.5 px-2.5 bg-blue-50/30 rounded-lg border border-blue-100/50 text-xs min-w-0">
              {Object.entries(log.attributes).map(([key, value]) => (
                <div key={key} className="min-w-0">
                  <span className="text-blue-400 block uppercase text-[10px] truncate">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="font-semibold text-gray-700 break-words">{String(value)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Notes / Details */}
          {log.notes && (
            <p className="text-xs sm:text-sm text-gray-600 whitespace-pre-wrap break-words">
              {log.notes}
            </p>
          )}

          {/* Tags */}
          {log.tags && log.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {log.tags.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick(tag);
                  }}
                  className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md transition-colors font-medium cursor-pointer"
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}