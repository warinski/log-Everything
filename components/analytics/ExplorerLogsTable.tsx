'use client';

import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  LayoutGrid,
  Loader2,
  Pencil,
  Table2,
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
import ExplorerLogsCards from '@/components/analytics/ExplorerLogsCards';

interface ExplorerLogsTableProps {
  sortedLogs: LogItem[];
  activeField: ExplorerFieldOption | null;
  selectedFieldKey: string;
  attributeFields: ExplorerFieldOption[];
  sortConfig: ExplorerSortConfig | null;
  onToggleSort: (columnKey: string) => void;
  onClearSort: () => void;
  isEditMode: boolean;
  onToggleEditMode: () => void;
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

type ExplorerViewMode = 'table' | 'cards';

export default function ExplorerLogsTable({
  sortedLogs,
  activeField,
  selectedFieldKey,
  attributeFields,
  sortConfig,
  onToggleSort,
  onClearSort,
  isEditMode,
  onToggleEditMode,
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
}: ExplorerLogsTableProps) {
  const [viewMode, setViewMode] = useState<ExplorerViewMode>('table');
  const [hasManualViewChoice, setHasManualViewChoice] = useState(false);
  const [showSortBar, setShowSortBar] = useState(false);

  useEffect(() => {
    if (hasManualViewChoice) return;
    const syncWithViewport = () => {
      setViewMode(window.innerWidth < 640 ? 'cards' : 'table');
    };
    syncWithViewport();
    window.addEventListener('resize', syncWithViewport);
    return () => window.removeEventListener('resize', syncWithViewport);
  }, [hasManualViewChoice]);

  const handleSelectViewMode = (mode: ExplorerViewMode) => {
    setHasManualViewChoice(true);
    setViewMode(mode);
  };

  const renderSortIcon = (columnKey: string) => {
    if (!sortConfig || sortConfig.columnKey !== columnKey) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
    );
  };

