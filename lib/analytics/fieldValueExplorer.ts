import { LogItem } from '@/components/LogCard';

export interface ExplorerFieldOption {
  key: string;
  label: string;
  type?: string;
  options?: string[];
  aliases: string[];
  kind?: 'attribute' | 'title' | 'notes' | 'tags';
}

export interface ExplorerSortConfig {
  columnKey: string;
  direction: 'asc' | 'desc';
}

export interface ExplorerViewSaveConfig {
  categoryId: string;
  fieldKey: string;
  fieldValue: string;
  suggestedName: string;
}

export const ALL_VALUES_SENTINEL = '__ALL_VALUES__';
export const BASE_TITLE_KEY = '__base_title__';
export const BASE_NOTES_KEY = '__base_notes__';
export const BASE_TAGS_KEY = '__base_tags__';

const PREFERRED_FIELD_KEYS = new Set([
  'giver',
  'status',
  'progress',
  'state',
  'recipient',
]);

export function toSnakeKey(label?: string): string {
  if (!label) return '';
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function resolveLogAttribute(
  attributes: Record<string, any> | undefined,
  field?: Pick<ExplorerFieldOption, 'key' | 'aliases'>
): { attrKey: string; value: any } {
  if (!attributes || typeof attributes !== 'object' || !field) {
    return { attrKey: field?.key || '', value: undefined };
  }

  const candidates = [field.key, ...(field.aliases || [])].filter(Boolean);
  for (const candidate of candidates) {
    if (
      Object.prototype.hasOwnProperty.call(attributes, candidate) &&
      attributes[candidate] !== undefined
    ) {
      return { attrKey: candidate, value: attributes[candidate] };
    }
  }

  return { attrKey: field.key, value: undefined };
}

export function normalizeFieldValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val);
}

