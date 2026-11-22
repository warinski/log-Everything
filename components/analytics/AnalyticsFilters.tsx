'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { CategoryTemplate } from '@/components/LogModal';

interface AnalyticsFiltersProps {
  categories: CategoryTemplate[];
  selectedCategories: string[];
  onToggleCategory: (categoryId: string) => void;
  onSelectAllCategories: () => void;
  onClearCategories: () => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  dateFrom: string;
  onDateFromChange: (val: string) => void;
  dateTo: string;
  onDateToChange: (val: string) => void;
}

export default function AnalyticsFilters({
  categories,
  selectedCategories,
  onToggleCategory,
  onSelectAllCategories,
  onClearCategories,
  searchQuery,
  onSearchChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: AnalyticsFiltersProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getScopeLabel = () => {
    if (selectedCategories.length === 0) return 'All Categories (Cross-Category)';
    if (selectedCategories.length === 1) {
      const cat = categories.find((c) => c._id === selectedCategories[0]);
      return cat ? (cat.icon ? `${cat.icon} ${cat.name}` : cat.name) : '1 Category';
    }
    return `${selectedCategories.length} Categories Selected`;
  };

  return (
    <div className="bg-white border border-blue-100 rounded-2xl p-3 sm:p-4 shadow-2xs grid grid-cols-1 lg:grid-cols-12 gap-3 shrink-0 box-border items-center">
      <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
        <div ref={dropdownRef} className="relative min-w-0 flex flex-col justify-center">
          <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1 truncate shrink-0">
            Category Scope
          </label>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="relative flex items-center justify-between w-full h-11 bg-blue-50/30 hover:bg-blue-50/60 border border-blue-100 focus:bg-white focus:border-blue-500 rounded-xl px-3 text-left cursor-pointer transition-colors"
          >
            <span className="text-xs sm:text-sm text-gray-800 truncate pr-6">
              {getScopeLabel()}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isDropdownOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute left-0 top-full mt-1.5 w-full min-w-[240px] bg-white border border-blue-100 rounded-xl shadow-xl z-30 p-2 space-y-1"
            >
              <div className="flex items-center justify-between px-2 py-1 border-b border-gray-100 text-[11px]">
                <button
                  type="button"
                  onClick={onSelectAllCategories}
                  className="font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={onClearCategories}
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
                            onToggleCategory(cat._id);
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
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Title, tags, attributes..."
              style={{ fontSize: '16px' }}
              className="w-full bg-transparent text-gray-900 focus:outline-none text-xs sm:text-sm border-none shadow-none m-0 p-0"
            />
          </div>
        </div>
      </div>

      <div className="lg:col-span-4 grid grid-cols-2 gap-2 min-w-0 box-border">
        <div className="min-w-0 flex flex-col justify-center">
          <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1 truncate shrink-0">
            From Date
          </label>
          <div className="relative flex items-center w-full h-11 bg-blue-50/30 border border-blue-100 rounded-xl px-2.5 focus-within:bg-white focus-within:border-blue-500 box-border overflow-hidden">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              onClick={(e) => {
                try {
                  (e.target as HTMLInputElement).showPicker?.();
                } catch {}
              }}
              style={{ fontSize: '14px', colorScheme: 'light' }}
              className={`w-full bg-transparent text-gray-800 focus:outline-none tracking-tight border-none shadow-none m-0 p-0 block truncate ${
                dateFrom ? 'pr-6' : 'pr-1'
              } [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden`}
            />
            {dateFrom && (
              <button
                type="button"
                onClick={() => onDateFromChange('')}
                className="absolute right-2 text-gray-400 hover:text-gray-600 text-sm font-bold cursor-pointer p-1 z-10 bg-transparent"
                aria-label="Clear from date"
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
              onChange={(e) => onDateToChange(e.target.value)}
              onClick={(e) => {
                try {
                  (e.target as HTMLInputElement).showPicker?.();
                } catch {}
              }}
              style={{ fontSize: '14px', colorScheme: 'light' }}
              className={`w-full bg-transparent text-gray-800 focus:outline-none tracking-tight border-none shadow-none m-0 p-0 block truncate ${
                dateTo ? 'pr-6' : 'pr-1'
              } [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden`}
            />
            {dateTo && (
              <button
                type="button"
                onClick={() => onDateToChange('')}
                className="absolute right-2 text-gray-400 hover:text-gray-600 text-sm font-bold cursor-pointer p-1 z-10 bg-transparent"
                aria-label="Clear to date"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}