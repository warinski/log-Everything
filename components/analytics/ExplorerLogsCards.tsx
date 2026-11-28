'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronsDown, ChevronsUp } from 'lucide-react';
import LogCard, { LogItem } from '@/components/LogCard';
import {
  ALL_VALUES_SENTINEL,
  ExplorerFieldOption,
  ExplorerSortConfig,
  normalizeFieldValue,
  resolveLogAttribute,
} from '@/lib/analytics/fieldValueExplorer';

interface ExplorerLogsCardsProps {
  userId?: string;
  sortedLogs: LogItem[];
  activeField: ExplorerFieldOption | null;
  selectedFieldKey: string;
  selectedValue?: string;
  attributeFields: ExplorerFieldOption[];
  sortConfig: ExplorerSortConfig | null;
  onToggleSort: (columnKey: string) => void;
  onDeleteLog?: (id: string) => void;
  onTagClick?: (tag: string) => void;
  onLogAgain?: (log: LogItem) => Promise<void> | void;
  onRefreshLogs?: () => void;
  stickyHeader?: React.ReactNode;
}

export default function ExplorerLogsCards({
  userId = '',
  sortedLogs,
  activeField,
  selectedFieldKey,
  selectedValue = ALL_VALUES_SENTINEL,
  attributeFields,
  sortConfig,
  onToggleSort,
  onDeleteLog,
  onTagClick,
  onLogAgain,
  onRefreshLogs,
  stickyHeader,
}: ExplorerLogsCardsProps) {
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
  const prevLogIdsSignatureRef = useRef<string>('');

  const [selectedSortKey, setSelectedSortKey] = useState<string>(
    sortConfig?.columnKey || '__last_modified__'
  );

  useEffect(() => {
    if (sortConfig?.columnKey) {
      setSelectedSortKey(sortConfig.columnKey);
    }
  }, [sortConfig?.columnKey]);

  const logIdsSignature = useMemo(
    () => sortedLogs.map((l) => l._id).join(','),
    [sortedLogs]
  );

  useEffect(() => {
    const isSpecificValueFilter = Boolean(
      selectedFieldKey && selectedValue && selectedValue !== ALL_VALUES_SENTINEL
    );

    if (isSpecificValueFilter) {
      if (sortedLogs.length > 0) {
        setExpandedLogIds((prev) => {
          const next = { ...prev };
          sortedLogs.forEach((log) => {
            next[log._id] = true;
          });
          return next;
        });
      }
    } else if (prevLogIdsSignatureRef.current !== logIdsSignature) {
      setExpandedLogIds({});
    }

    prevLogIdsSignatureRef.current = logIdsSignature;
  }, [selectedFieldKey, selectedValue, sortedLogs, logIdsSignature]);

  const areAllExpanded = useMemo(() => {
    if (sortedLogs.length === 0) return false;
    return sortedLogs.every((log) => Boolean(expandedLogIds[log._id]));
  }, [sortedLogs, expandedLogIds]);

  const handleToggleCard = useCallback((logId: string) => {
    setExpandedLogIds((prev) => ({
      ...prev,
      [logId]: !prev[logId],
    }));
  }, []);

  const handleToggleAll = useCallback(() => {
    setExpandedLogIds((prev) => {
      const next = { ...prev };
      const shouldCollapseAll = sortedLogs.every((log) => Boolean(prev[log._id]));
      sortedLogs.forEach((log) => {
        if (shouldCollapseAll) {
          delete next[log._id];
        } else {
          next[log._id] = true;
        }
      });
      return next;
    });
  }, [sortedLogs]);

  const sortOptions: Array<{ key: string; label: string }> = [
    { key: '__title__', label: 'Title' },
    ...attributeFields.map((f) => ({ key: f.key, label: f.label })),
    { key: '__notes__', label: 'Notes' },
    { key: '__tags__', label: 'Tags' },
    { key: '__last_modified__', label: 'Last Modified' },
  ];

  const isCurrentColumnSorted =
    Boolean(sortConfig) && sortConfig?.columnKey === selectedSortKey;

  return (
    <div className="space-y-2.5">
      {/* Sticky Toolbar (Matches Screenshot Bar + Sort Controls) */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs py-1.5 space-y-2 border-b border-blue-100/60">
        {stickyHeader}

        <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-100/80 bg-blue-50/35 px-3 py-1.5 text-xs">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-bold uppercase tracking-wider text-gray-500 shrink-0 text-[11px]">
              Sort
            </span>
            <select
              aria-label="Sort entries by"
              value={selectedSortKey}
              onChange={(e) => {
                const nextKey = e.target.value;
                setSelectedSortKey(nextKey);
                onToggleSort(nextKey);
              }}
              style={{ fontSize: '15.2px' }}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-gray-900 focus:outline-none focus:border-blue-400"
            >
              {sortOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => onToggleSort(selectedSortKey)}
              title={
                !isCurrentColumnSorted
                  ? 'Sort ascending'
                  : sortConfig?.direction === 'asc'
                  ? 'Sorted ascending (click for descending)'
                  : 'Sorted descending (click to clear)'
              }
              aria-label="Toggle sort order"
              className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors cursor-pointer shrink-0"
            >
              {!isCurrentColumnSorted ? (
                <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
              ) : sortConfig?.direction === 'asc' ? (
                <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
              )}
            </button>
          </div>

          {sortedLogs.length > 0 && (
            <button
              type="button"
              onClick={handleToggleAll}
              className="w-8 h-8 rounded-lg border border-blue-100 bg-white hover:bg-blue-50 text-blue-700 transition-colors cursor-pointer inline-flex items-center justify-center shrink-0"
              title={areAllExpanded ? 'Collapse all cards' : 'Expand all cards'}
              aria-label={areAllExpanded ? 'Collapse all cards' : 'Expand all cards'}
            >
              {areAllExpanded ? (
                <ChevronsUp className="w-4 h-4" />
              ) : (
                <ChevronsDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Matching Log Cards */}
      {sortedLogs.length === 0 ? (
        <div className="rounded-2xl border border-blue-100 bg-white py-10 px-4 text-center text-xs sm:text-sm text-gray-500">
          No matching log entries found for this selection.
        </div>
      ) : (
        <div className="space-y-2">
          {sortedLogs.map((log) => {
            const resolvedUserId = userId || log.userId;
            const fieldMatchesValue =
              Boolean(activeField) &&
              Boolean(selectedValue) &&
              selectedValue !== ALL_VALUES_SENTINEL &&
              normalizeFieldValue(
                resolveLogAttribute(log.attributes, activeField!).value
              ) === selectedValue;

            return (
              <div
                key={log._id}
                className={
                  fieldMatchesValue
                    ? 'rounded-2xl ring-2 ring-blue-300/70 transition-all'
                    : undefined
                }
              >
                <LogCard
                  log={log}
                  userId={resolvedUserId}
                  isCollapsed={!Boolean(expandedLogIds[log._id])}
                  onToggleCollapse={() => handleToggleCard(log._id)}
                  onEdit={() => {}}
                  onDelete={(id) => onDeleteLog?.(id)}
                  onTagClick={(tag) => onTagClick?.(tag)}
                  onLogAgain={onLogAgain}
                  onSuccess={onRefreshLogs}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}