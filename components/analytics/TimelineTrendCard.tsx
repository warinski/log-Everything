'use client';

import { useEffect, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { FieldStat } from '@/lib/analytics/aggregations';
import { buildTimelineTrend, TrendGranularity } from '@/lib/analytics/timelineTrend';

interface TimelineTrendCardProps {
  logs: any[];
  fieldStats: FieldStat[];
  cardHeightClass?: string;
  granularity?: TrendGranularity;
  onGranularityChange?: (granularity: TrendGranularity) => void;
  selectedMetricKey?: string;
  onMetricChange?: (metricKey: string) => void;
}

export default function TimelineTrendCard({
  logs,
  fieldStats,
  cardHeightClass = 'h-full max-h-[380px]',
  granularity: granularityProp,
  onGranularityChange,
  selectedMetricKey: selectedMetricKeyProp,
  onMetricChange,
}: TimelineTrendCardProps) {
  const numericFields = useMemo(
    () => fieldStats.filter((f) => f.type !== 'boolean'),
    [fieldStats]
  );

  const [internalGranularity, setInternalGranularity] = useState<TrendGranularity>(
    granularityProp ?? 'day'
  );
  const [internalMetricKey, setInternalMetricKey] = useState<string>(
    selectedMetricKeyProp ?? '__count__'
  );
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    if (granularityProp !== undefined) {
      setInternalGranularity(granularityProp);
    }
  }, [granularityProp]);

  useEffect(() => {
    if (selectedMetricKeyProp !== undefined) {
      setInternalMetricKey(selectedMetricKeyProp);
    }
  }, [selectedMetricKeyProp]);

  const granularity = granularityProp ?? internalGranularity;
  const selectedMetricKey = selectedMetricKeyProp ?? internalMetricKey;

  const setGranularity = (next: TrendGranularity) => {
    setInternalGranularity(next);
    onGranularityChange?.(next);
  };

  const setSelectedMetricKey = (next: string) => {
    setInternalMetricKey(next);
    onMetricChange?.(next);
  };

  useEffect(() => {
    if (selectedMetricKey === '__count__') return;

    if (numericFields.length > 0) {
      const stillExists = numericFields.some((f) => f.key === selectedMetricKey);
      if (!stillExists) {
        setSelectedMetricKey(numericFields[0].key);
      }
    } else {
      setSelectedMetricKey('__count__');
    }
  }, [numericFields, selectedMetricKey]);

  const points = useMemo(
    () => buildTimelineTrend(logs, granularity, selectedMetricKey, fieldStats),
    [logs, granularity, selectedMetricKey, fieldStats]
  );

  const maxValue = useMemo(() => {
    if (points.length === 0) return 0;
    return Math.max(...points.map((p) => p.value), 0);
  }, [points]);

  if (!logs || logs.length === 0 || points.length === 0) {
    return null;
  }

  const hoveredPoint = hoveredIdx !== null ? points[hoveredIdx] ?? null : null;
  const activeMetricLabel =
    selectedMetricKey === '__count__'
      ? 'Log Count'
      : numericFields.find((f) => f.key === selectedMetricKey)?.label || 'Log Count';

  return (
    <div
      className={`bg-white border border-blue-100 rounded-2xl p-4 shadow-2xs flex flex-col justify-between min-w-0 overflow-hidden ${cardHeightClass}`}
    >
      {/* Header & Controls */}
      <div className="flex items-center justify-between gap-2 min-w-0 shrink-0 flex-wrap">
        <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5 shrink-0">
          <TrendingUp className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span>Timeline Trend</span>
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Granularity Switcher */}
          <div className="inline-flex rounded-lg bg-blue-50/70 border border-blue-100 p-0.5 text-[11px] font-semibold">
            {(['day', 'week', 'month'] as TrendGranularity[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                className={`px-2 py-0.5 rounded-md capitalize transition-colors cursor-pointer ${
                  granularity === g
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-blue-700 hover:bg-blue-100/70'
                }`}
              >
                {g === 'week' ? 'Wk' : g}
              </button>
            ))}
          </div>

          {/* Metric Selector */}
          <select
            value={selectedMetricKey}
            onChange={(e) => setSelectedMetricKey(e.target.value)}
            aria-label="Timeline trend metric"
            style={{ fontSize: '12px' }}
            className="h-7 text-xs font-semibold bg-blue-50/70 border border-blue-100 rounded-lg px-2 py-0 text-blue-700 focus:outline-none focus:border-blue-400 cursor-pointer max-w-[120px] truncate"
          >
            <option value="__count__">Log Count</option>
            {numericFields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chart Area */}
      {points.length > 0 ? (
        <div className="flex-1 flex flex-col justify-end min-h-0 pt-3">
          <div className="flex-1 min-h-[120px] flex items-end gap-1.5 sm:gap-2 px-1 pt-4 border-b border-gray-100 overflow-x-auto analytics-scrollbar">
            {points.map((pt, idx) => {
              const ratio =
                maxValue > 0 ? Math.max((pt.value / maxValue) * 100, pt.value > 0 ? 8 : 0) : 0;
              const isHovered = hoveredIdx === idx;

              return (
                <div
                  key={pt.key}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="flex-1 min-w-[28px] h-full flex flex-col items-center justify-end gap-1 cursor-pointer group"
                >
                  <div className="w-full flex-1 flex items-end justify-center">
                    <div
                      style={{ height: `${ratio}%` }}
                      className={`w-full max-w-[28px] rounded-t-md transition-all ${
                        isHovered
                          ? 'bg-blue-600'
                          : hoveredIdx === null
                          ? 'bg-blue-500/85'
                          : 'bg-blue-400/50'
                      }`}
                      title={`${pt.fullLabel}: ${pt.valueLabel} (n = ${pt.count})`}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-gray-500 truncate max-w-full pb-1">
                    {pt.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
          No dated logs in the current filter range.
        </div>
      )}

      {/* Footer Readout */}
      <div className="text-[11px] text-gray-500 border-t border-gray-100 pt-1.5 mt-2 truncate shrink-0">
        {hoveredPoint ? (
          <span>
            <strong className="text-gray-800">{hoveredPoint.fullLabel}</strong>:{' '}
            {hoveredPoint.valueLabel}{' '}
            <span className="text-gray-400">(n = {hoveredPoint.count})</span>
          </span>
        ) : (
          <span>
            Showing <strong className="text-gray-700">{activeMetricLabel}</strong> by{' '}
            <strong className="text-gray-700">{granularity}</strong>
          </span>
        )}
      </div>
    </div>
  );
}