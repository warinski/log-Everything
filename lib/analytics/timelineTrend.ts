import { FieldStat, formatMetric } from '@/lib/analytics/aggregations';

export type TrendGranularity = 'day' | 'week' | 'month';

export interface TrendPoint {
  key: string;
  label: string;
  fullLabel: string;
  value: number;
  valueLabel: string;
  count: number;
}

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 (Sun) .. 6 (Sat)
  const diff = day === 0 ? -6 : 1 - day; // Monday as start of week
  d.setDate(d.getDate() + diff);
  return d;
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

function getLogDate(log: any): Date | null {
  if (log?.attributes && typeof log.attributes === 'object') {
    const dateKey = Object.keys(log.attributes).find(
      (k) => k.toLowerCase() === 'date' || k.toLowerCase().includes('date')
    );
    if (dateKey && log.attributes[dateKey]) {
      const parsedAttrDate = new Date(log.attributes[dateKey]);
      if (!Number.isNaN(parsedAttrDate.getTime())) {
        return parsedAttrDate;
      }
    }
  }

  const raw = log?.timestamp || log?.loggedAt || log?.createdAt || log?.updatedAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildTimelineTrend(
  logs: any[],
  granularity: TrendGranularity,
  selectedMetricKey: string,
  fieldStats: FieldStat[]
): TrendPoint[] {
  const activeField =
    selectedMetricKey === '__count__'
      ? undefined
      : fieldStats.find((f) => f.key === selectedMetricKey);

  const buckets = new Map<
    string,
    {
      sortTs: number;
      label: string;
      fullLabel: string;
      sum: number;
      count: number;
    }
  >();

  for (const log of logs || []) {
    const date = getLogDate(log);
    if (!date) continue;

    let key = '';
    let label = '';
    let fullLabel = '';
    let sortTs = 0;

    if (granularity === 'day') {
      key = toLocalDateKey(date);
      label = `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
      fullLabel = `${label}, ${date.getFullYear()}`;
      sortTs = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    } else if (granularity === 'week') {
      const weekStart = getWeekStart(date);
      key = `wk:${toLocalDateKey(weekStart)}`;
      label = `Wk ${MONTH_SHORT[weekStart.getMonth()]} ${weekStart.getDate()}`;
      fullLabel = `Week of ${MONTH_SHORT[weekStart.getMonth()]} ${weekStart.getDate()}, ${weekStart.getFullYear()}`;
      sortTs = weekStart.getTime();
    } else {
      const mStr = String(date.getMonth() + 1).padStart(2, '0');
      key = `${date.getFullYear()}-${mStr}`;
      label = `${MONTH_SHORT[date.getMonth()]} '${String(date.getFullYear()).slice(-2)}`;
      fullLabel = `${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}`;
      sortTs = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    }

    const existing = buckets.get(key) || {
      sortTs,
      label,
      fullLabel,
      sum: 0,
      count: 0,
    };

    existing.count += 1;

    if (activeField && log.attributes && typeof log.attributes === 'object') {
      const num = parseNumericValue(log.attributes[activeField.key]);
      if (num !== null) {
        existing.sum += num;
      }
    }

    buckets.set(key, existing);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => a[1].sortTs - b[1].sortTs)
    .map(([key, b]) => {
      const rawVal = activeField ? b.sum : b.count;
      const valueLabel = activeField
        ? String(formatMetric(b.sum, activeField.type))
        : `${b.count} ${b.count === 1 ? 'log' : 'logs'}`;

      return {
        key,
        label: b.label,
        fullLabel: b.fullLabel,
        value: rawVal,
        valueLabel,
        count: b.count,
      };
    });
}