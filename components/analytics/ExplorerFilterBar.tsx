'use client';

import { useEffect, useState } from 'react';
import { BookmarkPlus, ChevronDown, ChevronUp } from 'lucide-react';
import {
  ALL_VALUES_SENTINEL,
  ExplorerFieldOption,
  ExplorerViewSaveConfig,
} from '@/lib/analytics/fieldValueExplorer';

interface ExplorerFilterBarProps {
  categories: any[];
  categoryLogsCount: number;
  selectedCategoryId: string;
  onCategoryChange: (categoryId: string) => void;
  availableFields: ExplorerFieldOption[];
  selectedFieldKey: string;
  onFieldChange: (fieldKey: string) => void;
  valueOptions: Array<{ value: string; count: number }>;
  selectedValue: string;
  onValueChange: (value: string) => void;
  onSaveExplorerView?: (config: ExplorerViewSaveConfig) => void;
  suggestedViewName: string;
}

const EMOJI_PREFIX_REGEX =
  /^([\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]+)\s*/u;

function splitCategoryDisplay(category: any): { emoji: string; name: string } {
  if (!category) {
    return { emoji: '', name: 'Category' };
  }

  const rawName = String(category.name || '').trim();
  const explicitIcon = category.icon ? String(category.icon).trim() : '';

  if (explicitIcon) {
    const cleanedName = rawName.startsWith(explicitIcon)
      ? rawName.slice(explicitIcon.length).trim()
      : rawName;
    return {
      emoji: explicitIcon,
      name: cleanedName || rawName || 'Category',
    };
  }

  const match = rawName.match(EMOJI_PREFIX_REGEX);
  if (match?.[1]) {
    const emojiPrefix = match[1];
    const nameWithoutEmoji = rawName.slice(match[0].length).trim();
    return {
      emoji: emojiPrefix,
      name: nameWithoutEmoji || rawName || 'Category',
    };
  }

  return {
    emoji: '',
    name: rawName || 'Category',
  };
}

export default function ExplorerFilterBar({
  categories,
  categoryLogsCount,
  selectedCategoryId,
  onCategoryChange,
  availableFields,
  selectedFieldKey,
  onFieldChange,
  valueOptions,
  selectedValue,
  onValueChange,
  onSaveExplorerView,
  suggestedViewName,
}: ExplorerFilterBarProps) {
  // Default to compact summary on mobile (< 640px) and expanded on desktop (>= 640px)
  const [showFilterFields, setShowFilterFields] = useState(true);
  const [hasManualToggle, setHasManualToggle] = useState(false);

  useEffect(() => {
    if (hasManualToggle) return;
    const syncWithViewport = () => {
      setShowFilterFields(window.innerWidth >= 640);
    };
    syncWithViewport();
    window.addEventListener('resize', syncWithViewport);
    return () => window.removeEventListener('resize', syncWithViewport);
  }, [hasManualToggle]);

  const handleToggleFields = () => {
    setHasManualToggle(true);
    setShowFilterFields((prev) => !prev);
  };

  const selectedCategory = categories.find(
    (cat) => String(cat._id) === String(selectedCategoryId)
  );
  const { emoji: categoryEmoji, name: categoryLabel } =
    splitCategoryDisplay(selectedCategory);
  const categorySummary = categoryEmoji
    ? `${categoryEmoji} ${categoryLabel}`
    : categoryLabel;

  const selectedField = availableFields.find((field) => field.key === selectedFieldKey);
  const fieldSummary = selectedField?.label || 'Field';

  const matchedValueOption = valueOptions.find((item) => item.value === selectedValue);
  const valueSummary =
    selectedValue === ALL_VALUES_SENTINEL || !selectedValue
      ? `All values (${categoryLogsCount})`
      : matchedValueOption
      ? `${matchedValueOption.value} (${matchedValueOption.count})`
      : selectedValue;

  const canSaveView = Boolean(
    onSaveExplorerView && selectedCategoryId && selectedFieldKey && selectedValue
  );

  return (
    <div className="space-y-2.5">
      {/* Two-line on mobile (< sm) with line 2 aligned under category text; single-line on sm+ */}
      <div className="flex items-start sm:items-center justify-between gap-2">
        <div
          className="flex items-start sm:items-center gap-1.5 min-w-0 flex-1 text-[13.9px] sm:text-[15.2px] leading-snug sm:leading-normal font-medium"
          title={`${categorySummary} → ${fieldSummary} → ${valueSummary}`}
        >
          {categoryEmoji && (
            <span className="shrink-0 leading-snug sm:leading-normal">
              {categoryEmoji}
            </span>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5 min-w-0 flex-1">
            <span className="truncate font-semibold text-gray-900">
              {categoryLabel}
            </span>
            <span className="hidden sm:inline text-blue-400 font-bold shrink-0">
              →
            </span>

            {/* Second line: snug when short, capped when both are long */}
            <div className="flex items-center gap-1 min-w-0">
              <span className="max-w-[45%] sm:max-w-none truncate text-gray-700">
                {fieldSummary}
              </span>
              <span className="text-blue-400 font-bold shrink-0">→</span>
              <span className="min-w-0 flex-1 truncate font-semibold text-blue-700">
                {valueSummary}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {canSaveView && onSaveExplorerView && (
            <button
              type="button"
              onClick={() =>
                onSaveExplorerView({
                  categoryId: selectedCategoryId,
                  fieldKey: selectedFieldKey,
                  fieldValue: selectedValue,
                  suggestedName: suggestedViewName,
                })
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 text-[13.9px] font-semibold transition-colors cursor-pointer"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save View</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleFields}
            aria-expanded={showFilterFields}
            aria-controls="explorer-filter-fields"
            aria-label={showFilterFields ? 'Hide filters' : 'Show filters'}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 text-[13.9px] font-semibold transition-colors cursor-pointer"
          >
            <span className="hidden sm:inline">
              {showFilterFields ? 'Hide' : 'Filters'}
            </span>
            {showFilterFields ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Dropdowns: Category -> Field -> Auto-populated Value */}
      {showFilterFields && (
        <div
          id="explorer-filter-fields"
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          <div>
            <label
              htmlFor="explorer-category"
              className="block text-[13.9px] font-bold uppercase tracking-wider text-gray-500 mb-1"
            >
              1. Category
            </label>
            <select
              id="explorer-category"
              value={selectedCategoryId}
              onChange={(e) => onCategoryChange(e.target.value)}
              style={{ fontSize: '16px' }}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:border-blue-400"
            >
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.icon ? `${cat.icon} ` : ''}
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="explorer-field"
              className="block text-[13.9px] font-bold uppercase tracking-wider text-gray-500 mb-1"
            >
              2. Field
            </label>
            <select
              id="explorer-field"
              value={selectedFieldKey}
              onChange={(e) => onFieldChange(e.target.value)}
              disabled={availableFields.length === 0}
              style={{ fontSize: '16px' }}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:border-blue-400"
            >
              {availableFields.length === 0 ? (
                <option value="">No fields found</option>
              ) : (
                availableFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="explorer-value"
              className="block text-[13.9px] font-bold uppercase tracking-wider text-gray-500 mb-1"
            >
              3. Logged Value
            </label>
            <select
              id="explorer-value"
              value={selectedValue}
              onChange={(e) => onValueChange(e.target.value)}
              disabled={!selectedFieldKey}
              style={{ fontSize: '16px' }}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:border-blue-400"
            >
              <option value={ALL_VALUES_SENTINEL}>
                All values ({categoryLogsCount})
              </option>
              {valueOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.value} ({item.count})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}