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
    <div className="bg-white border border-blue-100 rounded-xl p-5 shadow-xs space-y-3 hover:border-blue-300 transition-all">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5 w-full">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Category Pill & Emoji */}
            {log.categoryName && (
              <span 
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold"
                style={{
                  backgroundColor: log.categoryColor ? `${log.categoryColor}15` : '#EFF6FF',
                  color: log.categoryColor || '#2563EB',
                  borderColor: log.categoryColor ? `${log.categoryColor}40` : '#BFDBFE',
                }}
              >
                {/* 🔍 Diagnostic wrapper with a red border and background */}
                <span 
                  style={{ fontSize: '26px' }} 
                >
                  {log.categoryIcon || '❓'}
                </span>
                <span>{log.categoryName}</span>
              </span>
            )}

            {/* Timestamp Display */}
            {formattedDate && (
              <div className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-blue-50/50 px-2.5 py-1 rounded-md border border-blue-100/60">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
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
            className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
            title="Edit Log"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(log._id)}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            title="Delete Log"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dynamic Attributes Grid */}
      {log.attributes && Object.keys(log.attributes).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2 px-3 bg-blue-50/30 rounded-lg border border-blue-100/50 text-xs">
          {Object.entries(log.attributes).map(([key, value]) => (
            <div key={key}>
              <span className="text-blue-400 block uppercase text-[10px]">{key.replace(/_/g, ' ')}</span>
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
              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md transition-colors font-medium cursor-pointer"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}