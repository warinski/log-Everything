'use client';

import { useState } from 'react';
import { Calculator, Layers, Clock, PieChart as PieChartIcon } from 'lucide-react';
import {
  CategoryBreakdownItem,
  FieldStat,
  PieSlice,
  formatMetric,
} from '@/lib/analytics/aggregations';

interface SummaryCardsSectionProps {
  isMultiCategoryScope: boolean;
  totalLogs: number;
  categoryBreakdownCount: number;
  categoryBreakdown: CategoryBreakdownItem[];
  fieldStats: FieldStat[];
  pieSlices: PieSlice[];
  activePieField: FieldStat | undefined;
  selectedPieFieldKey: string;
  onSelectPieField: (key: string) => void;
}

const CARD_ROW_CAP_CLASS = 'h-full max-h-[380px]';

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

export default function SummaryCardsSection({
  isMultiCategoryScope,
  totalLogs,
  categoryBreakdownCount,
  categoryBreakdown,
  fieldStats,
  pieSlices,
  activePieField,
  selectedPieFieldKey,
  onSelectPieField,
}: SummaryCardsSectionProps) {
  const [hoveredSliceIndex, setHoveredSliceIndex] = useState<number | null>(null);
  const hoveredSlice =
    hoveredSliceIndex !== null ? pieSlices[hoveredSliceIndex] ?? null : null;

  return (
    <div className="space-y-2 shrink-0">
      <div className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
        <Calculator className="w-4 h-4 text-blue-600" />
        <span>Summary & Field Aggregations</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-max items-stretch gap-4">
        {/* Matching Logs Card */}
        <div
          className={`bg-white border border-blue-100 rounded-2xl p-4 shadow-2xs flex flex-col min-w-0 overflow-hidden ${CARD_ROW_CAP_CLASS}`}
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
                {totalLogs}
              </span>
              <span className="text-[11px] sm:text-xs text-gray-400 truncate block mt-0.5">
                across {categoryBreakdownCount}{' '}
                {categoryBreakdownCount === 1 ? 'category' : 'categories'}
              </span>
            </div>
          </div>

          {isMultiCategoryScope && categoryBreakdown.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between mb-1.5 pr-2.5 shrink-0">
                <span className="text-[10px] font-bold text-gray-400 uppercase">
                  By Category
                </span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Logs</span>
              </div>
              <div className="flex-1 overflow-y-auto analytics-scrollbar space-y-1.5 pr-2 min-h-0">
                {categoryBreakdown.map((item) => (
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
        {fieldStats.map((stat) => (
          <div
            key={stat.key}
            className={`bg-white border border-blue-100 rounded-2xl p-4 shadow-2xs flex flex-col min-w-0 overflow-hidden ${CARD_ROW_CAP_CLASS}`}
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
                    total
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
                          ? `${contrib.trueCount}/${contrib.count}`
                          : formatMetric(contrib.sum, stat.type)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Category Share Pie Card */}
        {isMultiCategoryScope && pieSlices.length > 0 && (
          <div
            className={`bg-white border border-blue-100 rounded-2xl p-4 shadow-2xs flex flex-col justify-between min-w-0 overflow-hidden ${CARD_ROW_CAP_CLASS}`}
          >
            <div className="flex items-center justify-between gap-2 min-w-0 shrink-0">
              <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5 shrink-0">
                <PieChartIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Category Share</span>
              </span>
              {fieldStats.length > 1 && (
                <select
                  value={selectedPieFieldKey}
                  onChange={(e) => onSelectPieField(e.target.value)}
                  aria-label="Pie chart metric"
                  style={{ fontSize: '12px' }}
                  className="h-7 text-xs font-semibold bg-blue-50/70 border border-blue-100 rounded-lg px-2 py-0 text-blue-700 focus:outline-none focus:border-blue-400 cursor-pointer max-w-[140px] truncate shrink-0"
                >
                  {fieldStats.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

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
                      style={{ opacity: hoveredSliceIndex === null || isHovered ? 1 : 0.55 }}
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
                      style={{ opacity: hoveredSliceIndex === null || isHovered ? 1 : 0.55 }}
                    />
                  );
                })}
              </svg>
            </div>

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
  );
}