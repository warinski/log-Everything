'use client';

import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Clock,
  Loader2,
} from 'lucide-react';
import { LogItem } from '@/components/LogCard';
import {
  ExplorerFieldOption,
  ExplorerSortConfig,
  formatLastModified,
  formatTagsDisplay,
  normalizeFieldValue,
  parseTagsInput,
  resolveLogAttribute,
} from '@/lib/analytics/fieldValueExplorer';

interface ExplorerLogsCardsProps {
  sortedLogs: LogItem[];
  activeField: ExplorerFieldOption | null;
  selectedFieldKey: string;
  attributeFields: ExplorerFieldOption[];
  sortConfig: ExplorerSortConfig | null;
  onToggleSort: (columnKey: string) => void;
  showSortBar?: boolean;
  isEditMode: boolean;
  draftTitles: Record<string, string>;
  onDraftTitleChange: (logId: string, val: string) => void;
  onCommitTitle: (log: LogItem, nextTitleValue: string) => void;
  draftInputs: Record<string, string>;
  onDraftInputChange: (cellId: string, val: string) => void;
  onCommitAttribute: (log: LogItem, field: ExplorerFieldOption, nextRawValue: string) => void;
  draftNotes: Record<string, string>;
  onDraftNotesChange: (logId: string, val: string) => void;
  onCommitNotes: (log: LogItem, nextNotesValue: string) => void;
  draftTags: Record<string, string>;
  onDraftTagsChange: (logId: string, val: string) => void;
  onCommitTags: (log: LogItem, nextTagsRaw: string) => void;
  savingCellKey: string | null;
}

