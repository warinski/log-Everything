'use client';

import { Layers, Clock, PieChart as PieChartIcon } from 'lucide-react';
import { CategoryTemplate } from '@/components/LogModal';
import TimelineTrendCard from '@/components/analytics/TimelineTrendCard';
import FieldBreakdownCard from '@/components/analytics/FieldBreakdownCard';
import { TrendGranularity } from '@/lib/analytics/timelineTrend';
import { FieldStat, formatMetric } from '@/lib/analytics/aggregations';

export type ExpandedCardTarget =
  | { cardKey: 'matching_logs' }
  | { cardKey: 'field_stats'; fieldKey: string }
  | { cardKey: 'category_share' }
  | { cardKey: 'timeline_trend' }
  | { cardKey: 'field_breakdown' }
  | null;

interface PieSlice {
  label: string;
  color: string;
  valueLabel: string;
  percentage: number;
  startAngle: number;
  endAngle: number;
}

interface ExpandedCardContentProps {
  expandedCard: ExpandedCardTarget;
  filteredLogs: any[];
  categories: CategoryTemplate[];
  aggregates: {
    totalLogs: number;
    categoryBreakdownCount: number;
    categoryBreakdown: Array<{ categoryName: string; count: number }>;
    fieldStats: FieldStat[];
  };
  expandedFieldStat?: FieldStat;
  pieSlices: PieSlice[];
  activePieField?: FieldStat;
  selectedPieFieldKey: string;
  onSelectPieField: (key: string) => void;
  modalHoveredSliceIndex: number | null;
  onHoverSlice: (idx: number | null) => void;
  timelineGranularity: TrendGranularity;
  onTimelineGranularityChange: (val: TrendGranularity) => void;
  timelineMetricKey: string;
  onTimelineMetricChange: (val: string) => void;
  breakdownFieldKey: string;
  onBreakdownFieldChange: (val: string) => void;
  breakdownMetricKey: string;
  onBreakdownMetricChange: (val: string) => void;
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

export default function ExpandedCardContent({
  expandedCard,
  filteredLogs,
  categories,
  aggregates,
  expandedFieldStat,
  pieSlices,
  activePieField,
  selectedPieFieldKey,
  onSelectPieField,
  modalHoveredSliceIndex,
  onHoverSlice,
  timelineGranularity,
  onTimelineGranularityChange,
  timelineMetricKey,
  onTimelineMetricChange,
  breakdownFieldKey,
  onBreakdownFieldChange,
  breakdownMetricKey,
  onBreakdownMetricChange,
}: ExpandedCardContentProps) {
  if (!expandedCard) return null;

  const modalHoveredSlice =
    modalHoveredSliceIndex !== null ? pieSlices[modalHoveredSliceIndex] ?? null : null;

  if (expandedCard.cardKey === 'matching_logs') {
    return (
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
    );
  }

  if (expandedCard.cardKey === 'field_stats' && expandedFieldStat) {
    const statType = expandedFieldStat.type || 'number';

    return (
      <div className="bg-white border border-blue-100 rounded-2xl p-5 sm:p-6 space-y-6 shadow-2xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {statType === 'duration' && (
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

        {statType === 'boolean' ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100/70">
              <span className="block text-xs text-gray-400 uppercase font-semibold">
                Checked
              </span>
              <span className="text-2xl font-extrabold text-gray-900 mt-1 block">
                {expandedFieldStat.trueCount ?? 0} / {expandedFieldStat.count}
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
                {statType === 'duration' ? 'Total Time' : 'Sum'}
              </span>
              <span className="font-extrabold text-gray-900 text-lg sm:text-xl mt-1 block">
                {formatMetric(expandedFieldStat.sum ?? 0, statType)}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100/70">
              <span className="text-gray-400 block text-xs uppercase font-semibold">
                Average
              </span>
              <span className="font-extrabold text-gray-900 text-lg sm:text-xl mt-1 block">
                {formatMetric(expandedFieldStat.avg, statType)}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100/70">
              <span className="text-gray-400 block text-xs uppercase font-semibold">
                Min
              </span>
              <span className="font-extrabold text-gray-900 text-lg sm:text-xl mt-1 block">
                {formatMetric(expandedFieldStat.min ?? 0, statType)}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100/70">
              <span className="text-gray-400 block text-xs uppercase font-semibold">
                Max
              </span>
              <span className="font-extrabold text-gray-900 text-lg sm:text-xl mt-1 block">
                {formatMetric(expandedFieldStat.max ?? 0, statType)}
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
                    {statType === 'boolean'
                      ? `${contrib.trueCount ?? 0}/${contrib.count}`
                      : formatMetric(contrib.sum ?? 0, statType)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (expandedCard.cardKey === 'category_share') {
    return (
      <div className="bg-white border border-blue-100 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xs">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-blue-500" />
            <span>Category Share</span>
          </span>
          {aggregates.fieldStats.length > 1 && (
            <select
              value={selectedPieFieldKey}
              onChange={(e) => onSelectPieField(e.target.value)}
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
                  onMouseEnter={() => onHoverSlice(idx)}
                  onMouseLeave={() => onHoverSlice(null)}
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
                  onMouseEnter={() => onHoverSlice(idx)}
                  onMouseLeave={() => onHoverSlice(null)}
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
              onMouseEnter={() => onHoverSlice(idx)}
              onMouseLeave={() => onHoverSlice(null)}
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
    );
  }

  if (expandedCard.cardKey === 'timeline_trend') {
    return (
      <div className="w-full">
        <TimelineTrendCard
          logs={filteredLogs}
          fieldStats={aggregates.fieldStats}
          cardHeightClass="h-[420px] sm:h-[480px]"
          granularity={timelineGranularity}
          onGranularityChange={onTimelineGranularityChange}
          selectedMetricKey={timelineMetricKey}
          onMetricChange={onTimelineMetricChange}
        />
      </div>
    );
  }

  if (expandedCard.cardKey === 'field_breakdown') {
    return (
      <div className="w-full">
        <FieldBreakdownCard
          logs={filteredLogs}
          fieldStats={aggregates.fieldStats}
          categories={categories}
          cardHeightClass="h-[420px] sm:h-[480px]"
          selectedFieldKey={breakdownFieldKey}
          onSelectedFieldChange={onBreakdownFieldChange}
          selectedMetricKey={breakdownMetricKey}
          onSelectedMetricChange={onBreakdownMetricChange}
        />
      </div>
    );
  }

  return null;
}