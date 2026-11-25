import { FieldStat, formatMetric } from '@/lib/analytics/aggregations';

export interface FieldBreakdownRow {
  valueKey: string;
  label: string;
  count: number;
  metricValue: number | null;
  metricPercentage: number | null;
}

export interface SelectableBreakdownField {
  key: string;
  label: string;
  kind: 'boolean' | 'attribute' | 'title' | 'notes' | 'tags';
  candidateKeys: string[];
  isSelectField?: boolean;
}

const BASE_TITLE_KEY = '__base_title__';
const BASE_NOTES_KEY = '__base_notes__';
const BASE_TAGS_KEY = '__base_tags__';

function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseNumericValue(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[^0-9.-]+/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.') return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseTimeToHours(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  const secs = match[3] ? Number(match[3]) : 0;
  if (
    Number.isNaN(hours) ||
    Number.isNaN(mins) ||
    Number.isNaN(secs) ||
    hours > 23 ||
    mins > 59 ||
    secs > 59
  ) {
    return null;
  }
  return hours + mins / 60 + secs / 3600;
}

function extractLogMetricValue(log: any, metricField: FieldStat): number | null {
  const attrs = log?.attributes;
  if (!attrs || typeof attrs !== 'object') return null;

  if (metricField.type === 'duration' && metricField.key.startsWith('duration_')) {
    const parts = metricField.key.replace(/^duration_/, '').split('_');
    if (parts.length >= 2) {
      const startH = parseTimeToHours(attrs[parts[0]]);
      const endH = parseTimeToHours(attrs[parts[1]]);
      if (startH !== null && endH !== null) {
        let diff = endH - startH;
        if (diff < 0) diff += 24;
        return diff;
      }
    }
  }

  if (metricField.key in attrs) {
    return parseNumericValue(attrs[metricField.key]);
  }

  const normalizedTarget = normalizeKey(metricField.key);
  for (const [attrKey, val] of Object.entries(attrs)) {
    if (normalizeKey(attrKey) === normalizedTarget) {
      return parseNumericValue(val);
    }
  }

  return null;
}

function findAttributeEntry(
  attrs: Record<string, any>,
  field: SelectableBreakdownField
): { key: string; value: unknown } | null {
  for (const candidate of field.candidateKeys) {
    if (candidate in attrs) {
      return { key: candidate, value: attrs[candidate] };
    }
  }

  const normalizedCandidates = new Set(field.candidateKeys.map(normalizeKey));
  for (const [attrKey, val] of Object.entries(attrs)) {
    if (normalizedCandidates.has(normalizeKey(attrKey))) {
      return { key: attrKey, value: val };
    }
  }

  return null;
}

function hasNonEmptyFieldValue(
  rawVal: unknown,
  kind: SelectableBreakdownField['kind']
): boolean {
  if (kind === 'tags') {
    return (
      Array.isArray(rawVal) &&
      rawVal.some((t) => t !== undefined && t !== null && String(t).trim() !== '')
    );
  }
  return rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '';
}

function logMatchesBreakdownField(log: any, field: SelectableBreakdownField): boolean {
  if (field.kind === 'title') {
    return hasNonEmptyFieldValue(log?.title, 'title');
  }
  if (field.kind === 'notes') {
    return hasNonEmptyFieldValue(log?.notes, 'notes');
  }
  if (field.kind === 'tags') {
    return hasNonEmptyFieldValue(log?.tags, 'tags');
  }

  const attrs = log?.attributes;
  if (!attrs || typeof attrs !== 'object') return false;
  const found = findAttributeEntry(attrs, field);
  if (!found) return false;
  return hasNonEmptyFieldValue(found.value, field.kind);
}

