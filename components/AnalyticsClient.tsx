'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  FileSpreadsheet,
  FileJson,
  Calculator,
  Layers,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  PieChart as PieChartIcon,
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

interface CategoryBreakdownItem {
  categoryName: string;
  count: number;
}

interface FieldCategoryContribution {
  categoryName: string;
  count: number;
  sum: number;
  contributionPct: number;
  trueCount?: number;
  rate?: number;
}

interface FieldStat {
  key: string;
  label: string;
  type: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  trueCount?: number;
  byCategory: FieldCategoryContribution[];
}

const PIE_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
];

function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians),
  };
}

function describePieSlice(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
) {
  const clampedSweep = Math.min(359.999, Math.max(0, endAngle - startAngle));
  const actualEnd = startAngle + clampedSweep;
  const start = polarToCartesian(cx, cy, r, actualEnd);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = clampedSweep > 180 ? '1' : '0';

  return [
    'M',
    cx,
    cy,
    'L',
    end.x,
    end.y,
    'A',
    r,
    r,
    0,
    largeArcFlag,
    1,
    start.x,
    start.y,
    'Z',
  ].join(' ');
}

export default function AnalyticsClient({ userId }: AnalyticsClientProps) {
  const [categories, setCategories] = useState<CategoryTemplate[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters: empty array = All Categories (Cross-Category)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Selected field key for pie chart visualization
  const [selectedPieFieldKey, setSelectedPieFieldKey] = useState<string>('');
  const [hoveredSliceIndex, setHoveredSliceIndex] = useState<number | null>(null);

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

  // Close category dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleCategory = useCallback((categoryId: string) => {
    if (!categoryId) return;
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
    setSortConfigs([{ key: 'timestamp', direction: 'desc' }]);
  }, []);

  // Single selected category object (when exactly 1 category is checked)
  const singleCategoryObj = useMemo(
    () =>
      selectedCategories.length === 1
        ? categories.find((c) => c._id === selectedCategories[0])
        : undefined,
    [categories, selectedCategories]
  );

  // Helper to extract the actual system timestamp for 'Last Modified'
  const getLogTimestamp = useCallback((log: any): Date => {
    return new Date(log.timestamp || log.loggedAt || log.createdAt);
  }, []);

  // Helper to extract the effective date for date-range filtering
  const getLogEffectiveDate = useCallback(
    (log: any): Date => {
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
    },
    [getLogTimestamp]
  );

  // Filter logs across selected categories, search, and smart date range
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

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategories, searchQuery, dateFrom, dateTo]);

  // Discover dynamic columns (single category schema, or merged across multi-category selection)
  const dynamicColumns = useMemo(() => {
    if (singleCategoryObj?.fields && singleCategoryObj.fields.length > 0) {
      return singleCategoryObj.fields.map((f: any) => ({
        key: f.name || f.key || '',
        label: f.label || f.name || '',
        type: f.fieldType || f.type || 'text',
      }));
    }

    const keyMap = new Map<string, { key: string; label: string; type: string }>();

    const relevantCats =
      selectedCategories.length > 0
        ? categories.filter((c) => selectedCategories.includes(c._id))
        : categories;

    relevantCats.forEach((cat: any) => {
      cat.fields?.forEach((f: any) => {
        const key = f.name || f.key || '';
        if (key && !keyMap.has(key)) {
          keyMap.set(key, {
            key,
            label: f.label || f.name || key,
            type: f.fieldType || f.type || 'text',
          });
        }
      });
    });

    filteredLogs.forEach((log: any) => {
      if (log.attributes) {
        Object.entries(log.attributes).forEach(([k, val]) => {
          if (!keyMap.has(k)) {
            const isNum =
              typeof val === 'number' ||
              (typeof val === 'string' &&
                val.trim() !== '' &&
                !isNaN(Number(val.replace(/,/g, ''))));
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
  }, [singleCategoryObj, selectedCategories, categories, filteredLogs]);

  const getCellValue = useCallback(
    (log: any, colKey: string) => {
      if (colKey === 'title') return log.title || '';
      if (colKey === 'category') return log.categoryName || 'General';
      if (colKey === 'timestamp') {
        return getLogTimestamp(log).getTime();
      }
      if (colKey === 'tags') return (log.tags || []).join(', ');
      return log.attributes?.[colKey] ?? '';
    },
    [getLogTimestamp]
  );

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

  const formatMetric = useCallback((val: number, type: string) => {
    if (type === 'currency') {
      return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (type === 'duration') {
      const hours = Math.floor(val);
      const minutes = Math.round((val - hours) * 60);
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
    return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
  }, []);

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

  const aggregates = useMemo(() => {
    const catCountMap = new Map<string, number>();
    filteredLogs.forEach((log: any) => {
      const catName = log.categoryName || 'General';
      catCountMap.set(catName, (catCountMap.get(catName) || 0) + 1);
    });

    const totalLogsCount = filteredLogs.length;
    const categoryBreakdown: CategoryBreakdownItem[] = Array.from(catCountMap.entries())
      .map(([categoryName, count]) => ({
        categoryName,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    const fieldStats: FieldStat[] = [];

    dynamicColumns.forEach((col) => {
      if (col.type === 'checkbox' || col.type === 'boolean') {
        let trueCount = 0;
        let total = 0;
        const perCatBool = new Map<string, { trueCount: number; total: number }>();

        filteredLogs.forEach((log: any) => {
          if (log.attributes && col.key in log.attributes) {
            const catName = log.categoryName || 'General';
            const checkedVal = Boolean(log.attributes[col.key]);
            total++;
            if (checkedVal) trueCount++;

            const current = perCatBool.get(catName) || { trueCount: 0, total: 0 };
            current.total++;
            if (checkedVal) current.trueCount++;
            perCatBool.set(catName, current);
          }
        });

        if (total > 0) {
          const totalCheckedAcrossCats = trueCount;
          const byCategory: FieldCategoryContribution[] = Array.from(perCatBool.entries())
            .map(([categoryName, stats]) => ({
              categoryName,
              count: stats.total,
              sum: stats.trueCount,
              contributionPct:
                totalCheckedAcrossCats > 0
                  ? (stats.trueCount / totalCheckedAcrossCats) * 100
                  : total > 0
                    ? (stats.total / total) * 100
                    : 0,
              trueCount: stats.trueCount,
              rate: stats.total > 0 ? (stats.trueCount / stats.total) * 100 : 0,
            }))
            .sort((a, b) => b.contributionPct - a.contributionPct);

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
            byCategory,
          });
        }
        return;
      }

      const nums: number[] = [];
      const perCatNum = new Map<string, { sum: number; count: number }>();

      filteredLogs.forEach((log: any) => {
        const val = log.attributes?.[col.key];
        const parsed = parseNumeric(val);
        if (parsed !== null) {
          const catName = log.categoryName || 'General';
          nums.push(parsed);

          const current = perCatNum.get(catName) || { sum: 0, count: 0 };
          current.sum += parsed;
          current.count += 1;
          perCatNum.set(catName, current);
        }
      });

      if (nums.length > 0) {
        const sum = nums.reduce((acc, n) => acc + n, 0);
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        const avg = sum / nums.length;

        const byCategory: FieldCategoryContribution[] = Array.from(perCatNum.entries())
          .map(([categoryName, stats]) => ({
            categoryName,
            count: stats.count,
            sum: stats.sum,
            contributionPct: sum !== 0 ? (stats.sum / sum) * 100 : 0,
          }))
          .sort((a, b) => b.sum - a.sum);

        fieldStats.push({
          key: col.key,
          label: col.label,
          type: col.type,
          count: nums.length,
          sum,
          avg,
          min,
          max,
          byCategory,
        });
      }
    });

    // Duration pairing
    const timeFields = dynamicColumns.filter(
      (c) =>
        c.type === 'time' ||
        c.key.includes('time') ||
        c.key.includes('in') ||
        c.key.includes('out') ||
        c.key.includes('start') ||
        c.key.includes('end')
    );

    if (timeFields.length >= 2) {
      const pairs: Array<{ startKey: string; endKey: string; label: string }> = [];
      const inKeys = timeFields.filter(
        (f) => f.key.includes('in') || f.key.includes('start') || f.key.includes('from')
      );
      const outKeys = timeFields.filter(
        (f) => f.key.includes('out') || f.key.includes('end') || f.key.includes('to')
      );

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
        const perCatDur = new Map<string, { sum: number; count: number }>();

        filteredLogs.forEach((log: any) => {
          const startVal = log.attributes?.[pair.startKey];
          const endVal = log.attributes?.[pair.endKey];
          const startMins = parseTimeToMinutes(startVal);
          const endMins = parseTimeToMinutes(endVal);

          if (startMins !== null && endMins !== null) {
            let diff = endMins - startMins;
            if (diff < 0) diff += 24 * 60;
            const hours = diff / 60;
            const catName = log.categoryName || 'General';

            durations.push(hours);

            const current = perCatDur.get(catName) || { sum: 0, count: 0 };
            current.sum += hours;
            current.count += 1;
            perCatDur.set(catName, current);
          }
        });

        if (durations.length > 0) {
          const sum = durations.reduce((acc, n) => acc + n, 0);
          const min = Math.min(...durations);
          const max = Math.max(...durations);
          const avg = sum / durations.length;

          const byCategory: FieldCategoryContribution[] = Array.from(perCatDur.entries())
            .map(([categoryName, stats]) => ({
              categoryName,
              count: stats.count,
              sum: stats.sum,
              contributionPct: sum !== 0 ? (stats.sum / sum) * 100 : 0,
            }))
            .sort((a, b) => b.sum - a.sum);

          fieldStats.push({
            key: `duration_${pair.startKey}_${pair.endKey}`,
            label: pair.label,
            type: 'duration',
            count: durations.length,
            sum,
            avg,
            min,
            max,
            byCategory,
          });
        }
      });
    }

    return {
      totalLogs: totalLogsCount,
      categoryBreakdownCount: categoryBreakdown.length,
      categoryBreakdown,
      fieldStats,
    };
  }, [dynamicColumns, filteredLogs]);

  // Keep selectedPieFieldKey synced to an available fieldStat
  useEffect(() => {
    if (aggregates.fieldStats.length === 0) {
      setSelectedPieFieldKey('');
      return;
    }
    const stillExists = aggregates.fieldStats.some((f) => f.key === selectedPieFieldKey);
    if (!stillExists) {
      setSelectedPieFieldKey(aggregates.fieldStats[0].key);
    }
  }, [aggregates.fieldStats, selectedPieFieldKey]);

  const activePieField = useMemo(
    () =>
      aggregates.fieldStats.find((f) => f.key === selectedPieFieldKey) ||
      aggregates.fieldStats[0],
    [aggregates.fieldStats, selectedPieFieldKey]
  );

  // Build pie chart slices from the active aggregation field's category contributions
  const pieSlices = useMemo(() => {
    if (!isMultiCategoryScope) return [];

    if (activePieField && activePieField.byCategory.length > 0) {
      const positiveItems = activePieField.byCategory.filter((c) => c.contributionPct > 0);
      const sourceItems =
        positiveItems.length > 0 ? positiveItems : activePieField.byCategory;
      const totalPct = sourceItems.reduce((acc, item) => acc + item.contributionPct, 0);

      let currentAngle = 0;
      return sourceItems.map((item, idx) => {
        const normalizedPct =
          totalPct > 0 ? (item.contributionPct / totalPct) * 100 : 100 / sourceItems.length;
        const sweep = (normalizedPct / 100) * 360;
        const slice = {
          label: item.categoryName,
          valueLabel:
            activePieField.type === 'boolean'
              ? `${item.trueCount}/${item.count}`
              : formatMetric(item.sum, activePieField.type),
          percentage: item.contributionPct,
          startAngle: currentAngle,
          endAngle: currentAngle + sweep,
          color: PIE_COLORS[idx % PIE_COLORS.length],
        };
        currentAngle += sweep;
        return slice;
      });
    }

    if (aggregates.categoryBreakdown.length > 0 && aggregates.totalLogs > 0) {
      let currentAngle = 0;
      return aggregates.categoryBreakdown.map((item, idx) => {
        const pct = (item.count / aggregates.totalLogs) * 100;
        const sweep = (pct / 100) * 360;
        const slice = {
          label: item.categoryName,
          valueLabel: `${item.count} logs`,
          percentage: pct,
          startAngle: currentAngle,
          endAngle: currentAngle + sweep,
          color: PIE_COLORS[idx % PIE_COLORS.length],
        };
        currentAngle += sweep;
        return slice;
      });
    }

    return [];
  }, [
    isMultiCategoryScope,
    activePieField,
    aggregates.categoryBreakdown,
    aggregates.totalLogs,
    formatMetric,
  ]);

  const getScopeLabel = () => {
    if (selectedCategories.length === 0) return 'All Categories (Cross-Category)';
    if (selectedCategories.length === 1) {
      const cat = categories.find((c) => c._id === selectedCategories[0]);
      return cat ? (cat.icon ? `${cat.icon} ${cat.name}` : cat.name) : '1 Category';
    }
    return `${selectedCategories.length} Categories Selected`;
  };

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
      if (showCategoryColumn) {
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

  const tableColumns = useMemo(() => {
    const cols: Array<{ key: string; label: string; type?: string }> = [
      { key: 'title', label: 'Title' },
    ];
    if (showCategoryColumn) {
      cols.push({ key: 'category', label: 'Category' });
    }
    dynamicColumns.forEach((c) => cols.push(c));
    cols.push({ key: 'tags', label: 'Tags' });
    cols.push({ key: 'timestamp', label: 'Last Modified' });
    return cols;
  }, [showCategoryColumn, dynamicColumns]);

  const hoveredSlice =
    hoveredSliceIndex !== null ? pieSlices[hoveredSliceIndex] ?? null : null;

  // Each row naturally sizes to its tallest card, capped at 380px
  const cardRowCapClass = 'h-full max-h-[380px]';

  return (
    <div className="max-w-7xl mx-auto flex flex-col space-y-4 px-2 sm:px-4 pb-12">
      <style jsx>{`
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
      `}</style>

      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-sm sm:text-xl font-bold tracking-tight text-gray-900">
            Insights & Analytics
          </h1>
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

      {/* Filter & Scope Bar */}
      <div className="bg-white border border-blue-100 rounded-2xl p-3 sm:p-4 shadow-2xs grid grid-cols-1 lg:grid-cols-12 gap-3 shrink-0 box-border items-center">
        {/* Category Scope & Filter Records (8/12 cols) */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
          {/* Multi-Select Native Checkbox Dropdown for Category Scope */}
          <div ref={categoryDropdownRef} className="relative min-w-0 flex flex-col justify-center">
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1 truncate shrink-0">
              Category Scope
            </label>
            <button
              type="button"
              onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
              className="relative flex items-center justify-between w-full h-11 bg-blue-50/30 hover:bg-blue-50/60 border border-blue-100 focus:bg-white focus:border-blue-500 rounded-xl px-3 text-left cursor-pointer transition-colors"
            >
              <span className="text-xs sm:text-sm text-gray-800 truncate pr-6">
                {getScopeLabel()}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${
                  isCategoryDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isCategoryDropdownOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 top-full mt-1.5 w-full min-w-[240px] bg-white border border-blue-100 rounded-xl shadow-xl z-30 p-2 space-y-1"
              >
                <div className="flex items-center justify-between px-2 py-1 border-b border-gray-100 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategories(categories.map((c) => c._id).filter(Boolean));
                      setSortConfigs([{ key: 'timestamp', direction: 'desc' }]);
                    }}
                    className="font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategories([]);
                      setSortConfigs([{ key: 'timestamp', direction: 'desc' }]);
                    }}
                    className="font-medium text-gray-500 hover:text-gray-700 hover:underline cursor-pointer"
                  >
                    All Categories (Clear)
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto analytics-scrollbar divide-y divide-gray-50 pt-1">
                  {categories.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-gray-400 text-center">
                      No categories found
                    </p>
                  ) : (
                    categories.map((cat) => {
                      const isChecked = selectedCategories.includes(cat._id);
                      return (
                        <label
                          key={cat._id}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs sm:text-sm text-gray-800 hover:bg-blue-50/50 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleCategory(cat._id);
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0 accent-blue-600"
                          />
                          <span className="truncate">
                            {cat.icon ? `${cat.icon} ${cat.name}` : cat.name}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
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

        {/* From Date & To Date (4/12 cols) */}
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
                className={`w-full bg-transparent text-gray-800 focus:outline-none tracking-tight border-none shadow-none m-0 p-0 block truncate ${
                  dateFrom ? 'pr-6' : 'pr-1'
                } [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden`}
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
                className={`w-full bg-transparent text-gray-800 focus:outline-none tracking-tight border-none shadow-none m-0 p-0 block truncate ${
                  dateTo ? 'pr-6' : 'pr-1'
                } [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden`}
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

      {/* Summary & Field Aggregations (Max 3 cards per row, row-matched height capped at 380px) */}
      <div className="space-y-2 shrink-0">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
          <Calculator className="w-4 h-4 text-blue-600" />
          <span>Summary & Field Aggregations</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-max items-stretch gap-4">
          {/* Matching Logs Card */}
          <div
            className={`bg-white border border-blue-100 rounded-2xl p-4 shadow-2xs flex flex-col min-w-0 overflow-hidden ${cardRowCapClass}`}
          >
            <div className="shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase truncate">
                  Matching Logs
                </span>
                <Layers className="w-4 h-4 text-blue-500 shrink-0" />
              </div>
              <div className="mt-2 min-w-0">
                <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 truncate block">
                  {aggregates.totalLogs}
                </span>
                <span className="text-[11px] sm:text-xs text-gray-400 truncate block mt-0.5">
                  across {aggregates.categoryBreakdownCount}{' '}
                  {aggregates.categoryBreakdownCount === 1 ? 'category' : 'categories'}
                </span>
              </div>
            </div>

            {isMultiCategoryScope && aggregates.categoryBreakdown.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between mb-1.5 pr-2.5 shrink-0">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">
                    By Category
                  </span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">
                    Logs
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto analytics-scrollbar space-y-1.5 pr-2 min-h-0">
                  {aggregates.categoryBreakdown.map((item) => (
                    <div
                      key={item.categoryName}
                      className="flex items-center justify-between text-xs gap-2 min-w-0"
                    >
                      <span className="font-medium text-gray-700 truncate">
                        {item.categoryName}
                      </span>
                      <span className="text-gray-600 font-semibold shrink-0 whitespace-nowrap">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Field Aggregation Cards */}
          {aggregates.fieldStats.map((stat) => (
            <div
              key={stat.key}
              className={`bg-white border border-blue-100 rounded-2xl p-4 shadow-2xs flex flex-col min-w-0 overflow-hidden ${cardRowCapClass}`}
            >
              <div className="shrink-0 space-y-2">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-xs font-bold text-gray-800 truncate flex items-center gap-1 min-w-0">
                    {stat.type === 'duration' && (
                      <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    )}
                    <span className="truncate">{stat.label}</span>
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 shrink-0 whitespace-nowrap">
                    n = {stat.count}
                  </span>
                </div>

                {stat.type === 'boolean' ? (
                  <div className="grid grid-cols-2 gap-2 pt-1 min-w-0">
                    <div className="min-w-0">
                      <span className="block text-[10px] text-gray-400 uppercase truncate">
                        Checked
                      </span>
                      <span className="text-base sm:text-lg font-bold text-gray-900 truncate block">
                        {stat.trueCount} / {stat.count}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] text-gray-400 uppercase truncate">
                        Rate
                      </span>
                      <span className="text-base sm:text-lg font-bold text-blue-600 truncate block">
                        {stat.avg.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-0.5 text-xs min-w-0">
                    <div className="min-w-0">
                      <span className="text-gray-400 block text-[10px] uppercase truncate">
                        {stat.type === 'duration' ? 'Total Time' : 'Sum'}
                      </span>
                      <span
                        className="font-bold text-gray-900 text-xs sm:text-sm truncate block"
                        title={String(formatMetric(stat.sum, stat.type))}
                      >
                        {formatMetric(stat.sum, stat.type)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-gray-400 block text-[10px] uppercase truncate">
                        Average
                      </span>
                      <span
                        className="font-bold text-gray-900 text-xs sm:text-sm truncate block"
                        title={String(formatMetric(stat.avg, stat.type))}
                      >
                        {formatMetric(stat.avg, stat.type)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-gray-400 block text-[10px] uppercase truncate">Min</span>
                      <span
                        className="font-bold text-gray-900 text-xs sm:text-sm truncate block"
                        title={String(formatMetric(stat.min, stat.type))}
                      >
                        {formatMetric(stat.min, stat.type)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-gray-400 block text-[10px] uppercase truncate">Max</span>
                      <span
                        className="font-bold text-gray-900 text-xs sm:text-sm truncate block"
                        title={String(formatMetric(stat.max, stat.type))}
                      >
                        {formatMetric(stat.max, stat.type)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {isMultiCategoryScope && stat.byCategory.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-col flex-1 min-h-0">
                  <div className="flex items-center justify-between mb-1.5 pr-2.5 shrink-0">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      By Category
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      % of total
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto analytics-scrollbar space-y-1.5 pr-2 min-h-0">
                    {stat.byCategory.map((contrib) => (
                      <div
                        key={contrib.categoryName}
                        className="flex items-center justify-between text-xs gap-2 min-w-0"
                      >
                        <span className="text-gray-600 truncate">{contrib.categoryName}</span>
                        <span className="font-semibold text-gray-800 shrink-0 whitespace-nowrap">
                          {stat.type === 'boolean'
                            ? `${contrib.trueCount}/${contrib.count} (${contrib.contributionPct.toFixed(1)}%)`
                            : `${formatMetric(contrib.sum, stat.type)} (${contrib.contributionPct.toFixed(1)}%)`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Contribution Pie Chart Card (Fits up to 4 legend items without scrolling within 380px cap) */}
          {isMultiCategoryScope && pieSlices.length > 0 && (
            <div
              className={`bg-white border border-blue-100 rounded-2xl p-4 shadow-2xs flex flex-col justify-between min-w-0 overflow-hidden ${cardRowCapClass}`}
            >
              <div className="flex items-center justify-between gap-2 min-w-0 shrink-0">
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5 shrink-0">
                  <PieChartIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Category Share</span>
                </span>
                {aggregates.fieldStats.length > 1 && (
                  <select
                    value={activePieField?.key || ''}
                    onChange={(e) => setSelectedPieFieldKey(e.target.value)}
                    aria-label="Pie chart metric"
                    style={{ fontSize: '12px' }}
                    className="h-7 text-xs font-semibold bg-blue-50/70 border border-blue-100 rounded-lg px-2 py-0 text-blue-700 focus:outline-none focus:border-blue-400 cursor-pointer max-w-[140px] truncate shrink-0"
                  >
                    {aggregates.fieldStats.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Centered pie chart above the legend */}
              <div className="flex items-center justify-center py-1 shrink-0">
                <svg viewBox="0 0 100 100" className="w-28 h-28 overflow-visible">
                  {pieSlices.map((slice, idx) => {
                    const isHovered = hoveredSliceIndex === idx;
                    const isFullCircle = slice.endAngle - slice.startAngle >= 359.9;
                    return isFullCircle ? (
                      <circle
                        key={slice.label}
                        cx="50"
                        cy="50"
                        r="45"
                        fill={slice.color}
                        onMouseEnter={() => setHoveredSliceIndex(idx)}
                        onMouseLeave={() => setHoveredSliceIndex(null)}
                        className="transition-opacity cursor-pointer"
                        style={{
                          opacity:
                            hoveredSliceIndex === null || isHovered ? 1 : 0.55,
                        }}
                      />
                    ) : (
                      <path
                        key={slice.label}
                        d={describePieSlice(50, 50, 45, slice.startAngle, slice.endAngle)}
                        fill={slice.color}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        onMouseEnter={() => setHoveredSliceIndex(idx)}
                        onMouseLeave={() => setHoveredSliceIndex(null)}
                        className="transition-opacity cursor-pointer"
                        style={{
                          opacity:
                            hoveredSliceIndex === null || isHovered ? 1 : 0.55,
                        }}
                      />
                    );
                  })}
                </svg>
              </div>

              {/* Scrollable full-width legend below the pie chart (room for up to 4 items before scroll) */}
              <div className="flex-1 overflow-y-auto analytics-scrollbar min-h-0 border-t border-gray-100 pt-1.5 pr-2 space-y-0.5">
                {pieSlices.map((slice, idx) => (
                  <div
                    key={slice.label}
                    onMouseEnter={() => setHoveredSliceIndex(idx)}
                    onMouseLeave={() => setHoveredSliceIndex(null)}
                    title={`${slice.label}: ${slice.valueLabel} (${slice.percentage.toFixed(1)}%)`}
                    className={`flex items-center justify-between text-xs gap-2 rounded px-1.5 py-0.5 cursor-pointer transition-colors ${
                      hoveredSliceIndex === idx ? 'bg-blue-50/70' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="text-gray-700 truncate">{slice.label}</span>
                    </div>
                    <span className="font-semibold text-gray-900 shrink-0 whitespace-nowrap">
                      {slice.percentage.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-gray-500 border-t border-gray-100 pt-1.5 mt-1 truncate shrink-0">
                {hoveredSlice ? (
                  <span>
                    <strong className="text-gray-800">{hoveredSlice.label}</strong>:{' '}
                    {hoveredSlice.valueLabel} ({hoveredSlice.percentage.toFixed(1)}%)
                  </span>
                ) : activePieField ? (
                  <span>
                    Based on <strong className="text-gray-700">{activePieField.label}</strong> total
                  </span>
                ) : (
                  <span>Based on matching log count</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Data Table Container with Pagination at Top */}
      <div className="bg-white border border-blue-100 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-4 sm:px-6 py-3 border-b border-blue-100 bg-white flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-500">
            <strong className="text-gray-800">
              {sortedLogs.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0}
            </strong>{' '}
            to{' '}
            <strong className="text-gray-800">
              {Math.min(currentPage * rowsPerPage, sortedLogs.length)}
            </strong>{' '}
            of <strong className="text-gray-800">{sortedLogs.length}</strong>
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
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
                        onClick={(e) => handleSort(col.key, e)}
                        className="inline-flex items-center gap-1.5 hover:text-blue-600 cursor-pointer uppercase"
                      >
                        <span>{col.label}</span>
                        {renderSortIcon(col.key)}
                      </button>
                      <div
                        onMouseDown={(e) => handleResizeMouseDown(col.key, e)}
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
                      onClick={() => setSelectedRowId(isSelected ? null : log._id)}
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
    </div>
  );
}