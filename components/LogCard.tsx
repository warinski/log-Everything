'use client';

import { useState } from 'react';
import { Pencil, Trash2, Clock, Copy } from 'lucide-react';
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
  onEdit: (log: LogItem) => void;
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
  onSuccess?: () => void;
}

export default function LogCard({ log, userId, categories = [], onEdit, onDelete, onTagClick, onSuccess }: LogCardProps) {
  const [isDuplicating, setIsDuplicating] = useState(false);

  const dateValue = log.timestamp || log.loggedAt;
  const formattedDate = dateValue 
    ? new Date(dateValue).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  const handleDuplicateClick = async () => {
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

  const handleDeleteClick = () => {
    const isConfirmed = window.confirm('Are you sure you want to delete this log entry?');
    if (isConfirmed) {
      onDelete(log._id);
    }
  };

  return (
    <div className="bg-white border border-blue-100 rounded-2xl p-3.5 sm:p-5 shadow-2xs space-y-2.5 sm:space-y-3 hover:border-blue-300 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Category Pill & Emoji */}
            {log.categoryName && (
              <span 
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs sm:text-sm font-semibold shrink-0"
                style={{
                  backgroundColor: log.categoryColor ? `${log.categoryColor}15` : '#EFF6FF',
                  color: log.categoryColor || '#2563EB',
                  borderColor: log.categoryColor ? `${log.categoryColor}40` : '#BFDBFE',
                }}
              >
                <span className="text-base sm:text-xl leading-none">
                  {log.categoryIcon || '❓'}
                </span>
                <span className="truncate">{log.categoryName}</span>
              </span>
            )}

            {/* Timestamp Display */}
            {formattedDate && (
              <div className="flex items-center gap-1 text-[11px] sm:text-xs font-medium text-gray-500 bg-blue-50/50 px-2 py-0.5 rounded-md border border-blue-100/60 shrink-0">
                <Clock className="w-3 h-3 text-blue-500 shrink-0" />
                <span>{formattedDate}</span>
              </div>
            )}
          </div>

          <h3 className="text-sm sm:text-base font-bold text-gray-900 pt-0.5 w-full truncate">
            {log.title}
          </h3>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          <button
            onClick={handleDuplicateClick}
            disabled={isDuplicating}
            className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50"
            title="Duplicate Log"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(log)}
            className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
            title="Edit Log"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={handleDeleteClick}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            title="Delete Log"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dynamic Attributes Grid */}
      {log.attributes && Object.keys(log.attributes).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2 px-2.5 sm:px-3 bg-blue-50/30 rounded-xl border border-blue-100/50 text-xs">
          {Object.entries(log.attributes).map(([key, value]) => {
            // Capitalize and format the database key directly (e.g. 'qwerty' -> 'Qwerty')
            const displayLabel = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/_/g, ' ')
              .trim()
              .replace(/\b\w/g, (l) => l.toUpperCase());

            return (
              <div key={key} className="min-w-0">
                <span className="text-blue-400 block uppercase text-[10px] truncate">{displayLabel}</span>
                <span className="font-semibold text-gray-700 truncate block">{String(value)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Notes / Details */}
      {log.notes && <p className="text-xs sm:text-sm text-gray-600 whitespace-pre-wrap break-words">{log.notes}</p>}

      {/* Tags */}
      {log.tags && log.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {log.tags.map((tag) => (
            <button
              key={tag}
              onClick={() => onTagClick(tag)}
              className="text-[11px] sm:text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md transition-colors font-medium cursor-pointer"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}