export function getBreakdownableFields(
  logs: any[],
  fieldStats: FieldStat[],
  categories: any[] = []
): SelectableBreakdownField[] {
  const result: SelectableBreakdownField[] = [];
  const seenNormalized = new Set<string>();

  const templateMetaByNorm = new Map<
    string,
    { label: string; isSelect: boolean; keys: Set<string> }
  >();

  for (const cat of categories || []) {
    for (const field of cat?.fields || []) {
      const rawKey = field?.name || field?.key || field?.label;
      if (!rawKey) continue;
      const norm = normalizeKey(String(rawKey));
      const fType = String(field?.fieldType || field?.type || '').toLowerCase();
      const isSelect = ['select', 'dropdown', 'radio'].includes(fType);

      const entry = templateMetaByNorm.get(norm) || {
        label: field?.label || String(rawKey),
        isSelect: false,
        keys: new Set<string>(),
      };

      if (field?.label) entry.label = field.label;
      if (isSelect) entry.isSelect = true;
      if (field?.name) entry.keys.add(field.name);
      if (field?.key) entry.keys.add(field.key);
      if (field?.label) {
        entry.keys.add(field.label);
        entry.keys.add(normalizeKey(field.label));
      }

      templateMetaByNorm.set(norm, entry);
    }
  }

  // 1. Boolean fields from fieldStats
  for (const stat of fieldStats) {
    const norm = normalizeKey(stat.key);
    if (stat.type === 'boolean' && !seenNormalized.has(norm)) {
      seenNormalized.add(norm);
      const meta = templateMetaByNorm.get(norm);
      const keys = new Set<string>([stat.key, ...(meta?.keys || [])]);
      result.push({
        key: stat.key,
        label: stat.label,
        kind: 'boolean',
        candidateKeys: Array.from(keys),
      });
    }
  }

  // 2. Discrete/text/select attribute fields across filtered logs
  const numericNorms = new Set(
    fieldStats.filter((f) => f.type !== 'boolean').map((f) => normalizeKey(f.key))
  );
  const candidateCounts = new Map<
    string,
    { count: number; isSelect: boolean; label: string; keys: Set<string> }
  >();

  for (const log of logs || []) {
    const attrs = log?.attributes;
    if (!attrs || typeof attrs !== 'object') continue;

    for (const [key, val] of Object.entries(attrs)) {
      const norm = normalizeKey(key);
      if (!norm || seenNormalized.has(norm) || numericNorms.has(norm)) continue;
      if (val === undefined || val === null || String(val).trim() === '') continue;
      if (typeof val === 'boolean') continue;
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) continue;

      const meta = templateMetaByNorm.get(norm);
      const isSelect = Boolean(meta?.isSelect);

      if (!isSelect && parseNumericValue(val) !== null) continue;

      const existing = candidateCounts.get(norm) || {
        count: 0,
        isSelect,
        label:
          meta?.label ||
          key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        keys: new Set<string>([key, ...(meta?.keys || [])]),
      };

      existing.count += 1;
      existing.keys.add(key);
      candidateCounts.set(norm, existing);
    }
  }

  const sortedCandidates = Array.from(candidateCounts.entries()).sort((a, b) => {
    if (a[1].isSelect !== b[1].isSelect) return b[1].isSelect ? 1 : -1;
    return b[1].count - a[1].count;
  });

  for (const [norm, info] of sortedCandidates) {
    if (seenNormalized.has(norm)) continue;
    seenNormalized.add(norm);
    result.push({
      key: Array.from(info.keys)[0] || norm,
      label: info.label,
      kind: 'attribute',
      candidateKeys: Array.from(info.keys),
      isSelectField: info.isSelect,
    });
  }

  // 3. Base log fields: Title, Notes, Tags
  const hasTitleLogs = (logs || []).some((l) => hasNonEmptyFieldValue(l?.title, 'title'));
  if (hasTitleLogs) {
    result.push({
      key: BASE_TITLE_KEY,
      label: 'Title',
      kind: 'title',
      candidateKeys: ['title'],
    });
  }

  const hasNotesLogs = (logs || []).some((l) => hasNonEmptyFieldValue(l?.notes, 'notes'));
  if (hasNotesLogs) {
    result.push({
      key: BASE_NOTES_KEY,
      label: 'Notes',
      kind: 'notes',
      candidateKeys: ['notes'],
    });
  }

  const hasTagsLogs = (logs || []).some((l) => hasNonEmptyFieldValue(l?.tags, 'tags'));
  if (hasTagsLogs) {
    result.push({
      key: BASE_TAGS_KEY,
      label: 'Tags',
      kind: 'tags',
      candidateKeys: ['tags'],
    });
  }

  return result;
}

