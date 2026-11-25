'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { LogItem } from '@/components/LogCard';
import { updateLog } from '@/lib/actions/logActions';
import {
  ALL_VALUES_SENTINEL,
  buildSuggestedExplorerViewName,
  coerceFieldValue,
  ExplorerFieldOption,
  ExplorerSortConfig,
  ExplorerViewSaveConfig,
  filterAndSortExplorerLogs,
  formatTagsDisplay,
  getAvailableExplorerFields,
  getExplorerValueOptions,
  normalizeFieldValue,
  parseTagsInput,
  pickPreferredFieldKey,
  resolveLogAttribute,
} from '@/lib/analytics/fieldValueExplorer';
import ExplorerFilterBar from '@/components/analytics/ExplorerFilterBar';
import ExplorerLogsTable from '@/components/analytics/ExplorerLogsTable';

export type { ExplorerFieldOption };

interface FieldValueExplorerProps {
  userId: string;
  categories: any[];
  logs: LogItem[];
  onLogUpdated?: (updatedLog: LogItem) => void;
  onSaveExplorerView?: (config: ExplorerViewSaveConfig) => void;
}

const SORTABLE_META_COLUMNS = new Set([
  '__title__',
  '__notes__',
  '__tags__',
  '__last_modified__',
]);

export default function FieldValueExplorer({
  userId,
  categories,
  logs,
  onLogUpdated,
  onSaveExplorerView,
}: FieldValueExplorerProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedFieldKey, setSelectedFieldKey] = useState<string>('');
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<ExplorerSortConfig | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  const [draftTitles, setDraftTitles] = useState<Record<string, string>>({});
  const [draftInputs, setDraftInputs] = useState<Record<string, string>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [draftTags, setDraftTags] = useState<Record<string, string>>({});
  const [savingCellKey, setSavingCellKey] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(String(categories[0]._id));
    }
  }, [categories, selectedCategoryId]);

  const selectedCategoryObj = useMemo(
    () => categories.find((c) => String(c._id) === String(selectedCategoryId)),
    [categories, selectedCategoryId]
  );

  const categoryLogs = useMemo(() => {
    if (!selectedCategoryId) return [];
    return logs.filter(
      (log) => log.categoryId && String(log.categoryId) === String(selectedCategoryId)
    );
  }, [logs, selectedCategoryId]);

  const availableFields = useMemo(
    () => getAvailableExplorerFields(selectedCategoryObj, categoryLogs),
    [selectedCategoryObj, categoryLogs]
  );

  useEffect(() => {
    if (availableFields.length === 0) {
      setSelectedFieldKey('');
      setSelectedValue('');
      return;
    }
    if (!availableFields.some((f) => f.key === selectedFieldKey)) {
      setSelectedFieldKey(pickPreferredFieldKey(availableFields));
      setSelectedValue('');
    }
  }, [availableFields, selectedFieldKey]);

  useEffect(() => {
    if (!sortConfig) return;
    if (
      !SORTABLE_META_COLUMNS.has(sortConfig.columnKey) &&
      !availableFields.some((f) => f.key === sortConfig.columnKey)
    ) {
      setSortConfig(null);
    }
  }, [availableFields, sortConfig]);

  const activeField = useMemo(
    () => availableFields.find((f) => f.key === selectedFieldKey) || null,
    [availableFields, selectedFieldKey]
  );

  const attributeFields = useMemo(
    () => availableFields.filter((f) => (f.kind || 'attribute') === 'attribute'),
    [availableFields]
  );

  const valueOptions = useMemo(
    () => getExplorerValueOptions(categoryLogs, activeField),
    [categoryLogs, activeField]
  );

  useEffect(() => {
    if (!activeField) {
      setSelectedValue('');
      return;
    }
    if (
      selectedValue !== '' &&
      (selectedValue === ALL_VALUES_SENTINEL ||
        valueOptions.some((v) => v.value === selectedValue))
    ) {
      return;
    }
    const firstWithLogs = valueOptions.find((v) => v.count > 0);
    if (firstWithLogs) setSelectedValue(firstWithLogs.value);
    else if (valueOptions.length > 0) setSelectedValue(valueOptions[0].value);
    else setSelectedValue(ALL_VALUES_SENTINEL);
  }, [activeField, valueOptions, selectedValue]);

  const sortedLogs = useMemo(
    () =>
      filterAndSortExplorerLogs(
        categoryLogs,
        activeField,
        selectedValue,
        sortConfig,
        attributeFields
      ),
    [categoryLogs, activeField, selectedValue, sortConfig, attributeFields]
  );

  useEffect(() => {
    if (sortedLogs.length === 0) return;
    setDraftTitles((prev) => {
      const next = { ...prev };
      for (const log of sortedLogs) {
        if (!(log._id in next)) next[log._id] = log.title || '';
      }
      return next;
    });
    setDraftInputs((prev) => {
      const next = { ...prev };
      for (const log of sortedLogs) {
        for (const field of attributeFields) {
          const cellId = `${log._id}::${field.key}`;
          if (!(cellId in next)) {
            next[cellId] = normalizeFieldValue(
              resolveLogAttribute(log.attributes, field).value
            );
          }
        }
      }
      return next;
    });
    setDraftNotes((prev) => {
      const next = { ...prev };
      for (const log of sortedLogs) {
        if (!(log._id in next)) next[log._id] = log.notes || '';
      }
      return next;
    });
    setDraftTags((prev) => {
      const next = { ...prev };
      for (const log of sortedLogs) {
        if (!(log._id in next)) next[log._id] = formatTagsDisplay(log.tags);
      }
      return next;
    });
  }, [sortedLogs, attributeFields]);

  const handleToggleSort = (columnKey: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.columnKey !== columnKey) {
        return { columnKey, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { columnKey, direction: 'desc' };
      }
      return null;
    });
  };

  const commitInlineTitleUpdate = async (log: LogItem, nextTitleValue: string) => {
    if (savingCellKey) return;
    const trimmed = nextTitleValue.trim();
    if (!trimmed) {
      setFeedbackMessage('Title cannot be empty.');
      return;
    }

    setSavingCellKey(`${log._id}::__title__`);
    setFeedbackMessage(null);
    try {
      const updated = await updateLog(log._id, userId, { title: trimmed });
      const mergedLog: LogItem = {
        ...log,
        ...(updated || {}),
        title: updated?.title ?? trimmed,
      };
      setDraftTitles((prev) => ({ ...prev, [log._id]: mergedLog.title || '' }));
      setFeedbackMessage(`Updated title to "${mergedLog.title}".`);
      onLogUpdated?.(mergedLog);
    } catch (error) {
      console.error('Failed to update title inline:', error);
      setFeedbackMessage('Could not update title. Please try again.');
    } finally {
      setSavingCellKey(null);
    }
  };

  const commitInlineFieldUpdate = async (
    log: LogItem,
    field: ExplorerFieldOption,
    nextRawValue: string
  ) => {
    if (savingCellKey) return;
    const cellId = `${log._id}::${field.key}`;
    const coerced = coerceFieldValue(nextRawValue, field.type);
    const { attrKey } = resolveLogAttribute(log.attributes, field);
    const updatedAttributes = {
      ...(log.attributes || {}),
      [attrKey || field.key]: coerced,
    };

    setSavingCellKey(cellId);
    setFeedbackMessage(null);
    try {
      const updated = await updateLog(log._id, userId, {
        attributes: updatedAttributes,
      });
      const mergedLog: LogItem = {
        ...log,
        ...(updated || {}),
        attributes: updated?.attributes ?? updatedAttributes,
      };
      setDraftInputs((prev) => ({
        ...prev,
        [cellId]: normalizeFieldValue(
          resolveLogAttribute(mergedLog.attributes, field).value
        ),
      }));
      setFeedbackMessage(`Updated "${field.label}" on "${log.title}".`);
      onLogUpdated?.(mergedLog);
    } catch (error) {
      console.error('Failed to update field inline:', error);
      setFeedbackMessage('Could not update field value. Please try again.');
    } finally {
      setSavingCellKey(null);
    }
  };

  const commitInlineNotesUpdate = async (log: LogItem, nextNotesValue: string) => {
    if (savingCellKey) return;
    setSavingCellKey(`${log._id}::__notes__`);
    setFeedbackMessage(null);
    try {
      const updated = await updateLog(log._id, userId, { notes: nextNotesValue });
      const mergedLog: LogItem = {
        ...log,
        ...(updated || {}),
        notes: updated?.notes ?? nextNotesValue,
      };
      setDraftNotes((prev) => ({ ...prev, [log._id]: mergedLog.notes || '' }));
      setFeedbackMessage(`Updated notes on "${log.title}".`);
      onLogUpdated?.(mergedLog);
    } catch (error) {
      console.error('Failed to update notes inline:', error);
      setFeedbackMessage('Could not update notes. Please try again.');
    } finally {
      setSavingCellKey(null);
    }
  };

  const commitInlineTagsUpdate = async (log: LogItem, nextTagsRaw: string) => {
    if (savingCellKey) return;
    const parsedTags = parseTagsInput(nextTagsRaw);
    setSavingCellKey(`${log._id}::__tags__`);
    setFeedbackMessage(null);
    try {
      const updated = await updateLog(log._id, userId, { tags: parsedTags });
      const mergedLog: LogItem = {
        ...log,
        ...(updated || {}),
        tags: Array.isArray(updated?.tags) ? updated.tags : parsedTags,
      };
      setDraftTags((prev) => ({
        ...prev,
        [log._id]: formatTagsDisplay(mergedLog.tags),
      }));
      setFeedbackMessage(`Updated tags on "${log.title}".`);
      onLogUpdated?.(mergedLog);
    } catch (error) {
      console.error('Failed to update tags inline:', error);
      setFeedbackMessage('Could not update tags. Please try again.');
    } finally {
      setSavingCellKey(null);
    }
  };

  const suggestedViewName = useMemo(
    () =>
      buildSuggestedExplorerViewName(
        selectedCategoryObj?.name,
        selectedValue,
        activeField,
        selectedFieldKey
      ),
    [selectedCategoryObj?.name, selectedValue, activeField, selectedFieldKey]
  );

  if (categories.length === 0) return null;

  return (
    <section className="bg-white border border-blue-100 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
      <ExplorerFilterBar
        categories={categories}
        categoryLogsCount={categoryLogs.length}
        selectedCategoryId={selectedCategoryId}
        onCategoryChange={setSelectedCategoryId}
        availableFields={availableFields}
        selectedFieldKey={selectedFieldKey}
        onFieldChange={setSelectedFieldKey}
        valueOptions={valueOptions}
        selectedValue={selectedValue}
        onValueChange={setSelectedValue}
        onSaveExplorerView={onSaveExplorerView}
        suggestedViewName={suggestedViewName}
      />

      {feedbackMessage && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-blue-50/70 border border-blue-100 px-3 py-2 text-[15.2px] text-blue-800">
          <span>{feedbackMessage}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            aria-label="Dismiss status message"
            className="p-0.5 text-blue-500 hover:text-blue-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <ExplorerLogsTable
        sortedLogs={sortedLogs}
        activeField={activeField}
        selectedFieldKey={selectedFieldKey}
        attributeFields={attributeFields}
        sortConfig={sortConfig}
        onToggleSort={handleToggleSort}
        onClearSort={() => setSortConfig(null)}
        isEditMode={isEditMode}
        onToggleEditMode={() => setIsEditMode((prev) => !prev)}
        draftTitles={draftTitles}
        onDraftTitleChange={(logId, val) =>
          setDraftTitles((prev) => ({ ...prev, [logId]: val }))
        }
        onCommitTitle={commitInlineTitleUpdate}
        draftInputs={draftInputs}
        onDraftInputChange={(cellId, val) =>
          setDraftInputs((prev) => ({ ...prev, [cellId]: val }))
        }
        onCommitAttribute={commitInlineFieldUpdate}
        draftNotes={draftNotes}
        onDraftNotesChange={(logId, val) =>
          setDraftNotes((prev) => ({ ...prev, [logId]: val }))
        }
        onCommitNotes={commitInlineNotesUpdate}
        draftTags={draftTags}
        onDraftTagsChange={(logId, val) =>
          setDraftTags((prev) => ({ ...prev, [logId]: val }))
        }
        onCommitTags={commitInlineTagsUpdate}
        savingCellKey={savingCellKey}
      />
    </section>
  );
}