export default function ExplorerLogsCards({
  sortedLogs,
  activeField,
  selectedFieldKey,
  attributeFields,
  sortConfig,
  onToggleSort,
  showSortBar = false,
  isEditMode,
  draftTitles,
  onDraftTitleChange,
  onCommitTitle,
  draftInputs,
  onDraftInputChange,
  onCommitAttribute,
  draftNotes,
  onDraftNotesChange,
  onCommitNotes,
  draftTags,
  onDraftTagsChange,
  onCommitTags,
  savingCellKey,
}: ExplorerLogsCardsProps) {
  const sortOptions: Array<{ key: string; label: string }> = [
    { key: '__title__', label: 'Title' },
    ...attributeFields.map((f) => ({ key: f.key, label: f.label })),
    { key: '__notes__', label: 'Notes' },
    { key: '__tags__', label: 'Tags' },
    { key: '__last_modified__', label: 'Last Modified' },
  ];

  const [selectedSortKey, setSelectedSortKey] = useState<string>(
    sortConfig?.columnKey || '__last_modified__'
  );

  useEffect(() => {
    if (sortConfig?.columnKey) {
      setSelectedSortKey(sortConfig.columnKey);
    }
  }, [sortConfig?.columnKey]);

  useEffect(() => {
    if (!sortOptions.some((opt) => opt.key === selectedSortKey)) {
      setSelectedSortKey('__last_modified__');
    }
  }, [attributeFields, selectedSortKey]);

  const isSelectedColumnSorted =
    Boolean(sortConfig) && sortConfig?.columnKey === selectedSortKey;

  const handleDirectionToggle = () => {
    if (!sortConfig || sortConfig.columnKey !== selectedSortKey) {
      // First click on selected column: sort ascending, then next click will be descending
      onToggleSort(selectedSortKey);
      return;
    }

    if (sortConfig.direction === 'asc') {
      // Switch from ascending to descending
      onToggleSort(selectedSortKey);
      return;
    }

    // If currently descending, toggle once to clear/asc and once to return to asc so it alternates Asc <-> Desc
    onToggleSort(selectedSortKey);
    onToggleSort(selectedSortKey);
  };

  return (
    <div className="space-y-2.5">
      {/* Toggleable Sort Control Bar for Card View */}
      {showSortBar && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-100/70 bg-blue-50/30 px-3 py-1.5 text-xs">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-bold uppercase tracking-wider text-gray-500 shrink-0 text-[11px]">
              Sort
            </span>
            <select
              aria-label="Sort entries by"
              value={selectedSortKey}
              onChange={(e) => {
                const nextKey = e.target.value;
                setSelectedSortKey(nextKey);
                onToggleSort(nextKey);
              }}
              style={{ fontSize: '15.2px' }}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-900 focus:outline-none focus:border-blue-400"
            >
              {sortOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleDirectionToggle}
            aria-label="Toggle sort direction"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-700 hover:bg-gray-50 shrink-0 cursor-pointer font-semibold"
          >
            {!isSelectedColumnSorted ? (
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
            ) : sortConfig?.direction === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
            )}
            <span>
              {isSelectedColumnSorted && sortConfig?.direction === 'desc'
                ? 'Desc'
                : 'Asc'}
            </span>
          </button>
        </div>
      )}

      {/* Scrollable Cards Feed */}
      <div className="max-h-[560px] overflow-y-auto space-y-2 pr-0.5 [-webkit-overflow-scrolling:touch]">
        {sortedLogs.map((log) => {
          const formattedModified = formatLastModified(log);
          const currentTitle = log.title || '';
          const draftTitleVal = draftTitles[log._id] ?? currentTitle;
          const isSavingTitle = savingCellKey === `${log._id}::__title__`;
          const hasTitleDraftChange = draftTitleVal !== currentTitle;

          const currentNotes = log.notes || '';
          const draftNoteVal = draftNotes[log._id] ?? currentNotes;
          const isSavingNotes = savingCellKey === `${log._id}::__notes__`;
          const hasNotesDraftChange = draftNoteVal !== currentNotes;

          const currentTagsDisplay = formatTagsDisplay(log.tags);
          const draftTagsVal = draftTags[log._id] ?? currentTagsDisplay;
          const isSavingTags = savingCellKey === `${log._id}::__tags__`;
          const hasTagsDraftChange =
            parseTagsInput(draftTagsVal).join(',') !==
            parseTagsInput(currentTagsDisplay).join(',');

          const parsedTags = Array.isArray(log.tags)
            ? log.tags.filter(Boolean)
            : parseTagsInput(currentTagsDisplay);

          const isTitleActive = activeField?.kind === 'title';
          const isNotesActive = activeField?.kind === 'notes';
          const isTagsActive = activeField?.kind === 'tags';

          const hasViewNotes = Boolean(currentNotes);
          const hasViewTags = parsedTags.length > 0;

          return (
            <div
              key={log._id}
              className="bg-white border border-blue-100 hover:border-blue-300 rounded-xl p-3.5 sm:p-4 shadow-2xs transition-all space-y-2.5"
            >
              {/* Timestamp + Title */}
              <div className="space-y-1">
                {formattedModified && (
                  <div className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-gray-500 bg-blue-50/50 px-2 py-0.5 rounded-md border border-blue-100/60">
                    <Clock className="w-3 h-3 text-blue-500 shrink-0" />
                    <span>{formattedModified}</span>
                  </div>
                )}

                <div
                  className={`rounded-lg ${
                    isTitleActive ? 'bg-blue-50/60 px-1.5 py-0.5 -mx-1.5' : ''
                  }`}
                >
                  {isSavingTitle ? (
                    <span className="inline-flex items-center gap-1 text-[15.2px] text-blue-600 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </span>
                  ) : isEditMode ? (
                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Title {isTitleActive ? '· active' : ''}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          aria-label={`Title for ${currentTitle}`}
                          value={draftTitleVal}
                          onChange={(e) => onDraftTitleChange(log._id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') onCommitTitle(log, draftTitleVal);
                            if (e.key === 'Escape')
                              onDraftTitleChange(log._id, currentTitle);
                          }}
                          style={{ fontSize: '15.2px' }}
                          className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 font-bold text-gray-900 focus:outline-none focus:border-blue-400"
                        />
                        {hasTitleDraftChange && (
                          <button
                            type="button"
                            onClick={() => onCommitTitle(log, draftTitleVal)}
                            aria-label={`Save title for ${currentTitle}`}
                            title="Save title"
                            className="p-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 leading-snug break-words">
                      {currentTitle || '—'}{' '}
                      {isTitleActive && (
                        <span className="text-[11px] font-semibold text-blue-600">
                          (active)
                        </span>
                      )}
                    </h3>
                  )}
                </div>
              </div>

              {/* Compact Multi-Column Attributes Strip */}
              {attributeFields.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 py-2 px-2.5 bg-blue-50/30 rounded-xl border border-blue-100/50 text-xs">
                  {attributeFields.map((field) => {
                    const cellId = `${log._id}::${field.key}`;
                    const { value: rawVal } = resolveLogAttribute(log.attributes, field);
                    const currentRaw = normalizeFieldValue(rawVal);
                    const draftVal = draftInputs[cellId] ?? currentRaw;
                    const isFilteredField = field.key === selectedFieldKey;
                    const isSaving = savingCellKey === cellId;
                    const normalizedType = (field.type || '').toLowerCase();
                    const hasPresetOptions =
                      Array.isArray(field.options) && field.options.length > 0;
                    const hasDraftChange = draftVal !== currentRaw;

                    return (
                      <div
                        key={field.key}
                        className={`min-w-0 rounded-md ${
                          isFilteredField ? 'bg-blue-100/50 px-1.5 py-0.5 -mx-1' : ''
                        }`}
                      >
                        <span
                          className={`block uppercase text-[10px] font-semibold truncate ${
                            isFilteredField ? 'text-blue-700' : 'text-blue-400'
                          }`}
                        >
                          {field.label}
                          {isFilteredField ? ' · active' : ''}
                        </span>

                        {isSaving ? (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving...</span>
                          </span>
                        ) : !isEditMode ? (
                          <span className="font-semibold text-gray-800 text-[13.9px] sm:text-[15.2px] break-words block">
                            {currentRaw !== '' ? currentRaw : '—'}
                          </span>
                        ) : hasPresetOptions ? (
                          <select
                            aria-label={`${field.label} for ${log.title}`}
                            value={currentRaw}
                            onChange={(e) =>
                              onCommitAttribute(log, field, e.target.value)
                            }
                            style={{ fontSize: '15.2px' }}
                            className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-900 focus:outline-none focus:border-blue-400"
                          >
                            <option value="">—</option>
                            {!field.options!.includes(currentRaw) &&
                              currentRaw !== '' && (
                                <option value={currentRaw}>{currentRaw}</option>
                              )}
                            {field.options!.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : normalizedType === 'boolean' ||
                          normalizedType === 'checkbox' ? (
                          <select
                            aria-label={`${field.label} for ${log.title}`}
                            value={currentRaw}
                            onChange={(e) =>
                              onCommitAttribute(log, field, e.target.value)
                            }
                            style={{ fontSize: '15.2px' }}
                            className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-900 focus:outline-none focus:border-blue-400"
                          >
                            <option value="">—</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : (
                          <div className="mt-0.5 flex items-center gap-1">
                            <input
                              type={
                                normalizedType === 'number'
                                  ? 'number'
                                  : normalizedType === 'date'
                                  ? 'date'
                                  : 'text'
                              }
                              aria-label={`${field.label} for ${log.title}`}
                              value={draftVal}
                              onChange={(e) =>
                                onDraftInputChange(cellId, e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')
                                  onCommitAttribute(log, field, draftVal);
                                if (e.key === 'Escape')
                                  onDraftInputChange(cellId, currentRaw);
                              }}
                              style={{ fontSize: '15.2px' }}
                              className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-900 focus:outline-none focus:border-blue-400"
                            />
                            {hasDraftChange && (
                              <button
                                type="button"
                                onClick={() => onCommitAttribute(log, field, draftVal)}
                                aria-label={`Save ${field.label} for ${log.title}`}
                                title="Save value"
                                className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Notes & Tags Row */}
              {isEditMode ? (
                <div className="grid grid-cols-2 gap-3 items-start">
                  {/* Notes Column */}
                  <div
                    className={`min-w-0 rounded-lg px-2 py-1.5 ${
                      isNotesActive ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    {isSavingNotes ? (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </span>
                    ) : (
                      <div className="space-y-1">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Notes {isNotesActive ? '· active' : ''}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            aria-label={`Notes for ${log.title}`}
                            placeholder="Add notes..."
                            value={draftNoteVal}
                            onChange={(e) => onDraftNotesChange(log._id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') onCommitNotes(log, draftNoteVal);
                              if (e.key === 'Escape')
                                onDraftNotesChange(log._id, currentNotes);
                            }}
                            style={{ fontSize: '15.2px' }}
                            className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-gray-900 focus:outline-none focus:border-blue-400"
                          />
                          {hasNotesDraftChange && (
                            <button
                              type="button"
                              onClick={() => onCommitNotes(log, draftNoteVal)}
                              aria-label={`Save notes for ${log.title}`}
                              title="Save notes"
                              className="p-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tags Column */}
                  <div
                    className={`min-w-0 rounded-lg px-2 py-1.5 ${
                      isTagsActive ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    {isSavingTags ? (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </span>
                    ) : (
                      <div className="space-y-1">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Tags {isTagsActive ? '· active' : ''}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            aria-label={`Tags for ${log.title}`}
                            placeholder="tag1, tag2..."
                            value={draftTagsVal}
                            onChange={(e) => onDraftTagsChange(log._id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') onCommitTags(log, draftTagsVal);
                              if (e.key === 'Escape')
                                onDraftTagsChange(log._id, currentTagsDisplay);
                            }}
                            style={{ fontSize: '15.2px' }}
                            className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-gray-900 focus:outline-none focus:border-blue-400"
                          />
                          {hasTagsDraftChange && (
                            <button
                              type="button"
                              onClick={() => onCommitTags(log, draftTagsVal)}
                              aria-label={`Save tags for ${log.title}`}
                              title="Save tags"
                              className="p-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                (hasViewNotes || hasViewTags) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start pt-0.5">
                    {hasViewNotes && (
                      <div
                        className={`min-w-0 rounded-lg ${
                          !hasViewTags ? 'sm:col-span-2' : ''
                        } ${isNotesActive ? 'bg-blue-50/50 px-2 py-1' : ''}`}
                      >
                        <p className="text-xs sm:text-sm text-gray-600 whitespace-pre-wrap break-words">
                          {currentNotes}
                        </p>
                      </div>
                    )}

                    {hasViewTags && (
                      <div
                        className={`min-w-0 rounded-lg ${
                          !hasViewNotes ? 'sm:col-span-2' : ''
                        } ${isTagsActive ? 'bg-blue-50/50 px-2 py-1' : ''}`}
                      >
                        <div className="flex flex-wrap gap-1.5">
                          {parsedTags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[11px] sm:text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}