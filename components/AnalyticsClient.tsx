'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Download, FileSpreadsheet, FileJson, Layers, Clock, PieChart as PieChartIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getFilteredLogs } from '@/lib/actions/logActions';
import { getUserCategories } from '@/lib/actions/categoryActions';
import {
  getSavedViews,
  createSavedView,
  updateSavedView,
  renameSavedView,
  deleteSavedView,
  restoreSavedView,
} from '@/lib/actions/savedViewActions';
import { LogItem } from '@/components/LogCard';
import { CategoryTemplate } from '@/components/LogModal';
import SavedViewsBar from '@/components/analytics/SavedViewsBar';
import AnalyticsFilters from '@/components/analytics/AnalyticsFilters';
import SummaryCardsSection from '@/components/analytics/SummaryCardsSection';
import AnalyticsDataTable, { SortConfig } from '@/components/analytics/AnalyticsDataTable';
import CardExpandModal from '@/components/analytics/CardExpandModal';
import TimelineTrendCard from '@/components/analytics/TimelineTrendCard';
import FieldBreakdownCard from '@/components/analytics/FieldBreakdownCard';
import { AnalyticsCardKey, SavedAnalyticsView } from '@/lib/analytics/savedViews';
import {
  discoverDynamicColumns,
  computeAggregates,
  buildPieSlices,
  parseNumeric,
  formatMetric,
} from '@/lib/analytics/aggregations';
import { TrendGranularity } from '@/lib/analytics/timelineTrend';

export type ExpandedCardTarget =
  | { cardKey: 'matching_logs' }
  | { cardKey: 'field_stats'; fieldKey: string }
  | { cardKey: 'category_share' }
  | { cardKey: 'timeline_trend' }
  | { cardKey: 'field_breakdown' }
  | null;

