'use client';

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

export default function FilterBar({
  categories,
  selectedCategory,
  setSelectedCategory,
  selectedTags,
  removeTag,
  searchQuery,
  setSearchQuery,
  onClearAll,
}: FilterBarProps) {
  const hasActiveFilters = selectedCategory !== '' || selectedTags.length > 0 || searchQuery !== '';

  return (
    <div className="bg-white border border-blue-100 rounded-xl p-3 shadow-xs space-y-2.5">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs or dynamic fields..."
            style={{ fontSize: '16px' }}
            className="w-full pl-9 pr-3.5 py-2 bg-blue-50/30 border border-blue-100 rounded-lg text-gray-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Category Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ fontSize: '16px' }}
            className="w-full sm:w-44 bg-blue-50/30 border border-blue-100 rounded-lg px-3 py-2 text-gray-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.icon ? `${cat.icon} ` : ''}{cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={onClearAll}
            style={{ fontSize: '16px' }}
            className="text-gray-500 hover:text-red-600 font-medium px-2.5 py-2 transition-colors shrink-0 cursor-pointer"
          >
            Reset Filters
          </button>
        )}
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