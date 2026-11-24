'use client';

import { useEffect, useMemo, useState } from 'react';
import { ListFilter } from 'lucide-react';
import { FieldStat } from '@/lib/analytics/aggregations';
import {
  buildFieldBreakdown,
  FieldBreakdownRow,
  formatBreakdownNumeric,
  getBreakdownableFields,
  getPertinentMetricsForField,
} from '@/lib/analytics/fieldBreakdown';

interface FieldBreakdownCardProps {
  logs: any[];
  fieldStats: FieldStat[];
  categories?: any[];
  cardHeightClass?: string;
  selectedFieldKey?: string;
  onSelectedFieldChange?: (fieldKey: string) => void;
  selectedMetricKey?: string;
  onSelectedMetricChange?: (metricKey: string) => void;
}

export default function FieldBreakdownCard({
  logs,
  fieldStats,
  categories = [],
  cardHeightClass = 'h-full max-h-[380px]',
  selectedFieldKey: selectedFieldKeyProp,
  onSelectedFieldChange,
  selectedMetricKey: selectedMetricKeyProp,
  onSelectedMetricChange,
}: FieldBreakdownCardProps) {
  const breakdownFields = useMemo(
    () => getBreakdownableFields(logs, fieldStats, categories),
    [logs, fieldStats, categories]
  );

  const [internalFieldKey, setInternalFieldKey] = useState<string>(
    selectedFieldKeyProp ?? ''
  );
  const [internalMetricKey, setInternalMetricKey] = useState<string>(
    selectedMetricKeyProp ?? ''
  );

  useEffect(() => {
    if (selectedFieldKeyProp !== undefined) {
      setInternalFieldKey(selectedFieldKeyProp);
    }
  }, [selectedFieldKeyProp]);

  useEffect(() => {
    if (selectedMetricKeyProp !== undefined) {
      setInternalMetricKey(selectedMetricKeyProp);
    }
  }, [selectedMetricKeyProp]);

  const selectedFieldKey = selectedFieldKeyProp ?? internalFieldKey;
  const selectedMetricKey = selectedMetricKeyProp ?? internalMetricKey;

  const setSelectedFieldKey = (next: string) => {
    setInternalFieldKey(next);
    onSelectedFieldChange?.(next);
  };

  const setSelectedMetricKey = (next: string) => {
    setInternalMetricKey(next);
    onSelectedMetricChange?.(next);
  };

  useEffect(() => {
    if (breakdownFields.length === 0) return;
    if (!selectedFieldKey || !breakdownFields.some((f) => f.key === selectedFieldKey)) {
      setSelectedFieldKey(breakdownFields[0].key);
    }
  }, [breakdownFields, selectedFieldKey]);

  const activeField = useMemo(
    () => breakdownFields.find((f) => f.key === selectedFieldKey) || breakdownFields[0],
    [breakdownFields, selectedFieldKey]
  );

  const pertinentMetrics = useMemo(
    () => getPertinentMetricsForField(logs, activeField, fieldStats),
    [logs, activeField, fieldStats]
  );

  useEffect(() => {
    if (pertinentMetrics.length === 0) return;
    if (!selectedMetricKey || !pertinentMetrics.some((m) => m.key === selectedMetricKey)) {
      setSelectedMetricKey(pertinentMetrics[0].key);
    }
  }, [activeField?.key, pertinentMetrics, selectedMetricKey]);

  const handleFieldChange = (nextFieldKey: string) => {
    setSelectedFieldKey(nextFieldKey);
    const nextField = breakdownFields.find((f) => f.key === nextFieldKey);
    const nextMetrics = getPertinentMetricsForField(logs, nextField, fieldStats);
    setSelectedMetricKey(nextMetrics[0]?.key || '');
  };

  const activeMetric = useMemo(
    () => pertinentMetrics.find((m) => m.key === selectedMetricKey) || pertinentMetrics[0],
    [pertinentMetrics, selectedMetricKey]
  );

  const breakdownResult = useMemo(
    () => buildFieldBreakdown(logs, activeField, activeMetric),
    [logs, activeField, activeMetric]
  );

  const rows: FieldBreakdownRow[] = Array.isArray(breakdownResult)
    ? breakdownResult
    : Array.isArray(breakdownResult?.rows)
    ? breakdownResult.rows
    : [];

  const hasMetricValues = Array.isArray(breakdownResult)
    ? rows.some((r: any) => r?.metricValue !== null && r?.metricValue !== undefined)
    : Boolean(breakdownResult?.hasMetricValues);

  if (breakdownFields.length === 0 || rows.length === 0) {
    return null;
  }

  const showMetricColumn = hasMetricValues && Boolean(activeMetric);
  const totalCount = rows.reduce((acc, r) => acc + (Number(r?.count) || 0), 0);

  const layoutColsClass = showMetricColumn
    ? 'grid-cols-[minmax(0,1.25fr)_minmax(0,1.15fr)_auto]'
    : 'grid-cols-[minmax(0,1fr)_auto]';

  return (
    <div
      className={`bg-white border border-blue-100 rounded-2xl p-4 shadow-2xs flex flex-col justify-start min-w-0 overflow-hidden ${cardHeightClass}`}
    >
      {/* Card Title */}
      <div className="flex items-center justify-between gap-2 min-w-0 shrink-0">
        <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5 shrink-0">
          <ListFilter className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span>Field Breakdown</span>
        </span>
      </div>

      {/* Column Headers: 1. Field Name Dropdown | 2. Metric (%) Dropdown | 3. Logs */}
      <div
        className={`grid ${layoutColsClass} items-center gap-2 border-b border-gray-100 pb-2 mt-2.5 pr-2 shrink-0`}
      >
        <div className="min-w-0 flex items-center justify-start">
          {breakdownFields.length > 1 ? (
            <select
              value={activeField?.key || ''}
              onChange={(e) => handleFieldChange(e.target.value)}
              aria-label="Field name column"
              title={activeField?.label}
              style={{ fontSize: '10px' }}
              className="h-6 w-full text-[10px] font-bold uppercase bg-blue-50/70 border border-blue-100 rounded-md px-1.5 py-0 text-blue-700 focus:outline-none focus:border-blue-400 cursor-pointer"
            >
              {breakdownFields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          ) : (
            <span
              className="text-[10px] font-bold text-gray-400 uppercase truncate block"
              title={activeField?.label}
            >
              {activeField?.label || 'Field Name'}
            </span>
          )}
        </div>

        {showMetricColumn && activeMetric && (
          <div className="min-w-0 flex items-center justify-center">
            <select
              value={activeMetric.key}
              onChange={(e) => setSelectedMetricKey(e.target.value)}
              aria-label="Pertinent metric column"
              title={`${activeMetric.label} (%)`}
              style={{ fontSize: '10px' }}
              className="h-6 w-full text-[10px] font-bold uppercase bg-blue-50/70 border border-blue-100 rounded-md px-1.5 py-0 text-blue-700 focus:outline-none focus:border-blue-400 cursor-pointer"
            >
              {pertinentMetrics.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} (%)
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="min-w-0 flex items-center justify-end pl-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase whitespace-nowrap">
            Logs
          </span>
        </div>
      </div>

      {/* Data Rows */}
      <div className="flex-1 overflow-y-auto analytics-scrollbar space-y-2.5 py-2.5 pr-2 min-h-0">
        {rows.map((row) => (
          <div key={row.valueKey} className="space-y-1.5 min-w-0">
            <div className={`grid ${layoutColsClass} items-center gap-2 text-xs min-w-0`}>
              <span
                className="font-medium text-gray-700 truncate text-left"
                title={row.label}
              >
                {row.label}
              </span>

              {showMetricColumn && row.metricValue !== null && (
                <span className="text-center font-semibold text-gray-900 whitespace-nowrap tabular-nums">
                  {formatBreakdownNumeric(row.metricValue, activeMetric?.type)}
                  {row.metricPercentage !== null && (
                    <span className="text-[11px] font-normal text-gray-400 ml-1">
                      ({row.metricPercentage.toFixed(0)}%)
                    </span>
                  )}
                </span>
              )}

              <span className="text-right font-semibold text-gray-700 whitespace-nowrap tabular-nums pl-1">
                {row.count}
              </span>
            </div>

            <div className="w-full h-1.5 bg-blue-50 rounded-full overflow-hidden">
              <div
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      showMetricColumn && row.metricPercentage !== null
                        ? row.metricPercentage
                        : totalCount > 0
                        ? (row.count / totalCount) * 100
                        : 0,
                      3
                    )
                  )}%`,
                }}
                className="h-full bg-blue-500/85 rounded-full"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-[11px] text-gray-500 border-t border-gray-100 pt-2 mt-1 truncate shrink-0">
        <span>
          <strong className="text-gray-700">{activeField?.label}</strong> across{' '}
          <strong className="text-gray-800">{totalCount}</strong>{' '}
          {totalCount === 1 ? 'entry' : 'entries'}
          {showMetricColumn && activeMetric ? (
            <>
              {' '}
              · <strong className="text-gray-700">{activeMetric.label}</strong>
            </>
          ) : null}
        </span>
      </div>
    </div>
  );
}