'use client';

import { useState, useEffect } from 'react';
import { Search, Tag, X, Filter } from 'lucide-react';

interface CategoryOption {
  _id: string;
  name: string;
  color?: string;
  icon?: string;
}

interface FilterBarProps {
  categories: CategoryOption[];
  selectedCategory: string;
  setSelectedCategory: (id: string) => void;
  selectedTags: string[];
  removeTag: (tag: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onClearAll: () => void;
}

function FilterResetIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Filter funnel on the left */}
      <path d="M3 6h12.2l-4.6 5.8v7.6l-2.9-1.2v-6.4L3 6Z" />
      {/* Counter-clockwise reset arc & arrow on the right */}
      <path d="M15.8 13.5a5.2 5.2 0 1 1-1.4 5" />
      <path d="M14.6 11.2v3.5h3.5" />
    </svg>
  );
}

export default function FilterBar({
  categories,
  selectedCategory,
  setSelectedCategory,
  selectedTags,
  removeTag,
  searchQuery,
  setSearchQuery,
}: FilterBarProps) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 640px)');
    const updateMatch = () => setIsDesktop(mediaQuery.matches);
    updateMatch();
    mediaQuery.addEventListener('change', updateMatch);
    return () => mediaQuery.removeEventListener('change', updateMatch);
  }, []);

  return (
    <div className="bg-white border border-blue-100 rounded-xl p-3 shadow-xs space-y-2.5">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs or dynamic fields..."
            style={{ fontSize: '16px' }}
            className="w-full h-10 pl-9 pr-3.5 leading-none bg-blue-50/30 border border-blue-100 rounded-lg text-gray-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Category Filter Dropdown + Borderless Inline Reset Icon */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1 sm:flex-initial">
            <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter by category"
              style={{
                fontSize: '16px',
                ...(isDesktop
                  ? { width: '330px', minWidth: '330px', maxWidth: '330px' }
                  : {}),
              }}
              className="w-full h-10 leading-none bg-blue-50/30 border border-blue-100 rounded-lg pl-9 pr-7 text-gray-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                </option>
              ))}
            </select>
          </div>

          {selectedCategory !== '' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('')}
              title="Reset category filter"
              aria-label="Reset category filter"
              className="h-10 px-1.5 inline-flex items-center justify-center text-gray-500 hover:text-blue-600 transition-colors shrink-0 cursor-pointer"
            >
              <FilterResetIcon className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>

      {/* Selected Tags Chips Row */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-gray-100">
          <span style={{ fontSize: '13px' }} className="text-gray-400 font-medium flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" /> Active:
          </span>
          {selectedTags.map((tag) => (
            <span
              key={tag}
              style={{ fontSize: '13px' }}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-medium border border-blue-100"
            >
              #{tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:text-blue-900 rounded-full p-0.5 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}