export function getPertinentMetricsForField(
  logs: any[],
  field: SelectableBreakdownField | undefined,
  fieldStats: FieldStat[]
): FieldStat[] {
  if (!field) return [];

  const candidateMetrics = fieldStats.filter((f) => f.type !== 'boolean');
  if (candidateMetrics.length === 0) return [];

  const matchingLogs = (logs || []).filter((log) => logMatchesBreakdownField(log, field));
  if (matchingLogs.length === 0) return [];

  return candidateMetrics.filter((metric) =>
    matchingLogs.some((log) => extractLogMetricValue(log, metric) !== null)
  );
}

export function buildFieldBreakdown(
  logs: any[],
  field: SelectableBreakdownField | undefined,
  metricField?: FieldStat
): { rows: FieldBreakdownRow[]; hasMetricValues: boolean } {
  if (!field) return { rows: [], hasMetricValues: false };

  const buckets = new Map<
    string,
    {
      label: string;
      count: number;
      metricSum: number;
      hasMetric: boolean;
    }
  >();

  let totalMatchedItems = 0;

  const addBucketOccurrence = (
    log: any,
    bucketKey: string,
    bucketLabel: string
  ) => {
    totalMatchedItems += 1;
    const existing = buckets.get(bucketKey) || {
      label: bucketLabel,
      count: 0,
      metricSum: 0,
      hasMetric: false,
    };

    existing.count += 1;

    if (metricField) {
      const num = extractLogMetricValue(log, metricField);
      if (num !== null) {
        existing.metricSum += num;
        existing.hasMetric = true;
      }
    }

    buckets.set(bucketKey, existing);
  };

  for (const log of logs || []) {
    if (!logMatchesBreakdownField(log, field)) continue;

    if (field.kind === 'title') {
      const label = String(log.title).trim();
      addBucketOccurrence(log, label.toLowerCase(), label);
      continue;
    }

    if (field.kind === 'notes') {
      const label = String(log.notes).trim();
      addBucketOccurrence(log, label.toLowerCase(), label);
      continue;
    }

    if (field.kind === 'tags') {
      const uniqueTagsInLog = new Set<string>();
      for (const rawTag of log.tags || []) {
        const cleanTag = String(rawTag ?? '').trim();
        if (!cleanTag) continue;
        const key = cleanTag.toLowerCase();
        if (uniqueTagsInLog.has(key)) continue;
        uniqueTagsInLog.add(key);
        addBucketOccurrence(log, key, cleanTag);
      }
      continue;
    }

    const attrs = log?.attributes;
    if (!attrs || typeof attrs !== 'object') continue;
    const found = findAttributeEntry(attrs, field);
    if (!found) continue;

    const rawVal = found.value;
    if (field.kind === 'boolean') {
      const checked = Boolean(rawVal);
      addBucketOccurrence(
        log,
        checked ? 'checked' : 'unchecked',
        checked ? 'Checked' : 'Unchecked'
      );
    } else {
      const label = String(rawVal).trim();
      addBucketOccurrence(log, label.toLowerCase(), label);
    }
  }

  if (totalMatchedItems === 0) return { rows: [], hasMetricValues: false };

  const rawEntries = Array.from(buckets.entries()).map(([valueKey, b]) => ({
    valueKey,
    label: b.label,
    count: b.count,
    rawMetricSum: b.hasMetric ? b.metricSum : null,
  }));

  const hasMetricValues =
    Boolean(metricField) && rawEntries.some((r) => r.rawMetricSum !== null);

  const totalMetricSum = hasMetricValues
    ? rawEntries.reduce((acc, r) => acc + (r.rawMetricSum ?? 0), 0)
    : 0;

  const rows: FieldBreakdownRow[] = rawEntries
    .map((r) => ({
      valueKey: r.valueKey,
      label: r.label,
      count: r.count,
      metricValue: hasMetricValues ? (r.rawMetricSum ?? 0) : null,
      metricPercentage:
        hasMetricValues && totalMetricSum > 0
          ? ((r.rawMetricSum ?? 0) / totalMetricSum) * 100
          : null,
    }))
    .sort((a, b) => b.count - a.count);

  return { rows, hasMetricValues };
}

export function formatBreakdownNumeric(val: number, type?: string): string {
  return String(formatMetric(val, type || 'number'));
}