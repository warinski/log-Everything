'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  LayoutGrid,
  Loader2,
  Pencil,
  Table2,
  X,
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
  userId?: string;
  sortedLogs: LogItem[];
  activeField: ExplorerFieldOption | null;
  selectedFieldKey: string;
  selectedValue?: string;
  attributeFields: ExplorerFieldOption[];
  sortConfig: ExplorerSortConfig | null;
  onToggleSort: (columnKey: string) => void;
  onClearSort: () => void;
  draftTitles: Record<string, string>;
  onDraftTitleChange: (logId: string, val: string) => void;
  onCommitTitle: (log: LogItem, nextTitleValue: string) => Promise<void> | void;
  draftInputs: Record<string, string>;
  onDraftInputChange: (cellId: string, val: string) => void;
  onCommitAttribute: (
    log: LogItem,
    field: ExplorerFieldOption,
    nextRawValue: string
  ) => Promise<void> | void;
  draftNotes: Record<string, string>;
  onDraftNotesChange: (logId: string, val: string) => void;
  onCommitNotes: (log: LogItem, nextNotesValue: string) => Promise<void> | void;
  draftTags: Record<string, string>;
  onDraftTagsChange: (logId: string, val: string) => void;
  onCommitTags: (log: LogItem, nextTagsRaw: string) => Promise<void> | void;
  savingCellKey: string | null;
  onDeleteLog?: (id: string) => void;
  onTagClick?: (tag: string) => void;
  onLogAgain?: (log: LogItem) => Promise<void> | void;
  onRefreshLogs?: () => void;
}

type ExplorerViewMode = 'table' | 'cards';

type SingleCellTarget = {
  logId: string;
  kind: 'title' | 'attribute' | 'notes' | 'tags';
  fieldKey?: string;
};

