'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, FileSpreadsheet, FileJson, Eye, EyeOff, BarChart3 } from 'lucide-react';
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
import ExpandedCardContent, {
  ExpandedCardTarget,
} from '@/components/analytics/ExpandedCardContent';
import { exportAnalyticsLogs } from '@/lib/analytics/exportLogs';
import { AnalyticsCardKey, SavedAnalyticsView } from '@/lib/analytics/savedViews';
import {
  discoverDynamicColumns,
  computeAggregates,
  buildPieSlices,
  parseNumeric,
} from '@/lib/analytics/aggregations';
import { TrendGranularity } from '@/lib/analytics/timelineTrend';

interface AnalyticsClientProps {
  userId: string;
}

export default function AnalyticsClient({ userId }: AnalyticsClientProps) {
  const searchParams = useSearchParams();
  const requestedViewId = searchParams.get('view');
  const appliedQueryViewIdRef = useRef<string | null>(null);

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
  const [showDataTable, setShowDataTable] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const rowsPerPage = 10;
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([
    { key: 'timestamp', direction: 'desc' },
  ]);

  const invalidateActiveView = useCallback(() => {
    setActiveViewId(null);
  }, []);

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
    setSelectedCategories(
      Array.isArray(view.selectedCategories)
        ? view.selectedCategories
        : view.selectedCategory
          ? view.selectedCategory.split(',').filter(Boolean)
          : []
    );
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

  useEffect(() => {
    if (!requestedViewId) {
      appliedQueryViewIdRef.current = null;
      return;
    }
    if (savedViews.length === 0 || appliedQueryViewIdRef.current === requestedViewId) {
      return;
    }
    const target = savedViews.find((v) => v.id === requestedViewId);
    if (target) {
      appliedQueryViewIdRef.current = requestedViewId;
      handleApplyView(target);
    }
  }, [requestedViewId, savedViews, handleApplyView]);

  const handleDeleteView = useCallback(
    async (id: string) => {
      const targetView = savedViews.find((v) => v.id === id) ?? null;
      try {
        await deleteSavedView(id, userId);
        setSavedViews((prev) => prev.filter((v) => v.id !== id));
        if (activeViewId === id) setActiveViewId(null);
        if (lastAppliedViewId === id) setLastAppliedViewId(null);
        if (targetView) setDeletedView(targetView);
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

  const getLogTimestamp = useCallback(
    (log: any): Date => new Date(log.timestamp || log.loggedAt || log.createdAt),
    []
  );

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
    const q = searchQuery.trim().toLowerCase();

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
      if (q !== '') {
        const matchesText =
          log.title?.toLowerCase().includes(q) ||
          log.notes?.toLowerCase().includes(q) ||
          log.tags?.some((t: string) => t.toLowerCase().includes(q)) ||
          Object.values(log.attributes || {}).some((v) =>
            String(v).toLowerCase().includes(q)
          );
        if (!matchesText) return false;
      }
      return true;
    });
  }, [logs, selectedCategories, searchQuery, dateFrom, dateTo, getLogEffectiveDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategories, searchQuery, dateFrom, dateTo]);

  const dynamicColumns = useMemo(
    () =>
      discoverDynamicColumns(
        singleCategoryObj,
        selectedCategories,
        categories,
        filteredLogs
      ),
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
    invalidateActiveView();
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
    if (
      !selectedPieFieldKey ||
      !aggregates.fieldStats.some((f) => f.key === selectedPieFieldKey)
    ) {
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
    [
      isMultiCategoryScope,
      activePieField,
      aggregates.categoryBreakdown,
      aggregates.totalLogs,
    ]
  );

  const expandedFieldStat = useMemo(() => {
    if (!expandedCard || expandedCard.cardKey !== 'field_stats') return undefined;
    return aggregates.fieldStats.find((f) => f.key === expandedCard.fieldKey);
  }, [expandedCard, aggregates.fieldStats]);

  const { modalTitle, modalSubtitle } = useMemo(() => {
    if (!expandedCard) return { modalTitle: '', modalSubtitle: undefined };
    switch (expandedCard.cardKey) {
      case 'matching_logs':
        return {
          modalTitle: 'Matching Logs',
          modalSubtitle: `${aggregates.totalLogs} matching logs across ${aggregates.categoryBreakdownCount} ${
            aggregates.categoryBreakdownCount === 1 ? 'category' : 'categories'
          }`,
        };
      case 'field_stats':
        return {
          modalTitle: expandedFieldStat?.label || 'Field Stats',
          modalSubtitle: expandedFieldStat
            ? `Sample size n = ${expandedFieldStat.count}`
            : undefined,
        };
      case 'category_share':
        return {
          modalTitle: 'Category Share',
          modalSubtitle: activePieField
            ? `Distribution by ${activePieField.label} total`
            : 'Distribution by matching log count',
        };
      case 'timeline_trend':
        return {
          modalTitle: 'Timeline Trend',
          modalSubtitle: `Grouped by ${timelineGranularity}`,
        };
      case 'field_breakdown':
        return {
          modalTitle: 'Field Breakdown',
          modalSubtitle: 'Breakdown across custom attributes and metrics',
        };
      default:
        return { modalTitle: 'Analytics Card', modalSubtitle: undefined };
    }
  }, [
    expandedCard,
    aggregates,
    expandedFieldStat,
    activePieField,
    timelineGranularity,
  ]);

  const handleExport = (format: 'csv' | 'xlsx' | 'json') => {
    exportAnalyticsLogs({
      format,
      logs: sortedLogs,
      selectedCategories,
      singleCategoryObj,
      dynamicColumns,
      showCategoryColumn,
      getLogTimestamp,
    });
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

  const resetSortToTimestamp = () =>
    setSortConfigs([{ key: 'timestamp', direction: 'desc' }]);

  return (
    <div className="max-w-7xl mx-auto flex flex-col space-y-4 px-2 sm:px-4 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
          <h1 className="text-sm sm:text-xl font-bold tracking-tight text-gray-900">
            Insights & Analytics
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={sortedLogs.length === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 text-xs sm:text-sm font-semibold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-blue-600" /> CSV
          </button>
          <button
            type="button"
            onClick={() => handleExport('xlsx')}
            disabled={sortedLogs.length === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 text-xs sm:text-sm font-semibold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-600" /> XLSX
          </button>
          <button
            type="button"
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
          invalidateActiveView();
          setSelectedCategories((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
          );
          resetSortToTimestamp();
        }}
        onSelectAllCategories={() => {
          invalidateActiveView();
          setSelectedCategories(categories.map((c) => c._id).filter(Boolean));
          resetSortToTimestamp();
        }}
        onClearCategories={() => {
          invalidateActiveView();
          setSelectedCategories([]);
          resetSortToTimestamp();
        }}
        searchQuery={searchQuery}
        onSearchChange={(val) => {
          invalidateActiveView();
          setSearchQuery(val);
        }}
        dateFrom={dateFrom}
        onDateFromChange={(val) => {
          invalidateActiveView();
          setDateFrom(val);
        }}
        dateTo={dateTo}
        onDateToChange={(val) => {
          invalidateActiveView();
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
          invalidateActiveView();
          setSelectedPieFieldKey(key);
        }}
        filteredLogs={filteredLogs}
        categories={categories}
        timelineGranularity={timelineGranularity}
        onTimelineGranularityChange={(val) => {
          invalidateActiveView();
          setTimelineGranularity(val);
        }}
        timelineMetricKey={timelineMetricKey}
        onTimelineMetricChange={(val) => {
          invalidateActiveView();
          setTimelineMetricKey(val);
        }}
        breakdownFieldKey={breakdownFieldKey}
        onBreakdownFieldChange={(val) => {
          invalidateActiveView();
          setBreakdownFieldKey(val);
        }}
        breakdownMetricKey={breakdownMetricKey}
        onBreakdownMetricChange={(val) => {
          invalidateActiveView();
          setBreakdownMetricKey(val);
        }}
        hiddenCardKeys={hiddenCardKeys}
        onHiddenCardKeysChange={(nextHidden) => {
          invalidateActiveView();
          setHiddenCardKeys(nextHidden);
        }}
        onExpandCard={(target) => {
          setModalHoveredSliceIndex(null);
          setExpandedCard(target);
        }}
      />

      {/* Subtle centered borderless toggle for Table of Matching Logs after all Analytics Cards */}
      <div className="flex items-center justify-center pt-1">
        <button
          type="button"
          onClick={() => setShowDataTable((prev) => !prev)}
          aria-pressed={showDataTable}
          className="inline-flex items-center gap-1.5 py-1 text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
        >
          {showDataTable ? (
            <EyeOff className="w-4 h-4 text-gray-500" />
          ) : (
            <Eye className="w-4 h-4 text-blue-600" />
          )}
          <span>Table of Matching Logs</span>
          <span className="text-xs text-gray-400">({sortedLogs.length})</span>
        </button>
      </div>

      {showDataTable && (
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
          onToggleSelectRow={(id) =>
            setSelectedRowId((prev) => (prev === id ? null : id))
          }
          getLogTimestamp={getLogTimestamp}
        />
      )}

      <CardExpandModal
        isOpen={Boolean(expandedCard)}
        title={modalTitle}
        subtitle={modalSubtitle}
        onClose={() => setExpandedCard(null)}
      >
        <ExpandedCardContent
          expandedCard={expandedCard}
          filteredLogs={filteredLogs}
          categories={categories}
          aggregates={aggregates}
          expandedFieldStat={expandedFieldStat}
          pieSlices={pieSlices}
          activePieField={activePieField}
          selectedPieFieldKey={selectedPieFieldKey}
          onSelectPieField={(key) => {
            invalidateActiveView();
            setSelectedPieFieldKey(key);
          }}
          modalHoveredSliceIndex={modalHoveredSliceIndex}
          onHoverSlice={setModalHoveredSliceIndex}
          timelineGranularity={timelineGranularity}
          onTimelineGranularityChange={(val) => {
            invalidateActiveView();
            setTimelineGranularity(val);
          }}
          timelineMetricKey={timelineMetricKey}
          onTimelineMetricChange={(val) => {
            invalidateActiveView();
            setTimelineMetricKey(val);
          }}
          breakdownFieldKey={breakdownFieldKey}
          onBreakdownFieldChange={(val) => {
            invalidateActiveView();
            setBreakdownFieldKey(val);
          }}
          breakdownMetricKey={breakdownMetricKey}
          onBreakdownMetricChange={(val) => {
            invalidateActiveView();
            setBreakdownMetricKey(val);
          }}
        />
      </CardExpandModal>
    </div>
  );
}