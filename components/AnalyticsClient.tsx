'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Download, FileSpreadsheet, FileJson } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getFilteredLogs } from '@/lib/actions/logActions';
import { getUserCategories } from '@/lib/actions/categoryActions';
import { LogItem } from '@/components/LogCard';
import { CategoryTemplate } from '@/components/LogModal';
import AnalyticsFilters from '@/components/analytics/AnalyticsFilters';
import SummaryCardsSection from '@/components/analytics/SummaryCardsSection';
import AnalyticsDataTable, { SortConfig } from '@/components/analytics/AnalyticsDataTable';
import {
  discoverDynamicColumns,
  computeAggregates,
  buildPieSlices,
  parseNumeric,
} from '@/lib/analytics/aggregations';

interface AnalyticsClientProps {
  userId: string;
}

export default function AnalyticsClient({ userId }: AnalyticsClientProps) {
  const [categories, setCategories] = useState<CategoryTemplate[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [selectedPieFieldKey, setSelectedPieFieldKey] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const rowsPerPage = 10;
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([
    { key: 'timestamp', direction: 'desc' },
  ]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [fetchedCats, fetchedLogs] = await Promise.all([
        getUserCategories(userId),
        getFilteredLogs({ userId }),
      ]);
      setCategories(fetchedCats || []);
      setLogs(fetchedLogs || []);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('logCreated', handleRefresh);
    window.addEventListener('categoryCreated', handleRefresh);
    return () => {
      window.removeEventListener('logCreated', handleRefresh);
      window.removeEventListener('categoryCreated', handleRefresh);
    };
  }, [loadData]);

  const singleCategoryObj = useMemo(
    () =>
      selectedCategories.length === 1
        ? categories.find((c) => c._id === selectedCategories[0])
        : undefined,
    [categories, selectedCategories]
  );

  const getLogTimestamp = useCallback((log: any): Date => {
    return new Date(log.timestamp || log.loggedAt || log.createdAt);
  }, []);

  const getLogEffectiveDate = useCallback(
    (log: any): Date => {
      if (log.attributes) {
        const dateKey = Object.keys(log.attributes).find(
          (k) => k.toLowerCase() === 'date' || k.toLowerCase().includes('date')
        );
        if (dateKey && log.attributes[dateKey]) {
          const parsedCustomDate = new Date(log.attributes[dateKey]);
          if (!isNaN(parsedCustomDate.getTime())) return parsedCustomDate;
        }
      }
      return getLogTimestamp(log);
    },
    [getLogTimestamp]
  );

  const filteredLogs = useMemo(() => {
    const selectedSet = new Set(selectedCategories);
    return logs.filter((log: any) => {
      if (selectedSet.size > 0 && (!log.categoryId || !selectedSet.has(log.categoryId))) {
        return false;
      }
      const logDate = getLogEffectiveDate(log);
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (logDate < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (logDate > to) return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const inTitle = log.title?.toLowerCase().includes(q);
        const inNotes = log.notes?.toLowerCase().includes(q);
        const inTags = log.tags?.some((t: string) => t.toLowerCase().includes(q));
        const inAttrs = Object.values(log.attributes || {}).some((v) =>
          String(v).toLowerCase().includes(q)
        );
        if (!inTitle && !inNotes && !inTags && !inAttrs) return false;
      }
      return true;
    });
  }, [logs, selectedCategories, searchQuery, dateFrom, dateTo, getLogEffectiveDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategories, searchQuery, dateFrom, dateTo]);

  const dynamicColumns = useMemo(
    () => discoverDynamicColumns(singleCategoryObj, selectedCategories, categories, filteredLogs),
    [singleCategoryObj, selectedCategories, categories, filteredLogs]
  );

  const getCellValue = useCallback(
    (log: any, colKey: string) => {
      if (colKey === 'title') return log.title || '';
      if (colKey === 'category') return log.categoryName || 'General';
      if (colKey === 'timestamp') return getLogTimestamp(log).getTime();
      if (colKey === 'tags') return (log.tags || []).join(', ');
      return log.attributes?.[colKey] ?? '';
    },
    [getLogTimestamp]
  );

  const handleSort = (key: string, e: React.MouseEvent) => {
    setSortConfigs((prev) => {
      const existingIndex = prev.findIndex((s) => s.key === key);
      if (e.shiftKey) {
        if (existingIndex > -1) {
          const updated = [...prev];
          updated[existingIndex] = {
            key,
            direction: updated[existingIndex].direction === 'asc' ? 'desc' : 'asc',
          };
          return updated;
        }
        return [...prev, { key, direction: 'asc' }];
      }
      if (existingIndex === 0 && prev.length === 1) {
        return [{ key, direction: prev[0].direction === 'asc' ? 'desc' : 'asc' }];
      }
      return [{ key, direction: 'asc' }];
    });
  };

  const sortedLogs = useMemo(() => {
    const copy = [...filteredLogs];
    copy.sort((a, b) => {
      for (const config of sortConfigs) {
        const valA = getCellValue(a, config.key);
        const valB = getCellValue(b, config.key);
        const numA = parseNumeric(valA);
        const numB = parseNumeric(valB);

        const comparison =
          numA !== null && numB !== null
            ? numA - numB
            : String(valA).localeCompare(String(valB), undefined, {
                numeric: true,
                sensitivity: 'base',
              });

        if (comparison !== 0) {
          return config.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
    return copy;
  }, [filteredLogs, sortConfigs, getCellValue]);

  const totalPages = Math.ceil(sortedLogs.length / rowsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedLogs.slice(start, start + rowsPerPage);
  }, [sortedLogs, currentPage]);

  const showCategoryColumn = selectedCategories.length !== 1;
  const isMultiCategoryScope = selectedCategories.length !== 1;

  useEffect(() => {
    const calculated: Record<string, number> = {};
    const measureTextLength = (str: string) => Math.max(110, str.length * 9 + 45);

    if (showCategoryColumn) {
      let maxLen = 'Category'.length;
      filteredLogs.forEach((l: any) => {
        const catName = l.categoryName || 'General';
        if (catName.length > maxLen) maxLen = catName.length;
      });
      calculated['category'] = measureTextLength('A'.repeat(maxLen));
    }

    let titleMax = 'Title'.length;
    filteredLogs.forEach((l: any) => {
      if ((l.title || '').length > titleMax) titleMax = (l.title || '').length;
    });
    calculated['title'] = measureTextLength('A'.repeat(titleMax));

    dynamicColumns.forEach((col) => {
      let maxLen = col.label.length;
      filteredLogs.forEach((l: any) => {
        const val = String(l.attributes?.[col.key] ?? '');
        if (val.length > maxLen) maxLen = val.length;
      });
      calculated[col.key] = measureTextLength('A'.repeat(maxLen));
    });

    let tagsMax = 'Tags'.length;
    filteredLogs.forEach((l: any) => {
      const tagsStr = (l.tags || []).join(', ');
      if (tagsStr.length > tagsMax) tagsMax = tagsStr.length;
    });
    calculated['tags'] = measureTextLength('A'.repeat(tagsMax));
    calculated['timestamp'] = 180;
    setColumnWidths(calculated);
  }, [filteredLogs, dynamicColumns, showCategoryColumn]);

  const aggregates = useMemo(
    () => computeAggregates(dynamicColumns, filteredLogs),
    [dynamicColumns, filteredLogs]
  );

  useEffect(() => {
    if (aggregates.fieldStats.length === 0) {
      setSelectedPieFieldKey('');
      return;
    }
    if (!aggregates.fieldStats.some((f) => f.key === selectedPieFieldKey)) {
      setSelectedPieFieldKey(aggregates.fieldStats[0].key);
    }
  }, [aggregates.fieldStats, selectedPieFieldKey]);

  const activePieField = useMemo(
    () =>
      aggregates.fieldStats.find((f) => f.key === selectedPieFieldKey) ||
      aggregates.fieldStats[0],
    [aggregates.fieldStats, selectedPieFieldKey]
  );

  const pieSlices = useMemo(
    () =>
      buildPieSlices(
        isMultiCategoryScope,
        activePieField,
        aggregates.categoryBreakdown,
        aggregates.totalLogs
      ),
    [isMultiCategoryScope, activePieField, aggregates.categoryBreakdown, aggregates.totalLogs]
  );

  const handleExport = (format: 'csv' | 'xlsx' | 'json') => {
    const filePrefix =
      selectedCategories.length === 1 && singleCategoryObj
        ? singleCategoryObj.name.toLowerCase().replace(/\s+/g, '_')
        : selectedCategories.length > 1
          ? `selected_${selectedCategories.length}_categories`
          : 'all_logs';
    const dateStamp = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      const exportData = sortedLogs.map((log: any) => ({
        id: log._id,
        title: log.title,
        category: log.categoryName || 'General',
        attributes: log.attributes || {},
        tags: log.tags || [],
        notes: log.notes || '',
        lastModified: getLogTimestamp(log).toISOString(),
      }));
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filePrefix}_${dateStamp}.json`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const rows = sortedLogs.map((log: any) => {
      const baseRow: Record<string, any> = { Title: log.title };
      if (showCategoryColumn) baseRow['Category'] = log.categoryName || 'General';
      dynamicColumns.forEach((col) => {
        const raw = log.attributes?.[col.key];
        baseRow[col.label] = typeof raw === 'boolean' ? (raw ? 'Yes' : 'No') : raw ?? '';
      });
      baseRow['Tags'] = (log.tags || []).join(', ');
      baseRow['Notes'] = log.notes || '';
      baseRow['Last Modified'] = getLogTimestamp(log).toLocaleString();
      return baseRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    const sheetName =
      selectedCategories.length === 1 && singleCategoryObj
        ? singleCategoryObj.name.slice(0, 30)
        : 'Analytics Logs';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    if (format === 'csv') {
      XLSX.writeFile(workbook, `${filePrefix}_${dateStamp}.csv`, { bookType: 'csv' });
    } else {
      XLSX.writeFile(workbook, `${filePrefix}_${dateStamp}.xlsx`, { bookType: 'xlsx' });
    }
  };

  const handleResizeMouseDown = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = columnWidths[key] || 160;

    const onMouseMove = (moveEvent: MouseEvent) => {
      setColumnWidths((prev) => ({
        ...prev,
        [key]: Math.max(90, startWidth + (moveEvent.clientX - startX)),
      }));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const tableColumns = useMemo(() => {
    const cols: Array<{ key: string; label: string; type?: string }> = [
      { key: 'title', label: 'Title' },
    ];
    if (showCategoryColumn) cols.push({ key: 'category', label: 'Category' });
    dynamicColumns.forEach((c) => cols.push(c));
    cols.push({ key: 'tags', label: 'Tags' });
    cols.push({ key: 'timestamp', label: 'Last Modified' });
    return cols;
  }, [showCategoryColumn, dynamicColumns]);

  return (
    <div className="max-w-7xl mx-auto flex flex-col space-y-4 px-2 sm:px-4 pb-12">
      {/* <style jsx>{`
        .analytics-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.35) transparent;
        }
        .analytics-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .analytics-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .analytics-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(148, 163, 184, 0.35);
          border-radius: 9999px;
        }
        .analytics-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(148, 163, 184, 0.6);
        }
      `}</style> */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <h1 className="text-sm sm:text-xl font-bold tracking-tight text-gray-900">
          Insights & Analytics
        </h1>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => handleExport('csv')}
            disabled={sortedLogs.length === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 text-xs sm:text-sm font-semibold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-blue-600" /> CSV
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            disabled={sortedLogs.length === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 text-xs sm:text-sm font-semibold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-600" /> XLSX
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={sortedLogs.length === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 text-xs sm:text-sm font-semibold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            <FileJson className="w-4 h-4 text-blue-600" /> JSON
          </button>
        </div>
      </div>

      <AnalyticsFilters
        categories={categories}
        selectedCategories={selectedCategories}
        onToggleCategory={(id) => {
          if (!id) return;
          setSelectedCategories((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
          );
          setSortConfigs([{ key: 'timestamp', direction: 'desc' }]);
        }}
        onSelectAllCategories={() => {
          setSelectedCategories(categories.map((c) => c._id).filter(Boolean));
          setSortConfigs([{ key: 'timestamp', direction: 'desc' }]);
        }}
        onClearCategories={() => {
          setSelectedCategories([]);
          setSortConfigs([{ key: 'timestamp', direction: 'desc' }]);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
      />

      <SummaryCardsSection
        isMultiCategoryScope={isMultiCategoryScope}
        totalLogs={aggregates.totalLogs}
        categoryBreakdownCount={aggregates.categoryBreakdownCount}
        categoryBreakdown={aggregates.categoryBreakdown}
        fieldStats={aggregates.fieldStats}
        pieSlices={pieSlices}
        activePieField={activePieField}
        selectedPieFieldKey={selectedPieFieldKey}
        onSelectPieField={setSelectedPieFieldKey}
      />

      <AnalyticsDataTable
        isLoading={isLoading}
        totalFilteredCount={sortedLogs.length}
        currentPage={currentPage}
        totalPages={totalPages}
        rowsPerPage={rowsPerPage}
        onPageChange={setCurrentPage}
        paginatedLogs={paginatedLogs}
        tableColumns={tableColumns}
        columnWidths={columnWidths}
        sortConfigs={sortConfigs}
        onSort={handleSort}
        onResizeMouseDown={handleResizeMouseDown}
        selectedRowId={selectedRowId}
        onToggleSelectRow={(id) => setSelectedRowId((prev) => (prev === id ? null : id))}
        getLogTimestamp={getLogTimestamp}
      />
    </div>
  );
}