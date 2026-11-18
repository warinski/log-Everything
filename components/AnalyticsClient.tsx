'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  FileSpreadsheet,
  FileJson,
  Calculator,
  Filter,
  Search,
  Layers,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getFilteredLogs } from '@/lib/actions/logActions';
import { getUserCategories } from '@/lib/actions/categoryActions';
import { LogItem } from '@/components/LogCard';
import { CategoryTemplate } from '@/components/LogModal';

interface AnalyticsClientProps {
  userId: string;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export default function AnalyticsClient({ userId }: AnalyticsClientProps) {
  const [categories, setCategories] = useState<CategoryTemplate[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const rowsPerPage = 10;

  // Selected row state for highlighting
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Column Width state for resizable table columns
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // Multi-column sort state
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

  // Active Category object
  const activeCategoryObj = useMemo(
    () => categories.find((c) => c._id === selectedCategory),
    [categories, selectedCategory]
  );

  // Helper to extract the actual system timestamp for 'Last Modified'
  const getLogTimestamp = useCallback((log: any): Date => {
    return new Date(log.timestamp || log.loggedAt || log.createdAt);
  }, []);

  // Helper to extract the effective date for date-range filtering
  const getLogEffectiveDate = useCallback((log: any): Date => {
    if (log.attributes) {
      const dateKey = Object.keys(log.attributes).find(
        (k) => k.toLowerCase() === 'date' || k.toLowerCase().includes('date')
      );
      if (dateKey && log.attributes[dateKey]) {
        const parsedCustomDate = new Date(log.attributes[dateKey]);
        if (!isNaN(parsedCustomDate.getTime())) {
          return parsedCustomDate;
        }
      }
    }
    return getLogTimestamp(log);
  }, [getLogTimestamp]);

  // Filter logs by category, search, and smart date range
  const filteredLogs = useMemo(() => {
    return logs.filter((log: any) => {
      if (selectedCategory && log.categoryId !== selectedCategory) {
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
  }, [logs, selectedCategory, searchQuery, dateFrom, dateTo, getLogEffectiveDate]);

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery, dateFrom, dateTo]);

  // Discover dynamic columns
  const dynamicColumns = useMemo(() => {
    if (activeCategoryObj?.fields && activeCategoryObj.fields.length > 0) {
      return activeCategoryObj.fields.map((f) => ({
        key: f.name || f.key || '',
        label: f.label || f.name || '',
        type: f.fieldType || f.type || 'text',
      }));
    }

    const keyMap = new Map<string, { key: string; label: string; type: string }>();
    filteredLogs.forEach((log: any) => {
      if (log.attributes) {
        Object.entries(log.attributes).forEach(([k, val]) => {
          if (!keyMap.has(k)) {
            const isNum =
              typeof val === 'number' ||
              (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val.replace(/,/g, ''))));
            keyMap.set(k, {
              key: k,
              label: k.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
              type: typeof val === 'boolean' ? 'checkbox' : isNum ? 'number' : 'text',
            });
          }
        });
      }
    });
    return Array.from(keyMap.values());
  }, [activeCategoryObj, filteredLogs]);

  const getCellValue = useCallback((log: any, colKey: string) => {
    if (colKey === 'title') return log.title || '';
    if (colKey === 'category') return log.categoryName || 'General';
    if (colKey === 'timestamp') {
      return getLogTimestamp(log).getTime();
    }
    if (colKey === 'tags') return (log.tags || []).join(', ');
    return log.attributes?.[colKey] ?? '';
  }, [getLogTimestamp]);

  const parseNumeric = (val: any): number | null => {
    if (val === null || val === undefined || val === '' || typeof val === 'boolean') return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    const cleaned = String(val).replace(/,/g, '').trim();
    if (cleaned === '') return null;
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  };

  const parseTimeToMinutes = (timeStr: string): number | null => {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return hours * 60 + minutes;
  };

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

        let comparison = 0;
        if (numA !== null && numB !== null) {
          comparison = numA - numB;
        } else {
          comparison = String(valA).localeCompare(String(valB), undefined, {
            numeric: true,
            sensitivity: 'base',
          });
        }

        if (comparison !== 0) {
          return config.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
    return copy;
  }, [filteredLogs, sortConfigs, getCellValue]);