interface AnalyticsClientProps {
  userId: string;
}

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

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [savedViews, setSavedViews] = useState<SavedAnalyticsView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [lastAppliedViewId, setLastAppliedViewId] = useState<string | null>(null);
  const [deletedView, setDeletedView] = useState<SavedAnalyticsView | null>(null);

  const [timelineGranularity, setTimelineGranularity] = useState<TrendGranularity>('day');
  const [timelineMetricKey, setTimelineMetricKey] = useState<string>('__count__');
  const [breakdownFieldKey, setBreakdownFieldKey] = useState<string>('');
  const [breakdownMetricKey, setBreakdownMetricKey] = useState<string>('');
  const [hiddenCardKeys, setHiddenCardKeys] = useState<AnalyticsCardKey[]>([]);

  const [expandedCard, setExpandedCard] = useState<ExpandedCardTarget>(null);
  const [modalHoveredSliceIndex, setModalHoveredSliceIndex] = useState<number | null>(null);

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
      const [fetchedCats, fetchedLogs, fetchedViews] = await Promise.all([
        getUserCategories(userId),
        getFilteredLogs({ userId }),
        getSavedViews(userId),
      ]);
      setCategories(fetchedCats || []);
      setLogs(fetchedLogs || []);
      setSavedViews(fetchedViews || []);
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

  const buildCurrentViewPayload = useCallback(
    () => ({
      selectedCategory: selectedCategories.join(','),
      selectedCategories,
      searchQuery,
      dateFrom,
      dateTo,
      sortConfigs,
      pieFieldKey: selectedPieFieldKey,
      timelineGranularity,
      timelineMetricKey,
      breakdownFieldKey,
      breakdownMetricKey,
      hiddenCardKeys,
    }),
    [
      selectedCategories,
      searchQuery,
      dateFrom,
      dateTo,
      sortConfigs,
      selectedPieFieldKey,
      timelineGranularity,
      timelineMetricKey,
      breakdownFieldKey,
      breakdownMetricKey,
      hiddenCardKeys,
    ]
  );

  const handleSaveCurrentView = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      try {
        const createdView = await createSavedView({
          userId,
          name: trimmed,
          ...buildCurrentViewPayload(),
        });
        setSavedViews((prev) => [createdView, ...prev]);
        setActiveViewId(createdView.id);
        setLastAppliedViewId(createdView.id);
      } catch (error) {
        console.error('Failed to save view:', error);
      }
    },
    [userId, buildCurrentViewPayload]
  );

  const handleUpdateView = useCallback(
    async (id: string) => {
      try {
        const updatedView = await updateSavedView(id, userId, buildCurrentViewPayload());
        setSavedViews((prev) => prev.map((v) => (v.id === id ? updatedView : v)));
        setActiveViewId(updatedView.id);
        setLastAppliedViewId(updatedView.id);
      } catch (error) {
        console.error('Failed to update view:', error);
      }
    },
    [userId, buildCurrentViewPayload]
  );

  const handleRenameView = useCallback(
    async (id: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      try {
        const updatedView = await renameSavedView(id, userId, trimmed);
        setSavedViews((prev) => prev.map((v) => (v.id === id ? updatedView : v)));
      } catch (error) {
        console.error('Failed to rename view:', error);
      }
    },
    [userId]
  );

  const handleApplyView = useCallback((view: SavedAnalyticsView) => {
    if (Array.isArray(view.selectedCategories)) {
      setSelectedCategories(view.selectedCategories);
    } else if (view.selectedCategory) {
      setSelectedCategories(view.selectedCategory.split(',').filter(Boolean));
    } else {
      setSelectedCategories([]);
    }

    setSearchQuery(view.searchQuery || '');
    setDateFrom(view.dateFrom || '');
    setDateTo(view.dateTo || '');
    setSortConfigs(
      view.sortConfigs && view.sortConfigs.length > 0
        ? (view.sortConfigs as SortConfig[])
        : [{ key: 'timestamp', direction: 'desc' }]
    );
    setSelectedPieFieldKey(view.pieFieldKey || '');
    setTimelineGranularity(view.timelineGranularity || 'day');
    setTimelineMetricKey(view.timelineMetricKey || '__count__');
    setBreakdownFieldKey(view.breakdownFieldKey || '');
    setBreakdownMetricKey(view.breakdownMetricKey || '');
    setHiddenCardKeys(Array.isArray(view.hiddenCardKeys) ? view.hiddenCardKeys : []);
    setCurrentPage(1);
    setActiveViewId(view.id);
    setLastAppliedViewId(view.id);
  }, []);

  const handleDeleteView = useCallback(
    async (id: string) => {
      const targetView = savedViews.find((v) => v.id === id) ?? null;
      try {
        await deleteSavedView(id, userId);
        setSavedViews((prev) => prev.filter((v) => v.id !== id));
        if (activeViewId === id) {
          setActiveViewId(null);
        }
        if (lastAppliedViewId === id) {
          setLastAppliedViewId(null);
        }
        if (targetView) {
          setDeletedView(targetView);
        }
      } catch (error) {
        console.error('Failed to delete view:', error);
      }
    },
    [userId, savedViews, activeViewId, lastAppliedViewId]
  );

  const handleUndoDelete = useCallback(async () => {
    if (!deletedView) return;
    const toRestore = deletedView;
    setDeletedView(null);
    try {
      const { id: _oldId, createdAt: _oldCreatedAt, ...payload } = toRestore;
      const restored = await restoreSavedView(userId, payload);
      setSavedViews((prev) => [restored, ...prev]);
    } catch (error) {
      console.error('Failed to restore saved view:', error);
    }
  }, [deletedView, userId]);

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
    setActiveViewId(null);
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
    if (aggregates.fieldStats.length === 0) return;
    if (!selectedPieFieldKey || !aggregates.fieldStats.some((f) => f.key === selectedPieFieldKey)) {
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

  const expandedFieldStat = useMemo(() => {
    if (!expandedCard || expandedCard.cardKey !== 'field_stats') return undefined;
    return aggregates.fieldStats.find((f) => f.key === expandedCard.fieldKey);
  }, [expandedCard, aggregates.fieldStats]);

  const modalTitle = useMemo(() => {
    if (!expandedCard) return '';
    switch (expandedCard.cardKey) {
      case 'matching_logs':
        return 'Matching Logs';
      case 'field_stats':
        return expandedFieldStat?.label || 'Field Stats';
      case 'category_share':
        return 'Category Share';
      case 'timeline_trend':
        return 'Timeline Trend';
      case 'field_breakdown':
        return 'Field Breakdown';
      default:
        return 'Analytics Card';
    }
  }, [expandedCard, expandedFieldStat]);

  const modalSubtitle = useMemo(() => {
    if (!expandedCard) return undefined;
    switch (expandedCard.cardKey) {
      case 'matching_logs':
        return `${aggregates.totalLogs} matching logs across ${aggregates.categoryBreakdownCount} ${
          aggregates.categoryBreakdownCount === 1 ? 'category' : 'categories'
        }`;
      case 'field_stats':
        return expandedFieldStat
          ? `Sample size n = ${expandedFieldStat.count}`
          : undefined;
      case 'category_share':
        return activePieField
          ? `Distribution by ${activePieField.label} total`
          : 'Distribution by matching log count';
      case 'timeline_trend':
        return `Grouped by ${timelineGranularity}`;
      case 'field_breakdown':
        return 'Breakdown across custom attributes and metrics';
      default:
        return undefined;
    }
  }, [expandedCard, aggregates, expandedFieldStat, activePieField, timelineGranularity]);

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

  const modalHoveredSlice =
    modalHoveredSliceIndex !== null ? pieSlices[modalHoveredSliceIndex] ?? null : null;

  return (
    <div className="max-w-7xl mx-auto flex flex-col space-y-4 px-2 sm:px-4 pb-12">
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

      <SavedViewsBar
        views={savedViews}
        activeViewId={activeViewId}
        lastAppliedViewId={lastAppliedViewId}
        deletedView={deletedView}
        onApplyView={handleApplyView}
        onSaveCurrentView={handleSaveCurrentView}
        onUpdateView={handleUpdateView}
        onRenameView={handleRenameView}
        onDeleteView={handleDeleteView}
        onUndoDelete={handleUndoDelete}
        onDismissUndoToast={() => setDeletedView(null)}
      />

      <AnalyticsFilters
        categories={categories}
        selectedCategories={selectedCategories}
        onToggleCategory={(id) => {
          if (!id) return;
          setActiveViewId(null);
          setSelectedCategories((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
          );
          setSortConfigs([{ key: 'timestamp', direction: 'desc' }]);
        }}
        onSelectAllCategories={() => {
          setActiveViewId(null);
          setSelectedCategories(categories.map((c) => c._id).filter(Boolean));
          setSortConfigs([{ key: 'timestamp', direction: 'desc' }]);
        }}
        onClearCategories={() => {
          setActiveViewId(null);
          setSelectedCategories([]);
          setSortConfigs([{ key: 'timestamp', direction: 'desc' }]);
        }}
        searchQuery={searchQuery}
        onSearchChange={(val) => {
          setActiveViewId(null);
          setSearchQuery(val);
        }}
        dateFrom={dateFrom}
        onDateFromChange={(val) => {
          setActiveViewId(null);
          setDateFrom(val);
        }}
        dateTo={dateTo}
        onDateToChange={(val) => {
          setActiveViewId(null);
          setDateTo(val);
        }}
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
        onSelectPieField={(key) => {
          setActiveViewId(null);
          setSelectedPieFieldKey(key);
        }}
        filteredLogs={filteredLogs}
        categories={categories}
        timelineGranularity={timelineGranularity}
        onTimelineGranularityChange={(val) => {
          setActiveViewId(null);
          setTimelineGranularity(val);
        }}
        timelineMetricKey={timelineMetricKey}
        onTimelineMetricChange={(val) => {
          setActiveViewId(null);
          setTimelineMetricKey(val);
        }}
        breakdownFieldKey={breakdownFieldKey}
        onBreakdownFieldChange={(val) => {
          setActiveViewId(null);
          setBreakdownFieldKey(val);
        }}
        breakdownMetricKey={breakdownMetricKey}
        onBreakdownMetricChange={(val) => {
          setActiveViewId(null);
          setBreakdownMetricKey(val);
        }}
        hiddenCardKeys={hiddenCardKeys}
        onHiddenCardKeysChange={(nextHidden) => {
          setActiveViewId(null);
          setHiddenCardKeys(nextHidden);
        }}
        onExpandCard={(target) => {
          setModalHoveredSliceIndex(null);
          setExpandedCard(target);
        }}
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

      <CardExpandModal
        isOpen={Boolean(expandedCard)}
        title={modalTitle}
        subtitle={modalSubtitle}
        onClose={() => setExpandedCard(null)}
      >
        {expandedCard?.cardKey === 'matching_logs' && (
          <div className="bg-white border border-blue-100 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xs">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase">
                  Total Matching Logs
                </span>
                <div className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-1">
                  {aggregates.totalLogs}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Across {aggregates.categoryBreakdownCount}{' '}
                  {aggregates.categoryBreakdownCount === 1 ? 'category' : 'categories'}
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-blue-600" />
              </div>
            </div>

            {aggregates.categoryBreakdown.length > 0 && (
              <div className="pt-4 border-t border-gray-100 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase">
                  <span>By Category</span>
                  <span>Logs</span>
                </div>
                <div className="divide-y divide-gray-100 max-h-[45vh] overflow-y-auto analytics-scrollbar pr-1">
                  {aggregates.categoryBreakdown.map((item) => (
                    <div
                      key={item.categoryName}
                      className="py-2.5 flex items-center justify-between text-sm gap-3"
                    >
                      <span className="font-medium text-gray-800 truncate">
                        {item.categoryName}
                      </span>
                      <span className="font-bold text-gray-900 shrink-0">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {expandedCard?.cardKey === 'field_stats' && expandedFieldStat && (
          <div className="bg-white border border-blue-100 rounded-2xl p-5 sm:p-6 space-y-6 shadow-2xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {expandedFieldStat.type === 'duration' && (
                  <Clock className="w-4 h-4 text-blue-500" />
                )}
                <span className="text-sm font-bold text-gray-800">
                  {expandedFieldStat.label}
                </span>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
                n = {expandedFieldStat.count}
              </span>
            </div>

            {expandedFieldStat.type === 'boolean' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100/70">
                  <span className="block text-xs text-gray-400 uppercase font-semibold">
                    Checked
                  </span>
                  <span className="text-2xl font-extrabold text-gray-900 mt-1 block">
                    {expandedFieldStat.trueCount} / {expandedFieldStat.count}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100/70">
                  <span className="block text-xs text-gray-400 uppercase font-semibold">
                    Rate
                  </span>
                  <span className="text-2xl font-extrabold text-blue-600 mt-1 block">
                    {expandedFieldStat.avg.toFixed(1)}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100/70">
                  <span className="text-gray-400 block text-xs uppercase font-semibold">
                    {expandedFieldStat.type === 'duration' ? 'Total Time' : 'Sum'}
                  </span>
                  <span className="font-extrabold text-gray-900 text-lg sm:text-xl mt-1 block">
                    {formatMetric(expandedFieldStat.sum, expandedFieldStat.type)}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100/70">
                  <span className="text-gray-400 block text-xs uppercase font-semibold">
                    Average
                  </span>
                  <span className="font-extrabold text-gray-900 text-lg sm:text-xl mt-1 block">
                    {formatMetric(expandedFieldStat.avg, expandedFieldStat.type)}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100/70">
                  <span className="text-gray-400 block text-xs uppercase font-semibold">
                    Min
                  </span>
                  <span className="font-extrabold text-gray-900 text-lg sm:text-xl mt-1 block">
                    {formatMetric(expandedFieldStat.min, expandedFieldStat.type)}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100/70">
                  <span className="text-gray-400 block text-xs uppercase font-semibold">
                    Max
                  </span>
                  <span className="font-extrabold text-gray-900 text-lg sm:text-xl mt-1 block">
                    {formatMetric(expandedFieldStat.max, expandedFieldStat.type)}
                  </span>
                </div>
              </div>
            )}

            {expandedFieldStat.byCategory.length > 0 && (
              <div className="pt-4 border-t border-gray-100 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase">
                  <span>By Category</span>
                  <span>Total</span>
                </div>
                <div className="divide-y divide-gray-100 max-h-[35vh] overflow-y-auto analytics-scrollbar pr-1">
                  {expandedFieldStat.byCategory.map((contrib) => (
                    <div
                      key={contrib.categoryName}
                      className="py-2 flex items-center justify-between text-sm gap-3"
                    >
                      <span className="text-gray-700 truncate">{contrib.categoryName}</span>
                      <span className="font-semibold text-gray-900 shrink-0">
                        {expandedFieldStat.type === 'boolean'
                          ? `${contrib.trueCount}/${contrib.count}`
                          : formatMetric(contrib.sum, expandedFieldStat.type)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {expandedCard?.cardKey === 'category_share' && (
          <div className="bg-white border border-blue-100 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xs">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-blue-500" />
                <span>Category Share</span>
              </span>
              {aggregates.fieldStats.length > 1 && (
                <select
                  value={selectedPieFieldKey}
                  onChange={(e) => {
                    setActiveViewId(null);
                    setSelectedPieFieldKey(e.target.value);
                  }}
                  aria-label="Expanded pie chart metric"
                  style={{ fontSize: '13px' }}
                  className="h-8 text-xs font-semibold bg-blue-50/70 border border-blue-100 rounded-lg px-2.5 text-blue-700 focus:outline-none focus:border-blue-400 cursor-pointer"
                >
                  {aggregates.fieldStats.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center justify-center py-2">
              <svg viewBox="0 0 100 100" className="w-44 h-44 sm:w-52 sm:h-52 overflow-visible">
                {pieSlices.map((slice, idx) => {
                  const isHovered = modalHoveredSliceIndex === idx;
                  const isFullCircle = slice.endAngle - slice.startAngle >= 359.9;
                  return isFullCircle ? (
                    <circle
                      key={slice.label}
                      cx="50"
                      cy="50"
                      r="45"
                      fill={slice.color}
                      onMouseEnter={() => setModalHoveredSliceIndex(idx)}
                      onMouseLeave={() => setModalHoveredSliceIndex(null)}
                      className="transition-opacity cursor-pointer"
                      style={{ opacity: modalHoveredSliceIndex === null || isHovered ? 1 : 0.55 }}
                    />
                  ) : (
                    <path
                      key={slice.label}
                      d={describePieSlice(50, 50, 45, slice.startAngle, slice.endAngle)}
                      fill={slice.color}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      onMouseEnter={() => setModalHoveredSliceIndex(idx)}
                      onMouseLeave={() => setModalHoveredSliceIndex(null)}
                      className="transition-opacity cursor-pointer"
                      style={{ opacity: modalHoveredSliceIndex === null || isHovered ? 1 : 0.55 }}
                    />
                  );
                })}
              </svg>
            </div>

            <div className="border-t border-gray-100 pt-3 max-h-[35vh] overflow-y-auto analytics-scrollbar space-y-1.5 pr-1">
              {pieSlices.map((slice, idx) => (
                <div
                  key={slice.label}
                  onMouseEnter={() => setModalHoveredSliceIndex(idx)}
                  onMouseLeave={() => setModalHoveredSliceIndex(null)}
                  className={`flex items-center justify-between text-sm gap-3 rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors ${
                    modalHoveredSliceIndex === idx ? 'bg-blue-50/70' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="text-gray-800 truncate">{slice.label}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-500">{slice.valueLabel}</span>
                    <span className="font-bold text-gray-900">
                      {slice.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-xs text-gray-500 border-t border-gray-100 pt-2.5">
              {modalHoveredSlice ? (
                <span>
                  <strong className="text-gray-800">{modalHoveredSlice.label}</strong>:{' '}
                  {modalHoveredSlice.valueLabel} ({modalHoveredSlice.percentage.toFixed(1)}%)
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

        {expandedCard?.cardKey === 'timeline_trend' && (
          <div className="w-full">
            <TimelineTrendCard
              logs={filteredLogs}
              fieldStats={aggregates.fieldStats}
              cardHeightClass="h-[420px] sm:h-[480px]"
              granularity={timelineGranularity}
              onGranularityChange={(val) => {
                setActiveViewId(null);
                setTimelineGranularity(val);
              }}
              selectedMetricKey={timelineMetricKey}
              onMetricChange={(val) => {
                setActiveViewId(null);
                setTimelineMetricKey(val);
              }}
            />
          </div>
        )}

        {expandedCard?.cardKey === 'field_breakdown' && (
          <div className="w-full">
            <FieldBreakdownCard
              logs={filteredLogs}
              fieldStats={aggregates.fieldStats}
              categories={categories}
              cardHeightClass="h-[420px] sm:h-[480px]"
              selectedFieldKey={breakdownFieldKey}
              onSelectedFieldChange={(val) => {
                setActiveViewId(null);
                setBreakdownFieldKey(val);
              }}
              selectedMetricKey={breakdownMetricKey}
              onSelectedMetricChange={(val) => {
                setActiveViewId(null);
                setBreakdownMetricKey(val);
              }}
            />
          </div>
        )}
      </CardExpandModal>
    </div>
  );
}