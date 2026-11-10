import { Pencil, Trash2, Clock } from 'lucide-react';

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
  loggedAt?: string | Date; // 👈 Support both schema names
  notes?: string;
  attributes?: Record<string, any>;
}

interface LogCardProps {
  log: LogItem;
  onEdit: (log: LogItem) => void;
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
}

export default function LogCard({ log, onEdit, onDelete, onTagClick }: LogCardProps) {
  // Check both timestamp and loggedAt so it never fails to display
  const dateValue = log.timestamp || log.loggedAt;
  const formattedDate = dateValue 
    ? new Date(dateValue).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-3 hover:border-gray-300 transition-all">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5 w-full">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Category Pill & Emoji */}
            {log.categoryName && (
              <span 
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold"
                style={{
                  backgroundColor: log.categoryColor ? `${log.categoryColor}15` : '#EFF6FF',
                  color: log.categoryColor || '#1D4ED8',
                  borderColor: log.categoryColor ? `${log.categoryColor}40` : undefined,
                }}
              >
                {log.categoryIcon && <span>{log.categoryIcon}</span>}
                <span>{log.categoryName}</span>
              </span>
            )}

            {/* Timestamp Display */}
            {formattedDate && (
              <div className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>{formattedDate}</span>
              </div>
            )}
          </div>

          <h3 className="text-base font-bold text-gray-900 pt-1">{log.title}</h3>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => onEdit(log)}
            className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100 transition-colors"
            title="Edit Log"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(log._id)}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 transition-colors"
            title="Delete Log"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dynamic Attributes Grid */}
      {log.attributes && Object.keys(log.attributes).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2 px-3 bg-gray-50 rounded-lg border border-gray-100 text-xs">
          {Object.entries(log.attributes).map(([key, value]) => (
            <div key={key}>
              <span className="text-gray-400 block uppercase text-[10px]">{key.replace(/_/g, ' ')}</span>
              <span className="font-semibold text-gray-700">{String(value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Notes / Details */}
      {log.notes && <p className="text-sm text-gray-600 whitespace-pre-wrap">{log.notes}</p>}

      {/* Tags */}
      {log.tags && log.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {log.tags.map((tag) => (
            <button
              key={tag}
              onClick={() => onTagClick(tag)}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md transition-colors"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}