  // Paginated logs (at most 10 rows per page)
  const totalPages = Math.ceil(sortedLogs.length / rowsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedLogs.slice(start, start + rowsPerPage);
  }, [sortedLogs, currentPage]);

  // Column widths
  useEffect(() => {
    const calculated: Record<string, number> = {};
    const measureTextLength = (str: string) => Math.max(110, str.length * 9 + 45);

    if (!selectedCategory) {
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
  }, [filteredLogs, dynamicColumns, selectedCategory]);

  // Aggregate Calculations
  const aggregates = useMemo(() => {
    const fieldStats: Array<{
      key: string;
      label: string;
      type: string;
      count: number;
      sum: number;
      avg: number;
      min: number;
      max: number;
      trueCount?: number;
    }> = [];

    dynamicColumns.forEach((col) => {
      if (col.type === 'checkbox' || col.type === 'boolean') {
        let trueCount = 0;
        let total = 0;
        filteredLogs.forEach((log: any) => {
          if (log.attributes && col.key in log.attributes) {
            total++;
            if (Boolean(log.attributes[col.key])) trueCount++;
          }
        });
        if (total > 0) {
          fieldStats.push({
            key: col.key,
            label: col.label,
            type: 'boolean',
            count: total,
            sum: trueCount,
            avg: (trueCount / total) * 100,
            min: 0,
            max: 1,
            trueCount,
          });
        }
        return;
      }

      const nums: number[] = [];
      filteredLogs.forEach((log: any) => {
        const val = log.attributes?.[col.key];
        const parsed = parseNumeric(val);
        if (parsed !== null) nums.push(parsed);
      });

      if (nums.length > 0) {
        const sum = nums.reduce((acc, n) => acc + n, 0);
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        const avg = sum / nums.length;
        fieldStats.push({
          key: col.key,
          label: col.label,
          type: col.type,
          count: nums.length,
          sum,
          avg,
          min,
          max,
        });
      }
    });

    // Duration pairing
    const timeFields = dynamicColumns.filter(
      (c) => c.type === 'time' || c.key.includes('time') || c.key.includes('in') || c.key.includes('out') || c.key.includes('start') || c.key.includes('end')
    );

    if (timeFields.length >= 2) {
      const pairs: Array<{ startKey: string; endKey: string; label: string }> = [];
      const inKeys = timeFields.filter(f => f.key.includes('in') || f.key.includes('start') || f.key.includes('from'));
      const outKeys = timeFields.filter(f => f.key.includes('out') || f.key.includes('end') || f.key.includes('to'));

      if (inKeys.length > 0 && outKeys.length > 0) {
        pairs.push({
          startKey: inKeys[0].key,
          endKey: outKeys[0].key,
          label: `Duration (${inKeys[0].label} → ${outKeys[0].label})`,
        });
      } else if (timeFields.length >= 2) {
        pairs.push({
          startKey: timeFields[0].key,
          endKey: timeFields[1].key,
          label: `Duration (${timeFields[0].label} → ${timeFields[1].label})`,
        });
      }

      pairs.forEach((pair) => {
        const durations: number[] = [];
        filteredLogs.forEach((log: any) => {
          const startVal = log.attributes?.[pair.startKey];
          const endVal = log.attributes?.[pair.endKey];
          const startMins = parseTimeToMinutes(startVal);
          const endMins = parseTimeToMinutes(endVal);

          if (startMins !== null && endMins !== null) {
            let diff = endMins - startMins;
            if (diff < 0) diff += 24 * 60;
            durations.push(diff / 60);
          }
        });

        if (durations.length > 0) {
          const sum = durations.reduce((acc, n) => acc + n, 0);
          const min = Math.min(...durations);
          const max = Math.max(...durations);
          const avg = sum / durations.length;
          fieldStats.push({
            key: `duration_${pair.startKey}_${pair.endKey}`,
            label: pair.label,
            type: 'duration',
            count: durations.length,
            sum,
            avg,
            min,
            max,
          });
        }
      });
    }

    return {
      totalLogs: filteredLogs.length,
      categoryBreakdownCount: new Set(filteredLogs.map((l: any) => l.categoryName || 'General')).size,
      fieldStats,
    };
  }, [dynamicColumns, filteredLogs]);

  const formatMetric = (val: number, type: string) => {
    if (type === 'currency') {
      return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (type === 'duration') {
      const hours = Math.floor(val);
      const minutes = Math.round((val - hours) * 60);
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
    return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
  };

  const handleExport = (format: 'csv' | 'xlsx' | 'json') => {
    const filePrefix = activeCategoryObj
      ? activeCategoryObj.name.toLowerCase().replace(/\s+/g, '_')
      : 'all_logs';
    const dateStamp = new Date().toISOString().split('T')[0];

    // JSON Export format
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
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
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
      if (!selectedCategory) {
        baseRow['Category'] = log.categoryName || 'General';
      }
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
    const sheetName = activeCategoryObj ? activeCategoryObj.name.slice(0, 30) : 'All Logs';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    if (format === 'csv') {
      XLSX.writeFile(workbook, `${filePrefix}_${dateStamp}.csv`, { bookType: 'csv' });
    } else {
      XLSX.writeFile(workbook, `${filePrefix}_${dateStamp}.xlsx`, { bookType: 'xlsx' });
    }
  };

  const renderSortIcon = (key: string) => {
    const idx = sortConfigs.findIndex((s) => s.key === key);
    if (idx === -1) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-300" />;
    const config = sortConfigs[idx];
    return (
      <span className="inline-flex items-center gap-0.5 text-blue-600">
        {config.direction === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
        {sortConfigs.length > 1 && (
          <span className="text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full px-1">
            {idx + 1}
          </span>
        )}
      </span>
    );
  };

  const handleResizeMouseDown = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = columnWidths[key] || 160;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startX;
      const newWidth = Math.max(90, startWidth + diff);
      setColumnWidths((prev) => ({ ...prev, [key]: newWidth }));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col space-y-4 px-2 sm:px-4 pb-12">
      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-sm sm:text-xl font-bold tracking-tight text-gray-900">Insights & Analytics</h1>
        </div>

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

      {/* Filter & Scope Bar (1/3 width for Dates, 2/3 width for Category Scope & Filter Records) */}
      <div className="bg-white border border-blue-100 rounded-2xl p-3 sm:p-4 shadow-2xs grid grid-cols-1 lg:grid-cols-12 gap-3 shrink-0 box-border items-center">
        
        {/* Category Scope & Filter Records (Takes 8/12 cols = 2/3 width) */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
          <div className="min-w-0 flex flex-col justify-center">
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1 truncate shrink-0">
              Category Scope
            </label>
            <div className="relative flex items-center w-full h-11 bg-blue-50/30 border border-blue-100 rounded-xl px-3 focus-within:bg-white focus-within:border-blue-500 box-border">
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSortConfigs([{ key: 'timestamp', direction: 'desc' }]);
                }}
                style={{ fontSize: '16px' }}
                className="w-full bg-transparent text-gray-800 focus:outline-none cursor-pointer text-xs sm:text-sm appearance-none border-none shadow-none m-0 p-0 pr-8 truncate"
              >
                <option value="">All Categories (Cross-Category)</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.icon ? `${cat.icon} ${cat.name}` : cat.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 pointer-events-none text-gray-400 flex items-center">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="min-w-0 flex flex-col justify-center">
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1 truncate shrink-0">
              Filter Records
            </label>
            <div className="relative flex items-center w-full h-11 bg-blue-50/30 border border-blue-100 rounded-xl px-3.5 focus-within:bg-white focus-within:border-blue-500 box-border">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Title, tags, attributes..."
                style={{ fontSize: '16px' }}
                className="w-full bg-transparent text-gray-900 focus:outline-none text-xs sm:text-sm border-none shadow-none m-0 p-0"
              />
            </div>
          </div>
        </div>

        {/* From Date & To Date (Takes 4/12 cols = 1/3 width, forced smaller inline font size) */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-2 min-w-0 box-border">
          <div className="min-w-0 flex flex-col justify-center">
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1 truncate shrink-0">
              From Date
            </label>
            <div className="relative flex items-center w-full h-11 bg-blue-50/30 border border-blue-100 rounded-xl px-2.5 focus-within:bg-white focus-within:border-blue-500 box-border overflow-hidden">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                onClick={(e) => {
                  try {
                    (e.target as HTMLInputElement).showPicker?.();
                  } catch (err) {}
                }}
                style={{
                  fontSize: '14px',
                  colorScheme: 'light',
                }}
                className={`w-full bg-transparent text-gray-800 focus:outline-none tracking-tight border-none shadow-none m-0 p-0 block truncate ${dateFrom ? 'pr-6' : 'pr-1'} [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden`}
              />
              {dateFrom && (
                <button
                  type="button"
                  onClick={() => setDateFrom('')}
                  className="absolute right-2 text-gray-400 hover:text-gray-600 text-sm font-bold cursor-pointer p-1 z-10 bg-transparent"
                  aria-label="Clear date"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="min-w-0 flex flex-col justify-center">
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1 truncate shrink-0">
              To Date
            </label>
            <div className="relative flex items-center w-full h-11 bg-blue-50/30 border border-blue-100 rounded-xl px-2.5 focus-within:bg-white focus-within:border-blue-500 box-border overflow-hidden">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                onClick={(e) => {
                  try {
                    (e.target as HTMLInputElement).showPicker?.();
                  } catch (err) {}
                }}
                style={{
                  fontSize: '14px',
                  colorScheme: 'light',
                }}
                className={`w-full bg-transparent text-gray-800 focus:outline-none tracking-tight border-none shadow-none m-0 p-0 block truncate ${dateTo ? 'pr-6' : 'pr-1'} [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden`}
              />
              {dateTo && (
                <button
                  type="button"
                  onClick={() => setDateTo('')}
                  className="absolute right-2 text-gray-400 hover:text-gray-600 text-sm font-bold cursor-pointer p-1 z-10 bg-transparent"
                  aria-label="Clear date"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Aggregate Summary Cards with overflow prevention */}
      <div className="space-y-2 shrink-0">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
          <Calculator className="w-4 h-4 text-blue-600" />
          <span>Summary & Field Aggregations</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-blue-100 rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col justify-between min-w-0 overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase truncate">Matching Logs</span>
              <Layers className="w-4 h-4 text-blue-500 shrink-0" />
            </div>
            <div className="mt-2 sm:mt-3 min-w-0">
              <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 truncate block">{aggregates.totalLogs}</span>
              <span className="text-[11px] sm:text-xs text-gray-400 truncate block mt-0.5">
                across {aggregates.categoryBreakdownCount}{' '}
                {aggregates.categoryBreakdownCount === 1 ? 'category' : 'categories'}
              </span>
            </div>
          </div>

          {aggregates.fieldStats.map((stat) => (
            <div
              key={stat.key}
              className="bg-white border border-blue-100 rounded-2xl p-3 sm:p-4 shadow-2xs space-y-2 flex flex-col justify-between min-w-0 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-xs font-bold text-gray-800 truncate flex items-center gap-1 min-w-0">
                  {stat.type === 'duration' && <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                  <span className="truncate">{stat.label}</span>
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 shrink-0 whitespace-nowrap">
                  n = {stat.count}
                </span>
              </div>

              {stat.type === 'boolean' ? (
                <div className="grid grid-cols-2 gap-2 pt-1 min-w-0">
                  <div className="min-w-0">
                    <span className="block text-[10px] text-gray-400 uppercase truncate">Checked</span>
                    <span className="text-base sm:text-lg font-bold text-gray-900 truncate block">
                      {stat.trueCount} / {stat.count}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] text-gray-400 uppercase truncate">Rate</span>
                    <span className="text-base sm:text-lg font-bold text-blue-600 truncate block">{stat.avg.toFixed(1)}%</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-xs min-w-0">
                  <div className="min-w-0">
                    <span className="text-gray-400 block text-[10px] uppercase truncate">
                      {stat.type === 'duration' ? 'Total Time' : 'Sum'}
                    </span>
                    <span className="font-bold text-gray-900 text-xs sm:text-sm truncate block" title={String(formatMetric(stat.sum, stat.type))}>
                      {formatMetric(stat.sum, stat.type)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-gray-400 block text-[10px] uppercase truncate">Average</span>
                    <span className="font-bold text-gray-900 text-xs sm:text-sm truncate block" title={String(formatMetric(stat.avg, stat.type))}>
                      {formatMetric(stat.avg, stat.type)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-gray-400 block text-[10px] uppercase truncate">Min</span>
                    <span className="font-bold text-gray-900 text-xs sm:text-sm truncate block" title={String(formatMetric(stat.min, stat.type))}>
                      {formatMetric(stat.min, stat.type)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-gray-400 block text-[10px] uppercase truncate">Max</span>
                    <span className="font-bold text-gray-900 text-xs sm:text-sm truncate block" title={String(formatMetric(stat.max, stat.type))}>
                      {formatMetric(stat.max, stat.type)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Data Table Container with Pagination at Top */}
      <div className="bg-white border border-blue-100 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Pagination & Record Count Header Bar */}
        <div className="px-4 sm:px-6 py-3 border-b border-blue-100 bg-white flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-500">
            <strong className="text-gray-800">{sortedLogs.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0}</strong> to{' '}
            <strong className="text-gray-800">{Math.min(currentPage * rowsPerPage, sortedLogs.length)}</strong> of{' '}
            <strong className="text-gray-800">{sortedLogs.length}</strong>
            {totalPages > 1 && (
              <span className="ml-2 text-gray-400">
                (Page <strong className="text-gray-700">{currentPage}</strong> of <strong className="text-gray-700">{totalPages}</strong>)
              </span>
            )}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              aria-label="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Table Content */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-blue-100 bg-blue-50/40 text-gray-600 uppercase text-[11px] font-bold tracking-wider">
                {!selectedCategory && (
                  <th
                    style={{ width: columnWidths['category'] || 160 }}
                    className="relative px-4 py-3 select-none group"
                  >
                    <div
                      onClick={(e) => handleSort('category', e)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <span>Category</span>
                      {renderSortIcon('category')}
                    </div>
                    <div
                      onMouseDown={(e) => handleResizeMouseDown('category', e)}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors"
                    />
                  </th>
                )}

                <th
                  style={{ width: columnWidths['title'] || 180 }}
                  className="relative px-4 py-3 select-none group"
                >
                  <div
                    onClick={(e) => handleSort('title', e)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span>Title</span>
                    {renderSortIcon('title')}
                  </div>
                  <div
                    onMouseDown={(e) => handleResizeMouseDown('title', e)}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors"
                  />
                </th>

                {dynamicColumns.map((col) => (
                  <th
                    key={col.key}
                    style={{ width: columnWidths[col.key] || 150 }}
                    className="relative px-4 py-3 select-none group"
                  >
                    <div
                      onClick={(e) => handleSort(col.key, e)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">{col.label}</span>
                      {renderSortIcon(col.key)}
                    </div>
                    <div
                      onMouseDown={(e) => handleResizeMouseDown(col.key, e)}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors"
                    />
                  </th>
                ))}

                <th
                  style={{ width: columnWidths['tags'] || 140 }}
                  className="relative px-4 py-3 select-none group"
                >
                  <div
                    onClick={(e) => handleSort('tags', e)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span>Tags</span>
                    {renderSortIcon('tags')}
                  </div>
                  <div
                    onMouseDown={(e) => handleResizeMouseDown('tags', e)}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors"
                  />
                </th>

                <th
                  style={{ width: columnWidths['timestamp'] || 180 }}
                  className="relative px-4 py-3 select-none group"
                >
                  <div
                    onClick={(e) => handleSort('timestamp', e)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span>Last Modified</span>
                    {renderSortIcon('timestamp')}
                  </div>
                  <div
                    onMouseDown={(e) => handleResizeMouseDown('timestamp', e)}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors"
                  />
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-blue-50 bg-white">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={(!selectedCategory ? 1 : 0) + 2 + dynamicColumns.length + 1}
                    className="px-6 py-12 text-center text-sm text-gray-400"
                  >
                    No matching records found.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log: any) => {
                  const isSelected = selectedRowId === log._id;
                  return (
                    <tr
                      key={log._id}
                      onClick={() => setSelectedRowId(isSelected ? null : log._id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-100/70 border-blue-200'
                          : 'hover:bg-blue-50/40'
                      }`}
                    >
                      {!selectedCategory && (
                        <td className="px-4 py-3 text-xs sm:text-sm text-gray-700 truncate">
                          {log.categoryName || 'General'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs sm:text-sm font-medium text-gray-900 truncate">
                        {log.title}
                      </td>
                      {dynamicColumns.map((col) => {
                        const val = log.attributes?.[col.key];
                        let displayVal = val ?? '';
                        if (typeof val === 'boolean') {
                          displayVal = val ? 'Yes' : 'No';
                        }
                        return (
                          <td key={col.key} className="px-4 py-3 text-xs sm:text-sm text-gray-700 truncate">
                            {String(displayVal)}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-xs sm:text-sm text-gray-500 truncate">
                        {(log.tags || []).join(', ')}
                      </td>
                      <td className="px-4 py-3 text-xs sm:text-sm text-gray-400 whitespace-nowrap">
                        {getLogTimestamp(log).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}