export function parseTagsInput(rawTags: string): string[] {
  return Array.from(
    new Set(
      rawTags
        .split(',')
        .map((t) => t.trim().replace(/^#+/, ''))
        .filter(Boolean)
    )
  );
}

export function formatTagsDisplay(tags?: string[]): string {
  if (!Array.isArray(tags) || tags.length === 0) return '';
  return tags.join(', ');
}

export function coerceFieldValue(rawValue: string, fieldType?: string): any {
  const normalizedType = (fieldType || '').toLowerCase();
  if (normalizedType === 'number') {
    if (rawValue.trim() === '') return '';
    const num = Number(rawValue);
    return Number.isNaN(num) ? rawValue : num;
  }
  if (normalizedType === 'boolean' || normalizedType === 'checkbox') {
    if (rawValue === 'true') return true;
    if (rawValue === 'false') return false;
  }
  return rawValue;
}

export function getLastModifiedRaw(log: LogItem): string | Date | undefined {
  const anyLog = log as LogItem & {
    updatedAt?: string | Date;
    createdAt?: string | Date;
  };
  return anyLog.updatedAt || log.timestamp || log.loggedAt || anyLog.createdAt;
}

export function formatLastModified(log: LogItem): string | null {
  const raw = getLastModifiedRaw(log);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function compareSortableValues(a: unknown, b: unknown, fieldType?: string): number {
  const aEmpty = a === null || a === undefined || String(a).trim() === '';
  const bEmpty = b === null || b === undefined || String(b).trim() === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  const normalizedType = (fieldType || '').toLowerCase();
  if (normalizedType === 'number' || (typeof a === 'number' && typeof b === 'number')) {
    const numA = Number(a);
    const numB = Number(b);
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      return numA - numB;
    }
  }

  if (normalizedType === 'date') {
    const timeA = new Date(String(a)).getTime();
    const timeB = new Date(String(b)).getTime();
    if (!Number.isNaN(timeA) && !Number.isNaN(timeB)) {
      return timeA - timeB;
    }
  }

  return normalizeFieldValue(a).localeCompare(normalizeFieldValue(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export function getAvailableExplorerFields(
  category: any,
  categoryLogs: LogItem[]
): ExplorerFieldOption[] {
  if (!category) return [];

  const map = new Map<string, ExplorerFieldOption>();

  if (Array.isArray(category?.fields)) {
    for (const f of category.fields) {
      const canonicalKey = String(f?.key || f?.name || toSnakeKey(f?.label) || '');
      if (!canonicalKey) continue;
      const labelStr = String(f?.label || f?.name || canonicalKey).replace(/_/g, ' ');
      const snakeLabel = toSnakeKey(f?.label);
      const aliases = Array.from(
        new Set(
          [canonicalKey, f?.key, f?.name, snakeLabel].filter(
            (x): x is string => typeof x === 'string' && x.length > 0
          )
        )
      );
      map.set(canonicalKey, {
        key: canonicalKey,
        label: labelStr,
        type: f?.fieldType || f?.type,
        options: Array.isArray(f?.options) ? f.options.map(String) : undefined,
        aliases,
        kind: 'attribute',
      });
    }
  }

  for (const log of categoryLogs) {
    if (!log.attributes || typeof log.attributes !== 'object') continue;
    for (const attrKey of Object.keys(log.attributes)) {
      const alreadyCovered = Array.from(map.values()).some((entry) =>
        entry.aliases.includes(attrKey)
      );
      if (!alreadyCovered) {
        map.set(attrKey, {
          key: attrKey,
          label: attrKey.replace(/_/g, ' '),
          aliases: [attrKey],
          kind: 'attribute',
        });
      }
    }
  }

  return [
    ...Array.from(map.values()),
    { key: BASE_TITLE_KEY, label: 'Title', aliases: [], kind: 'title' },
    { key: BASE_NOTES_KEY, label: 'Notes', aliases: [], kind: 'notes' },
    { key: BASE_TAGS_KEY, label: 'Tags', aliases: [], kind: 'tags' },
  ];
}

export function pickPreferredFieldKey(fields: ExplorerFieldOption[]): string {
  if (fields.length === 0) return '';
  const preferred = fields.find((f) => PREFERRED_FIELD_KEYS.has(f.key.toLowerCase()));
  return (preferred || fields[0]).key;
}

export function getExplorerValueOptions(
  categoryLogs: LogItem[],
  activeField: ExplorerFieldOption | null
): Array<{ value: string; count: number }> {
  if (!activeField) return [];
  const counts = new Map<string, number>();

  if (activeField.kind === 'title') {
    for (const log of categoryLogs) {
      const titleStr = (log.title || '').trim();
      if (!titleStr) continue;
      counts.set(titleStr, (counts.get(titleStr) || 0) + 1);
    }
  } else if (activeField.kind === 'notes') {
    for (const log of categoryLogs) {
      const notesStr = (log.notes || '').trim();
      if (!notesStr) continue;
      counts.set(notesStr, (counts.get(notesStr) || 0) + 1);
    }
  } else if (activeField.kind === 'tags') {
    for (const log of categoryLogs) {
      if (!Array.isArray(log.tags)) continue;
      for (const tag of log.tags) {
        const cleanTag = String(tag || '').trim();
        if (!cleanTag) continue;
        counts.set(cleanTag, (counts.get(cleanTag) || 0) + 1);
      }
    }
  } else {
    if (activeField.options) {
      for (const opt of activeField.options) {
        counts.set(opt, 0);
      }
    }

    for (const log of categoryLogs) {
      const { value: raw } = resolveLogAttribute(log.attributes, activeField);
      if (raw === undefined || raw === null || raw === '') continue;
      const normalized = normalizeFieldValue(raw);
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  }

  return Array.from(counts.entries()).map(([value, count]) => ({ value, count }));
}

export function filterAndSortExplorerLogs(
  categoryLogs: LogItem[],
  activeField: ExplorerFieldOption | null,
  selectedValue: string,
  sortConfig: ExplorerSortConfig | null,
  attributeFields: ExplorerFieldOption[]
): LogItem[] {
  if (!activeField || !selectedValue) return [];

  let matched = categoryLogs;
  if (selectedValue !== ALL_VALUES_SENTINEL) {
    if (activeField.kind === 'title') {
      matched = categoryLogs.filter((log) => (log.title || '').trim() === selectedValue);
    } else if (activeField.kind === 'notes') {
      matched = categoryLogs.filter((log) => (log.notes || '').trim() === selectedValue);
    } else if (activeField.kind === 'tags') {
      matched = categoryLogs.filter(
        (log) =>
          Array.isArray(log.tags) &&
          log.tags.some((t) => String(t || '').trim() === selectedValue)
      );
    } else {
      matched = categoryLogs.filter((log) => {
        const { value: raw } = resolveLogAttribute(log.attributes, activeField);
        return normalizeFieldValue(raw) === selectedValue;
      });
    }
  }

  if (!sortConfig) return matched;

  const fieldDef = attributeFields.find((f) => f.key === sortConfig.columnKey);
  const multiplier = sortConfig.direction === 'asc' ? 1 : -1;

  return [...matched].sort((a, b) => {
    let cmp = 0;

    if (sortConfig.columnKey === '__title__') {
      cmp = (a.title || '').localeCompare(b.title || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    } else if (sortConfig.columnKey === '__notes__') {
      cmp = compareSortableValues(a.notes || '', b.notes || '');
    } else if (sortConfig.columnKey === '__tags__') {
      cmp = compareSortableValues(formatTagsDisplay(a.tags), formatTagsDisplay(b.tags));
    } else if (sortConfig.columnKey === '__last_modified__') {
      const timeA = getLastModifiedRaw(a)
        ? new Date(String(getLastModifiedRaw(a))).getTime()
        : NaN;
      const timeB = getLastModifiedRaw(b)
        ? new Date(String(getLastModifiedRaw(b))).getTime()
        : NaN;
      if (Number.isNaN(timeA) && Number.isNaN(timeB)) cmp = 0;
      else if (Number.isNaN(timeA)) cmp = 1;
      else if (Number.isNaN(timeB)) cmp = -1;
      else cmp = timeA - timeB;
    } else if (fieldDef) {
      const valA = resolveLogAttribute(a.attributes, fieldDef).value;
      const valB = resolveLogAttribute(b.attributes, fieldDef).value;
      cmp = compareSortableValues(valA, valB, fieldDef.type);
    }

    return cmp * multiplier;
  });
}

export function buildSuggestedExplorerViewName(
  categoryName: string | undefined,
  selectedValue: string,
  activeField: ExplorerFieldOption | null,
  selectedFieldKey: string
): string {
  const catName = categoryName || 'Logs';
  if (selectedValue && selectedValue !== ALL_VALUES_SENTINEL) {
    return `${selectedValue[0].toUpperCase() + selectedValue.slice(1)} ${catName.toLowerCase()}`;
  }
  return `${catName} by ${activeField?.label || selectedFieldKey}`;
}