  return (
    <div className="space-y-2.5 pt-1">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[15.2px] text-gray-500">
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">
            Matching entries:{' '}
            <strong className="text-gray-800">{sortedLogs.length}</strong>
          </span>

          {sortConfig && (
            <button
              type="button"
              onClick={onClearSort}
              className="text-blue-600 hover:underline font-medium cursor-pointer"
            >
              Clear sort
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {sortedLogs.length > 0 && (
            <div
              role="group"
              aria-label="View mode"
              className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50/80 p-0.5 text-[13.9px] font-semibold"
            >
              <button
                type="button"
                onClick={() => handleSelectViewMode('cards')}
                aria-pressed={viewMode === 'cards'}
                aria-label="Cards view"
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectViewMode('table')}
                aria-pressed={viewMode === 'table'}
                aria-label="Table view"
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>
          )}

          {sortedLogs.length > 0 && viewMode === 'cards' && (
            <button
              type="button"
              onClick={() => setShowSortBar((prev) => !prev)}
              aria-pressed={showSortBar}
              aria-expanded={showSortBar}
              aria-label="Toggle sort bar"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[13.9px] font-semibold transition-colors cursor-pointer ${
                showSortBar
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sort</span>
            </button>
          )}

          {sortedLogs.length > 0 && (
            <button
              type="button"
              onClick={onToggleEditMode}
              aria-pressed={isEditMode}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[13.9px] font-semibold transition-colors cursor-pointer ${
                isEditMode
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>{isEditMode ? 'Done' : 'Edit'}</span>
            </button>
          )}
        </div>
      </div>

      {sortedLogs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-[15.2px] text-gray-500">
          No logs in this category match the selected field value.
        </div>
      ) : viewMode === 'cards' ? (
        <ExplorerLogsCards
          sortedLogs={sortedLogs}
          activeField={activeField}
          selectedFieldKey={selectedFieldKey}
          attributeFields={attributeFields}
          sortConfig={sortConfig}
          onToggleSort={onToggleSort}
          showSortBar={showSortBar}
          isEditMode={isEditMode}
          draftTitles={draftTitles}
          onDraftTitleChange={onDraftTitleChange}
          onCommitTitle={onCommitTitle}
          draftInputs={draftInputs}
          onDraftInputChange={onDraftInputChange}
          onCommitAttribute={onCommitAttribute}
          draftNotes={draftNotes}
          onDraftNotesChange={onDraftNotesChange}
          onCommitNotes={onCommitNotes}
          draftTags={draftTags}
          onDraftTagsChange={onDraftTagsChange}
          onCommitTags={onCommitTags}
          savingCellKey={savingCellKey}
        />
      ) : (
        <div className="h-[465px] sm:h-[485px] rounded-xl border border-gray-200 overflow-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-max min-w-full border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-gray-50">
              <tr className="border-b border-gray-200 bg-gray-50 text-[13.9px] font-bold uppercase tracking-wider text-gray-500">
                <th
                  className={`sticky top-0 z-20 py-2.5 px-3 max-w-[225px] whitespace-nowrap ${
                    activeField?.kind === 'title' ? 'text-blue-700 bg-blue-50' : 'bg-gray-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleSort('__title__')}
                    className="inline-flex items-center gap-1 uppercase tracking-wider text-gray-600 hover:text-gray-900 cursor-pointer"
                  >
                    <span>Title</span>
                    {activeField?.kind === 'title' && (
                      <span className="text-[13.9px] font-semibold text-blue-500">
                        - active
                      </span>
                    )}
                    {renderSortIcon('__title__')}
                  </button>
                </th>

                {attributeFields.map((field) => {
                  const isFilteredField = field.key === selectedFieldKey;
                  const isSortedCol = sortConfig?.columnKey === field.key;
                  const headerBgClass = isFilteredField
                    ? 'text-blue-700 bg-blue-50'
                    : isSortedCol
                    ? 'text-gray-900 bg-gray-100'
                    : 'text-gray-600 bg-gray-50';

                  return (
                    <th
                      key={field.key}
                      className={`sticky top-0 z-20 py-2.5 px-3 whitespace-nowrap ${headerBgClass}`}
                    >
                      <button
                        type="button"
                        onClick={() => onToggleSort(field.key)}
                        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-gray-900 cursor-pointer"
                      >
                        <span>{field.label}</span>
                        {isFilteredField && (
                          <span className="text-[13.9px] font-semibold text-blue-500">
                            - active
                          </span>
                        )}
                        {renderSortIcon(field.key)}
                      </button>
                    </th>
                  );
                })}

                <th
                  className={`sticky top-0 z-20 py-2.5 px-3 whitespace-nowrap ${
                    activeField?.kind === 'notes' ? 'text-blue-700 bg-blue-50' : 'bg-gray-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleSort('__notes__')}
                    className="inline-flex items-center gap-1 uppercase tracking-wider text-gray-600 hover:text-gray-900 cursor-pointer"
                  >
                    <span>Notes</span>
                    {activeField?.kind === 'notes' && (
                      <span className="text-[13.9px] font-semibold text-blue-500">
                        - active
                      </span>
                    )}
                    {renderSortIcon('__notes__')}
                  </button>
                </th>

                <th
                  className={`sticky top-0 z-20 py-2.5 px-3 whitespace-nowrap ${
                    activeField?.kind === 'tags' ? 'text-blue-700 bg-blue-50' : 'bg-gray-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleSort('__tags__')}
                    className="inline-flex items-center gap-1 uppercase tracking-wider text-gray-600 hover:text-gray-900 cursor-pointer"
                  >
                    <span>Tags</span>
                    {activeField?.kind === 'tags' && (
                      <span className="text-[13.9px] font-semibold text-blue-500">
                        - active
                      </span>
                    )}
                    {renderSortIcon('__tags__')}
                  </button>
                </th>

                <th className="sticky top-0 z-20 bg-gray-50 py-2.5 px-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => onToggleSort('__last_modified__')}
                    className="inline-flex items-center gap-1 uppercase tracking-wider text-gray-600 hover:text-gray-900 cursor-pointer"
                  >
                    <span>Last Modified</span>
                    {renderSortIcon('__last_modified__')}
                  </button>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 text-[15.2px]">
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

                return (
                  <tr
                    key={log._id}
                    className="hover:bg-blue-50/20 align-top transition-colors"
                  >
                    <td
                      className={`py-2.5 px-3 max-w-[225px] ${
                        activeField?.kind === 'title' ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {isSavingTitle ? (
                        <span className="inline-flex items-center gap-1 text-[15.2px] text-blue-600 font-medium whitespace-nowrap">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </span>
                      ) : isEditMode ? (
                        <div className="inline-flex items-center gap-1 max-w-[210px]">
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
                            className="min-w-[98px] max-w-[184px] rounded-lg border border-gray-200 bg-white px-2.5 py-1 font-semibold text-gray-900 focus:outline-none focus:border-blue-400"
                          />
                          {hasTitleDraftChange && (
                            <button
                              type="button"
                              onClick={() => onCommitTitle(log, draftTitleVal)}
                              aria-label={`Save title for ${currentTitle}`}
                              title="Save title"
                              className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="block truncate font-semibold text-gray-900">
                          {currentTitle || '—'}
                        </span>
                      )}
                    </td>

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
                        <td
                          key={field.key}
                          className={`py-2.5 px-3 max-w-[280px] ${
                            isFilteredField ? 'bg-blue-50/30' : ''
                          }`}
                        >
                          {isSaving ? (
                            <span className="inline-flex items-center gap-1 text-[15.2px] text-blue-600 font-medium whitespace-nowrap">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Saving...</span>
                            </span>
                          ) : !isEditMode ? (
                            <span className="block truncate text-gray-800">
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
                              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-gray-900 focus:outline-none focus:border-blue-400 cursor-pointer max-w-[250px]"
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
                              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-gray-900 focus:outline-none focus:border-blue-400 cursor-pointer"
                            >
                              <option value="">—</option>
                              <option value="true">true</option>
                              <option value="false">false</option>
                            </select>
                          ) : (
                            <div className="inline-flex items-center gap-1 max-w-[250px]">
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
                                className="min-w-[92px] max-w-[220px] rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-gray-900 focus:outline-none focus:border-blue-400"
                              />
                              {hasDraftChange && (
                                <button
                                  type="button"
                                  onClick={() => onCommitAttribute(log, field, draftVal)}
                                  aria-label={`Save ${field.label} for ${log.title}`}
                                  title="Save value"
                                  className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    <td
                      className={`py-2.5 px-3 max-w-[300px] ${
                        activeField?.kind === 'notes' ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {isSavingNotes ? (
                        <span className="inline-flex items-center gap-1 text-[15.2px] text-blue-600 font-medium whitespace-nowrap">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </span>
                      ) : isEditMode ? (
                        <div className="inline-flex items-center gap-1 max-w-[280px]">
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
                            className="min-w-[130px] max-w-[245px] rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-gray-900 focus:outline-none focus:border-blue-400"
                          />
                          {hasNotesDraftChange && (
                            <button
                              type="button"
                              onClick={() => onCommitNotes(log, draftNoteVal)}
                              aria-label={`Save notes for ${log.title}`}
                              title="Save notes"
                              className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="block truncate text-gray-600">
                          {currentNotes || '—'}
                        </span>
                      )}
                    </td>

                    <td
                      className={`py-2.5 px-3 max-w-[280px] ${
                        activeField?.kind === 'tags' ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {isSavingTags ? (
                        <span className="inline-flex items-center gap-1 text-[15.2px] text-blue-600 font-medium whitespace-nowrap">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </span>
                      ) : isEditMode ? (
                        <div className="inline-flex items-center gap-1 max-w-[260px]">
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
                            className="min-w-[120px] max-w-[225px] rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-gray-900 focus:outline-none focus:border-blue-400"
                          />
                          {hasTagsDraftChange && (
                            <button
                              type="button"
                              onClick={() => onCommitTags(log, draftTagsVal)}
                              aria-label={`Save tags for ${log.title}`}
                              title="Save tags"
                              className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="block truncate text-gray-700">
                          {currentTagsDisplay || '—'}
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-[13.9px] text-gray-400 whitespace-nowrap">
                      {formattedModified || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}