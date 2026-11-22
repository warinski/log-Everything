'use client';

import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface AnalyticsDataTableProps {
  isLoading: boolean;
  totalFilteredCount: number;
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  paginatedLogs: any[];
  tableColumns: Array<{ key: string; label: string; type?: string }>;
  columnWidths: Record<string, number>;
  sortConfigs: SortConfig[];
  onSort: (key: string, e: React.MouseEvent) => void;
  onResizeMouseDown: (key: string, e: React.MouseEvent) => void;
  selectedRowId: string | null;
  onToggleSelectRow: (id: string) => void;
  getLogTimestamp: (log: any) => Date;
}

export default function AnalyticsDataTable({
  isLoading,
  totalFilteredCount,
  currentPage,
  totalPages,
  rowsPerPage,
  onPageChange,
  paginatedLogs,
  tableColumns,
  columnWidths,
  sortConfigs,
  onSort,
  onResizeMouseDown,
  selectedRowId,
  onToggleSelectRow,
  getLogTimestamp,
}: AnalyticsDataTableProps) {
  const renderSortIcon = (key: string) => {
    const idx = sortConfigs.findIndex((s) => s.key === key);
    if (idx === -1) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-300" />;
    const config = sortConfigs[idx];
    return (
      <span className="inline-flex items-center gap-0.5 text-blue-600">
        {config.direction === 'asc' ? (
          <ArrowUp className="w-3.5 h-3.5" />
        ) : (
          <ArrowDown className="w-3.5 h-3.5" />
        )}
        {sortConfigs.length > 1 && (
          <span className="text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full px-1">
            {idx + 1}
          </span>
        )}
      </span>
    );
  };

  return (
    <div className="bg-white border border-blue-100 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      <div className="px-4 sm:px-6 py-3 border-b border-blue-100 bg-white flex items-center justify-between shrink-0">
        <span className="text-xs text-gray-500">
          <strong className="text-gray-800">
            {totalFilteredCount > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0}
          </strong>{' '}
          to{' '}
          <strong className="text-gray-800">
            {Math.min(currentPage * rowsPerPage, totalFilteredCount)}
          </strong>{' '}
          of <strong className="text-gray-800">{totalFilteredCount}</strong>
          {totalPages > 1 && (
            <span className="ml-2 text-gray-400">
              (Page <strong className="text-gray-700">{currentPage}</strong> of{' '}
              <strong className="text-gray-700">{totalPages}</strong>)
            </span>
          )}
        </span>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto analytics-scrollbar">
        {isLoading ? (
          <div className="p-8 text-center text-xs sm:text-sm text-gray-400">
            Loading analytics data...
          </div>
        ) : paginatedLogs.length === 0 ? (
          <div className="p-8 text-center text-xs sm:text-sm text-gray-400">
            No matching logs found for the selected filters.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-blue-100 bg-blue-50/30 text-[11px] font-bold text-gray-600 uppercase">
                {tableColumns.map((col) => (
                  <th
                    key={col.key}
                    style={{ width: columnWidths[col.key] || 150 }}
                    className="relative px-4 py-3 select-none whitespace-nowrap"
                  >
                    <button
                      type="button"
                      onClick={(e) => onSort(col.key, e)}
                      className="inline-flex items-center gap-1.5 hover:text-blue-600 cursor-pointer uppercase"
                    >
                      <span>{col.label}</span>
                      {renderSortIcon(col.key)}
                    </button>
                    <div
                      onMouseDown={(e) => onResizeMouseDown(col.key, e)}
                      className="absolute right-0 top-1 bottom-1 w-1 cursor-col-resize hover:bg-blue-400"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedLogs.map((log: any) => {
                const isSelected = selectedRowId === log._id;
                return (
                  <tr
                    key={log._id}
                    onClick={() => onToggleSelectRow(log._id)}
                    className={`transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/70' : 'hover:bg-blue-50/30'
                    }`}
                  >
                    {tableColumns.map((col) => {
                      let content: any = '';
                      if (col.key === 'title') content = log.title || '—';
                      else if (col.key === 'category') content = log.categoryName || 'General';
                      else if (col.key === 'timestamp') {
                        content = getLogTimestamp(log).toLocaleString();
                      } else if (col.key === 'tags') {
                        content = (log.tags || []).join(', ') || '—';
                      } else {
                        const raw = log.attributes?.[col.key];
                        if (typeof raw === 'boolean') content = raw ? 'Yes' : 'No';
                        else content = raw !== undefined && raw !== '' ? String(raw) : '—';
                      }

                      return (
                        <td
                          key={col.key}
                          style={{ width: columnWidths[col.key] || 150 }}
                          className="px-4 py-3 text-gray-700 truncate max-w-[260px]"
                          title={String(content)}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}