export default function ExplorerLogsTable({
  userId = '',
  sortedLogs,
  activeField,
  selectedFieldKey,
  selectedValue,
  attributeFields,
  sortConfig,
  onToggleSort,
  onClearSort,
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
  onDeleteLog,
  onTagClick,
  onLogAgain,
  onRefreshLogs,
}: ExplorerLogsTableProps) {
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const tableBoxRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const [viewMode, setViewMode] = useState<ExplorerViewMode>('table');
  const [hasManualViewChoice, setHasManualViewChoice] = useState(false);

  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [activeCellEditor, setActiveCellEditor] = useState<SingleCellTarget | null>(null);
  const [isSavingRow, setIsSavingRow] = useState(false);
  const [floatingActionTop, setFloatingActionTop] = useState<number | null>(null);

  useEffect(() => {
    if (hasManualViewChoice) return;
    const syncWithViewport = () => {
      setViewMode(window.innerWidth < 640 ? 'cards' : 'table');
    };
    syncWithViewport();
    window.addEventListener('resize', syncWithViewport);
    return () => window.removeEventListener('resize', syncWithViewport);
  }, [hasManualViewChoice]);

  const commitSingleCell = useCallback(
    async (target: SingleCellTarget) => {
      const log = sortedLogs.find((item) => item._id === target.logId);
      if (!log) return;

      if (target.kind === 'title') {
        const currentTitle = log.title ?? '';
        const nextTitle = draftTitles[log._id] ?? currentTitle;
        if (nextTitle.trim() && nextTitle !== currentTitle) {
          await onCommitTitle(log, nextTitle);
        } else {
          onDraftTitleChange(log._id, currentTitle);
        }
        return;
      }

      if (target.kind === 'notes') {
        const currentNotes = log.notes ?? '';
        const nextNotes = draftNotes[log._id] ?? currentNotes;
        if (nextNotes !== currentNotes) {
          await onCommitNotes(log, nextNotes);
        }
        return;
      }

      if (target.kind === 'tags') {
        const currentTagsStr = formatTagsDisplay(log.tags);
        const nextTagsStr = draftTags[log._id] ?? currentTagsStr;
        if (
          parseTagsInput(nextTagsStr).join(',') !==
          parseTagsInput(currentTagsStr).join(',')
        ) {
          await onCommitTags(log, nextTagsStr);
        }
        return;
      }

      if (target.kind === 'attribute' && target.fieldKey) {
        const field = attributeFields.find((f) => f.key === target.fieldKey);
        if (!field) return;
        const cellId = `${log._id}::${field.key}`;
        const { value: rawVal } = resolveLogAttribute(log.attributes, field);
        const currentRaw = normalizeFieldValue(rawVal);
        const nextVal = draftInputs[cellId] ?? currentRaw;
        if (nextVal !== currentRaw) {
          await onCommitAttribute(log, field, nextVal);
        }
      }
    },
    [
      sortedLogs,
      draftTitles,
      onCommitTitle,
      onDraftTitleChange,
      draftNotes,
      onCommitNotes,
      draftTags,
      onCommitTags,
      attributeFields,
      draftInputs,
      onCommitAttribute,
    ]
  );

  const saveEntireRowById = useCallback(
    async (logId: string) => {
      const log = sortedLogs.find((item) => item._id === logId);
      if (!log || isSavingRow) return;

      try {
        setIsSavingRow(true);

        const nextTitle = draftTitles[log._id] ?? log.title ?? '';
        if (nextTitle.trim() && nextTitle !== (log.title ?? '')) {
          await onCommitTitle(log, nextTitle);
        }

        for (const field of attributeFields) {
          const cellId = `${log._id}::${field.key}`;
          const { value: rawVal } = resolveLogAttribute(log.attributes, field);
          const currentRaw = normalizeFieldValue(rawVal);
          const nextVal = draftInputs[cellId] ?? currentRaw;
          if (nextVal !== currentRaw) {
            await onCommitAttribute(log, field, nextVal);
          }
        }

        const currentNotes = log.notes ?? '';
        const nextNotes = draftNotes[log._id] ?? currentNotes;
        if (nextNotes !== currentNotes) {
          await onCommitNotes(log, nextNotes);
        }

        const currentTagsStr = formatTagsDisplay(log.tags);
        const nextTagsStr = draftTags[log._id] ?? currentTagsStr;
        if (
          parseTagsInput(nextTagsStr).join(',') !==
          parseTagsInput(currentTagsStr).join(',')
        ) {
          await onCommitTags(log, nextTagsStr);
        }
      } finally {
        setIsSavingRow(false);
      }
    },
    [
      sortedLogs,
      isSavingRow,
      draftTitles,
      onCommitTitle,
      attributeFields,
      draftInputs,
      onCommitAttribute,
      draftNotes,
      onCommitNotes,
      draftTags,
      onCommitTags,
    ]
  );

  const syncFloatingActionPosition = useCallback(() => {
    const activeRowId = editingRowId || highlightedRowId;
    if (!activeRowId || !tableBoxRef.current) {
      setFloatingActionTop(null);
      return;
    }

    const rowEl = rowRefs.current[activeRowId];
    const boxRect = tableBoxRef.current.getBoundingClientRect();
    if (!rowEl || boxRect.height <= 0) {
      setFloatingActionTop(null);
      return;
    }

    const rowRect = rowEl.getBoundingClientRect();
    const centerY = rowRect.top - boxRect.top + rowRect.height / 2;
    const clampedY = Math.max(22, Math.min(boxRect.height - 22, centerY));
    setFloatingActionTop(clampedY);
  }, [editingRowId, highlightedRowId]);

  useLayoutEffect(() => {
    syncFloatingActionPosition();
  }, [syncFloatingActionPosition, sortedLogs, viewMode, activeCellEditor]);

  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    const handleViewportShift = () => syncFloatingActionPosition();

    scrollEl?.addEventListener('scroll', handleViewportShift, { passive: true });
    window.addEventListener('resize', handleViewportShift);
    window.addEventListener('scroll', handleViewportShift, { passive: true });

    return () => {
      scrollEl?.removeEventListener('scroll', handleViewportShift);
      window.removeEventListener('resize', handleViewportShift);
      window.removeEventListener('scroll', handleViewportShift);
    };
  }, [syncFloatingActionPosition]);

  // Auto-save edits and exit edit mode when clicking outside the active editor/row
  useEffect(() => {
    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (tableContainerRef.current && !tableContainerRef.current.contains(target)) {
        if (editingRowId) {
          const rowToSave = editingRowId;
          setEditingRowId(null);
          setActiveCellEditor(null);
          setHighlightedRowId(null);
          void saveEntireRowById(rowToSave);
          return;
        }

        if (activeCellEditor) {
          const cellToSave = activeCellEditor;
          setActiveCellEditor(null);
          setHighlightedRowId(null);
          void commitSingleCell(cellToSave);
          return;
        }

        setHighlightedRowId(null);
        return;
      }

      if (editingRowId) {
        const activeRowEl = rowRefs.current[editingRowId];
        if (activeRowEl && !activeRowEl.contains(target)) {
          const rowToSave = editingRowId;
          setEditingRowId(null);
          setActiveCellEditor(null);
          void saveEntireRowById(rowToSave);
        }
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => document.removeEventListener('pointerdown', handlePointerDownOutside);
  }, [editingRowId, activeCellEditor, saveEntireRowById, commitSingleCell]);

  const handleSelectViewMode = (mode: ExplorerViewMode) => {
    setHasManualViewChoice(true);
    setViewMode(mode);
    setEditingRowId(null);
    setActiveCellEditor(null);
    setHighlightedRowId(null);
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

  const isCellEditing = (
    logId: string,
    kind: SingleCellTarget['kind'],
    fieldKey?: string
  ) => {
    if (editingRowId === logId) return true;
    if (
      !activeCellEditor ||
      activeCellEditor.logId !== logId ||
      activeCellEditor.kind !== kind
    ) {
      return false;
    }
    if (kind === 'attribute') {
      return activeCellEditor.fieldKey === fieldKey;
    }
    return true;
  };

  const openSingleCellEdit = (
    e: React.MouseEvent,
    log: LogItem,
    kind: SingleCellTarget['kind'],
    field?: ExplorerFieldOption
  ) => {
    e.stopPropagation();
    if (editingRowId === log._id) return;

    if (
      activeCellEditor &&
      (activeCellEditor.logId !== log._id ||
        activeCellEditor.kind !== kind ||
        activeCellEditor.fieldKey !== field?.key)
    ) {
      void commitSingleCell(activeCellEditor);
    }

    setHighlightedRowId(log._id);

    if (kind === 'title') {
      onDraftTitleChange(log._id, draftTitles[log._id] ?? log.title ?? '');
    } else if (kind === 'notes') {
      onDraftNotesChange(log._id, draftNotes[log._id] ?? log.notes ?? '');
    } else if (kind === 'tags') {
      onDraftTagsChange(log._id, draftTags[log._id] ?? formatTagsDisplay(log.tags));
    } else if (kind === 'attribute' && field) {
      const cellId = `${log._id}::${field.key}`;
      const { value: rawVal } = resolveLogAttribute(log.attributes, field);
      onDraftInputChange(cellId, draftInputs[cellId] ?? normalizeFieldValue(rawVal));
    }

    setActiveCellEditor({
      logId: log._id,
      kind,
      fieldKey: field?.key,
    });
  };

  const handleStartRowEdit = (e: React.MouseEvent, log: LogItem) => {
    e.stopPropagation();
    setHighlightedRowId(log._id);
    setActiveCellEditor(null);

    onDraftTitleChange(log._id, log.title ?? '');
    onDraftNotesChange(log._id, log.notes ?? '');
    onDraftTagsChange(log._id, formatTagsDisplay(log.tags));

    attributeFields.forEach((field) => {
      const cellId = `${log._id}::${field.key}`;
      const { value: rawVal } = resolveLogAttribute(log.attributes, field);
      onDraftInputChange(cellId, normalizeFieldValue(rawVal));
    });

    setEditingRowId(log._id);
  };

  const handleSaveEntireRow = async (e: React.MouseEvent, log: LogItem) => {
    e.stopPropagation();
    await saveEntireRowById(log._id);
    setEditingRowId(null);
    setActiveCellEditor(null);
  };

  const handleCancelRowEdit = (e: React.MouseEvent, log: LogItem) => {
    e.stopPropagation();
    onDraftTitleChange(log._id, log.title ?? '');
    onDraftNotesChange(log._id, log.notes ?? '');
    onDraftTagsChange(log._id, formatTagsDisplay(log.tags));
    attributeFields.forEach((field) => {
      const cellId = `${log._id}::${field.key}`;
      const { value: rawVal } = resolveLogAttribute(log.attributes, field);
      onDraftInputChange(cellId, normalizeFieldValue(rawVal));
    });
    setEditingRowId(null);
    setActiveCellEditor(null);
  };

  const activeRowForAction = editingRowId
    ? sortedLogs.find((item) => item._id === editingRowId) || null
    : highlightedRowId
    ? sortedLogs.find((item) => item._id === highlightedRowId) || null
    : null;

  return (
    <div ref={tableContainerRef} className="space-y-2.5 pt-1">
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

        <div className="flex items-center gap-2 ml-auto">
          <div
            role="group"
            aria-label="Explorer view mode"
            className="inline-flex items-center rounded-xl border border-gray-200 bg-gray-50 p-0.5"
          >
            <button
              type="button"
              onClick={() => handleSelectViewMode('cards')}
              aria-pressed={viewMode === 'cards'}
              title="Cards view"
              aria-label="Cards view"
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13.9px] font-medium transition-colors cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Cards</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectViewMode('table')}
              aria-pressed={viewMode === 'table'}
              title="Table view"
              aria-label="Table view"
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13.9px] font-medium transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Table2 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'cards' ? (
        <ExplorerLogsCards
          userId={userId}
          sortedLogs={sortedLogs}
          activeField={activeField}
          selectedFieldKey={selectedFieldKey}
          selectedValue={selectedValue}
          attributeFields={attributeFields}
          sortConfig={sortConfig}
          onToggleSort={onToggleSort}
          onDeleteLog={onDeleteLog}
          onTagClick={onTagClick}
          onLogAgain={onLogAgain}
          onRefreshLogs={onRefreshLogs}
        />
      ) : sortedLogs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-[15.2px] text-gray-500">
          No logs in this category match the selected field value.
        </div>
      ) : (
        <div
          ref={tableBoxRef}
          className="relative rounded-xl border border-blue-200/80 bg-white shadow-2xs"
        >
          {/* Edit / Save Action Pinned to the Right Edge of the Table Container */}
          {activeRowForAction && floatingActionTop !== null && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{ top: `${floatingActionTop}px` }}
              className="absolute right-2.5 -translate-y-1/2 z-30 flex items-center gap-1.5 rounded-xl bg-white/95 backdrop-blur-xs p-1.5 shadow-md border border-blue-300"
            >
              {editingRowId === activeRowForAction._id ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => void handleSaveEntireRow(e, activeRowForAction)}
                    disabled={isSavingRow}
                    title="Save entire row"
                    aria-label="Save entire row"
                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSavingRow ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleCancelRowEdit(e, activeRowForAction)}
                    title="Cancel row edit"
                    aria-label="Cancel row edit"
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={(e) => handleStartRowEdit(e, activeRowForAction)}
                  title="Edit entire row"
                  aria-label={`Edit entire row for ${activeRowForAction.title || 'entry'}`}
                  className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          <div
            ref={scrollContainerRef}
            className="rounded-xl overflow-x-auto [-webkit-overflow-scrolling:touch]"
          >
            <table className="w-max min-w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/90 text-[13.9px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="py-2.5 px-3 whitespace-nowrap bg-gray-50">
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
                    return (
                      <th
                        key={field.key}
                        className={`py-2.5 px-3 whitespace-nowrap ${
                          isFilteredField
                            ? 'text-blue-700 bg-blue-50/70'
                            : isSortedCol
                            ? 'text-gray-900 bg-gray-100/70'
                            : 'text-gray-600'
                        }`}
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
                    className={`py-2.5 px-3 whitespace-nowrap ${
                      activeField?.kind === 'notes' ? 'text-blue-700 bg-blue-50/70' : ''
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
                    className={`py-2.5 px-3 whitespace-nowrap ${
                      activeField?.kind === 'tags' ? 'text-blue-700 bg-blue-50/70' : ''
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

                  <th className="py-2.5 px-3 pr-14 whitespace-nowrap">
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
                  const isHighlighted = highlightedRowId === log._id;
                  const isRowEditing = editingRowId === log._id;

                  const formattedModified = formatLastModified(log);
                  const currentTitle = log.title || '';
                  const draftTitleVal = draftTitles[log._id] ?? currentTitle;
                  const isSavingTitle = savingCellKey === `${log._id}::__title__`;
                  const hasTitleDraftChange = draftTitleVal !== currentTitle;
                  const editingTitle = isCellEditing(log._id, 'title');

                  const currentNotes = log.notes || '';
                  const draftNoteVal = draftNotes[log._id] ?? currentNotes;
                  const isSavingNotes = savingCellKey === `${log._id}::__notes__`;
                  const hasNotesDraftChange = draftNoteVal !== currentNotes;
                  const editingNotes = isCellEditing(log._id, 'notes');

                  const currentTagsDisplay = formatTagsDisplay(log.tags);
                  const draftTagsVal = draftTags[log._id] ?? currentTagsDisplay;
                  const isSavingTags = savingCellKey === `${log._id}::__tags__`;
                  const hasTagsDraftChange =
                    parseTagsInput(draftTagsVal).join(',') !==
                    parseTagsInput(currentTagsDisplay).join(',');
                  const editingTags = isCellEditing(log._id, 'tags');

                  const rowPronouncedClass = isRowEditing
                    ? 'bg-blue-100/80 border-l-4 border-l-blue-600 ring-2 ring-inset ring-blue-400/70'
                    : isHighlighted
                    ? 'bg-blue-100/65 border-l-4 border-l-blue-600 ring-2 ring-inset ring-blue-400/60'
                    : 'border-l-4 border-l-transparent hover:bg-blue-50/25';

                  return (
                    <tr
                      key={log._id}
                      ref={(el) => {
                        rowRefs.current[log._id] = el;
                      }}
                      onClick={() => {
                        if (!isRowEditing) {
                          setHighlightedRowId((prev) =>
                            prev === log._id ? null : log._id
                          );
                        }
                      }}
                      className={`group align-top transition-colors cursor-pointer ${rowPronouncedClass}`}
                    >
                      {/* Title Cell */}
                      <td
                        className={`py-2.5 px-3 max-w-[220px] ${
                          activeField?.kind === 'title' ? 'bg-blue-50/70' : ''
                        }`}
                      >
                        {isSavingTitle ? (
                          <span className="inline-flex items-center gap-1 text-[15.2px] text-blue-600 font-medium whitespace-nowrap">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Saving...</span>
                          </span>
                        ) : editingTitle ? (
                          <div
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 max-w-[205px]"
                          >
                            <input
                              type="text"
                              autoFocus={!isRowEditing}
                              aria-label={`Title for ${currentTitle}`}
                              value={draftTitleVal}
                              onChange={(e) => onDraftTitleChange(log._id, e.target.value)}
                              onBlur={() => {
                                if (!isRowEditing) {
                                  void commitSingleCell({
                                    logId: log._id,
                                    kind: 'title',
                                  });
                                  setActiveCellEditor(null);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void commitSingleCell({
                                    logId: log._id,
                                    kind: 'title',
                                  });
                                  if (!isRowEditing) setActiveCellEditor(null);
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  onDraftTitleChange(log._id, currentTitle);
                                  setActiveCellEditor(null);
                                }
                              }}
                              style={{ fontSize: '16px' }}
                              className="min-w-[110px] max-w-[175px] rounded-lg border border-blue-400 bg-white px-2 py-1 font-semibold text-gray-900 focus:outline-none focus:border-blue-600"
                            />
                            {!isRowEditing && hasTitleDraftChange && (
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  void commitSingleCell({
                                    logId: log._id,
                                    kind: 'title',
                                  });
                                  setActiveCellEditor(null);
                                }}
                                aria-label={`Save title for ${currentTitle}`}
                                title="Save title"
                                className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span
                            onDoubleClick={(e) => openSingleCellEdit(e, log, 'title')}
                            title="Single-click row to highlight, double-click to edit title"
                            className="font-semibold text-gray-900 break-words block"
                          >
                            {currentTitle || '—'}
                          </span>
                        )}
                      </td>

                      {/* Dynamic Attribute Cells (All in read mode until double-clicked or row-edited) */}
                      {attributeFields.map((field) => {
                        const cellId = `${log._id}::${field.key}`;
                        const { value: rawVal } = resolveLogAttribute(
                          log.attributes,
                          field
                        );
                        const currentRaw = normalizeFieldValue(rawVal);
                        const draftVal = draftInputs[cellId] ?? currentRaw;
                        const isFilteredField = field.key === selectedFieldKey;
                        const isSaving = savingCellKey === cellId;
                        const normalizedType = (field.type || '').toLowerCase();
                        const hasPresetOptions =
                          Array.isArray(field.options) && field.options.length > 0;
                        const hasDraftChange = draftVal !== currentRaw;
                        const editingAttr = isCellEditing(
                          log._id,
                          'attribute',
                          field.key
                        );

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
                            ) : !editingAttr ? (
                              <span
                                onDoubleClick={(e) =>
                                  openSingleCellEdit(e, log, 'attribute', field)
                                }
                                title="Double-click to edit field"
                                className="text-gray-800 break-words inline-block min-w-[36px]"
                              >
                                {currentRaw !== '' ? currentRaw : '—'}
                              </span>
                            ) : hasPresetOptions ? (
                              <select
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus={!isRowEditing}
                                aria-label={`${field.label} for ${log.title}`}
                                value={draftVal}
                                onChange={(e) => {
                                  const nextOption = e.target.value;
                                  onDraftInputChange(cellId, nextOption);
                                  if (!isRowEditing) {
                                    void onCommitAttribute(log, field, nextOption);
                                    setActiveCellEditor(null);
                                  }
                                }}
                                onBlur={() => {
                                  if (!isRowEditing) {
                                    setActiveCellEditor(null);
                                  }
                                }}
                                style={{ fontSize: '16px' }}
                                className="rounded-lg border border-blue-400 bg-white px-2.5 py-1 text-gray-900 focus:outline-none focus:border-blue-600 cursor-pointer max-w-[250px]"
                              >
                                <option value="">—</option>
                                {!field.options!.includes(draftVal) &&
                                  draftVal !== '' && (
                                    <option value={draftVal}>{draftVal}</option>
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
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus={!isRowEditing}
                                aria-label={`${field.label} for ${log.title}`}
                                value={draftVal}
                                onChange={(e) => {
                                  const nextBool = e.target.value;
                                  onDraftInputChange(cellId, nextBool);
                                  if (!isRowEditing) {
                                    void onCommitAttribute(log, field, nextBool);
                                    setActiveCellEditor(null);
                                  }
                                }}
                                onBlur={() => {
                                  if (!isRowEditing) {
                                    setActiveCellEditor(null);
                                  }
                                }}
                                style={{ fontSize: '16px' }}
                                className="rounded-lg border border-blue-400 bg-white px-2.5 py-1 text-gray-900 focus:outline-none focus:border-blue-600 cursor-pointer"
                              >
                                <option value="">—</option>
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            ) : (
                              <div
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 max-w-[250px]"
                              >
                                <input
                                  type={
                                    normalizedType === 'number'
                                      ? 'number'
                                      : normalizedType === 'date'
                                      ? 'date'
                                      : 'text'
                                  }
                                  autoFocus={!isRowEditing}
                                  aria-label={`${field.label} for ${log.title}`}
                                  value={draftVal}
                                  onChange={(e) =>
                                    onDraftInputChange(cellId, e.target.value)
                                  }
                                  onBlur={() => {
                                    if (!isRowEditing) {
                                      void commitSingleCell({
                                        logId: log._id,
                                        kind: 'attribute',
                                        fieldKey: field.key,
                                      });
                                      setActiveCellEditor(null);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      void commitSingleCell({
                                        logId: log._id,
                                        kind: 'attribute',
                                        fieldKey: field.key,
                                      });
                                      if (!isRowEditing) setActiveCellEditor(null);
                                    }
                                    if (e.key === 'Escape') {
                                      e.preventDefault();
                                      onDraftInputChange(cellId, currentRaw);
                                      setActiveCellEditor(null);
                                    }
                                  }}
                                  style={{ fontSize: '16px' }}
                                  className="min-w-[92px] max-w-[220px] rounded-lg border border-blue-400 bg-white px-2.5 py-1 text-gray-900 focus:outline-none focus:border-blue-600"
                                />
                                {!isRowEditing && hasDraftChange && (
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      void commitSingleCell({
                                        logId: log._id,
                                        kind: 'attribute',
                                        fieldKey: field.key,
                                      });
                                      setActiveCellEditor(null);
                                    }}
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

                      {/* Notes Cell */}
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
                        ) : editingNotes ? (
                          <div
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 max-w-[280px]"
                          >
                            <input
                              type="text"
                              autoFocus={!isRowEditing}
                              aria-label={`Notes for ${log.title}`}
                              placeholder="Add notes..."
                              value={draftNoteVal}
                              onChange={(e) =>
                                onDraftNotesChange(log._id, e.target.value)
                              }
                              onBlur={() => {
                                if (!isRowEditing) {
                                  void commitSingleCell({
                                    logId: log._id,
                                    kind: 'notes',
                                  });
                                  setActiveCellEditor(null);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void commitSingleCell({
                                    logId: log._id,
                                    kind: 'notes',
                                  });
                                  if (!isRowEditing) setActiveCellEditor(null);
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  onDraftNotesChange(log._id, currentNotes);
                                  setActiveCellEditor(null);
                                }
                              }}
                              style={{ fontSize: '16px' }}
                              className="min-w-[130px] max-w-[245px] rounded-lg border border-blue-400 bg-white px-2.5 py-1 text-gray-900 focus:outline-none focus:border-blue-600"
                            />
                            {!isRowEditing && hasNotesDraftChange && (
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  void commitSingleCell({
                                    logId: log._id,
                                    kind: 'notes',
                                  });
                                  setActiveCellEditor(null);
                                }}
                                aria-label={`Save notes for ${log.title}`}
                                title="Save notes"
                                className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span
                            onDoubleClick={(e) => openSingleCellEdit(e, log, 'notes')}
                            title="Double-click to edit notes"
                            className="text-gray-700 break-words inline-block min-w-[40px]"
                          >
                            {currentNotes || '—'}
                          </span>
                        )}
                      </td>

                      {/* Tags Cell */}
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
                        ) : editingTags ? (
                          <div
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 max-w-[260px]"
                          >
                            <input
                              type="text"
                              autoFocus={!isRowEditing}
                              aria-label={`Tags for ${log.title}`}
                              placeholder="tag1, tag2..."
                              value={draftTagsVal}
                              onChange={(e) => onDraftTagsChange(log._id, e.target.value)}
                              onBlur={() => {
                                if (!isRowEditing) {
                                  void commitSingleCell({
                                    logId: log._id,
                                    kind: 'tags',
                                  });
                                  setActiveCellEditor(null);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void commitSingleCell({
                                    logId: log._id,
                                    kind: 'tags',
                                  });
                                  if (!isRowEditing) setActiveCellEditor(null);
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  onDraftTagsChange(log._id, currentTagsDisplay);
                                  setActiveCellEditor(null);
                                }
                              }}
                              style={{ fontSize: '16px' }}
                              className="min-w-[120px] max-w-[225px] rounded-lg border border-blue-400 bg-white px-2.5 py-1 text-gray-900 focus:outline-none focus:border-blue-600"
                            />
                            {!isRowEditing && hasTagsDraftChange && (
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  void commitSingleCell({
                                    logId: log._id,
                                    kind: 'tags',
                                  });
                                  setActiveCellEditor(null);
                                }}
                                aria-label={`Save tags for ${log.title}`}
                                title="Save tags"
                                className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span
                            onDoubleClick={(e) => openSingleCellEdit(e, log, 'tags')}
                            title="Double-click to edit tags"
                            className="text-gray-700 break-words inline-block min-w-[40px]"
                          >
                            {currentTagsDisplay || '—'}
                          </span>
                        )}
                      </td>

                      {/* Last Modified Cell */}
                      <td className="py-2.5 px-3 pr-14 text-[13.9px] text-gray-400 whitespace-nowrap">
                        <span>{formattedModified || '—'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}