export interface CategoryBreakdownItem {
  categoryName: string;
  count: number;
}

export interface FieldCategoryContribution {
  categoryName: string;
  count: number;
  sum: number;
  contributionPct: number;
  trueCount?: number;
  rate?: number;
}

export interface FieldStat {
  key: string;
  label: string;
  type: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  trueCount?: number;
  byCategory: FieldCategoryContribution[];
}

export interface DynamicColumn {
  key: string;
  label: string;
  type: string;
}

export interface PieSlice {
  label: string;
  valueLabel: string;
  percentage: number;
  startAngle: number;
  endAngle: number;
  color: string;
}

export const PIE_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
];

export function parseNumeric(val: any): number | null {
  if (val === null || val === undefined || val === '' || typeof val === 'boolean') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const cleaned = String(val).replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function formatMetric(val: number, type: string): string {
  if (type === 'currency') {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (type === 'duration') {
    const hours = Math.floor(val);
    const minutes = Math.round((val - hours) * 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }
  return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
}

export function discoverDynamicColumns(
  singleCategoryObj: any,
  selectedCategories: string[],
  categories: any[],
  filteredLogs: any[]
): DynamicColumn[] {
  if (singleCategoryObj?.fields && singleCategoryObj.fields.length > 0) {
    return singleCategoryObj.fields.map((f: any) => ({
      key: f.name || f.key || '',
      label: f.label || f.name || '',
      type: f.fieldType || f.type || 'text',
    }));
  }

  const keyMap = new Map<string, DynamicColumn>();
  const relevantCats =
    selectedCategories.length > 0
      ? categories.filter((c) => selectedCategories.includes(c._id))
      : categories;

  relevantCats.forEach((cat: any) => {
    cat.fields?.forEach((f: any) => {
      const key = f.name || f.key || '';
      if (key && !keyMap.has(key)) {
        keyMap.set(key, {
          key,
          label: f.label || f.name || key,
          type: f.fieldType || f.type || 'text',
        });
      }
    });
  });

  filteredLogs.forEach((log: any) => {
    if (log.attributes) {
      Object.entries(log.attributes).forEach(([k, val]) => {
        if (!keyMap.has(k)) {
          const isNum =
            typeof val === 'number' ||
            (typeof val === 'string' &&
              val.trim() !== '' &&
              !isNaN(Number(val.replace(/,/g, ''))));
          keyMap.set(k, {
            key: k,
            label: k.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
            type: typeof val === 'boolean' ? 'checkbox' : isNum ? 'number' : 'text',
          });
        }
      });
    }
  });

  return Array.from(keyMap.values());
}

export function computeAggregates(dynamicColumns: DynamicColumn[], filteredLogs: any[]) {
  const catCountMap = new Map<string, number>();
  filteredLogs.forEach((log: any) => {
    const catName = log.categoryName || 'General';
    catCountMap.set(catName, (catCountMap.get(catName) || 0) + 1);
  });

  const categoryBreakdown: CategoryBreakdownItem[] = Array.from(catCountMap.entries())
    .map(([categoryName, count]) => ({ categoryName, count }))
    .sort((a, b) => b.count - a.count);

  const fieldStats: FieldStat[] = [];

  dynamicColumns.forEach((col) => {
    if (col.type === 'checkbox' || col.type === 'boolean') {
      let trueCount = 0;
      let total = 0;
      const perCatBool = new Map<string, { trueCount: number; total: number }>();

      filteredLogs.forEach((log: any) => {
        if (log.attributes && col.key in log.attributes) {
          const catName = log.categoryName || 'General';
          const checkedVal = Boolean(log.attributes[col.key]);
          total++;
          if (checkedVal) trueCount++;

          const current = perCatBool.get(catName) || { trueCount: 0, total: 0 };
          current.total++;
          if (checkedVal) current.trueCount++;
          perCatBool.set(catName, current);
        }
      });

      if (total > 0) {
        const byCategory: FieldCategoryContribution[] = Array.from(perCatBool.entries())
          .map(([categoryName, stats]) => ({
            categoryName,
            count: stats.total,
            sum: stats.trueCount,
            contributionPct:
              trueCount > 0
                ? (stats.trueCount / trueCount) * 100
                : (stats.total / total) * 100,
            trueCount: stats.trueCount,
            rate: stats.total > 0 ? (stats.trueCount / stats.total) * 100 : 0,
          }))
          .sort((a, b) => b.contributionPct - a.contributionPct);

        fieldStats.push({
          key: col.key,
          label: col.label,
          type: 'boolean',
          count: total,
          sum: trueCount,
          avg: (trueCount / total) * 100,
          min: 0,
          max: 1,
          trueCount,
          byCategory,
        });
      }
      return;
    }

    const nums: number[] = [];
    const perCatNum = new Map<string, { sum: number; count: number }>();

    filteredLogs.forEach((log: any) => {
      const parsed = parseNumeric(log.attributes?.[col.key]);
      if (parsed !== null) {
        const catName = log.categoryName || 'General';
        nums.push(parsed);

        const current = perCatNum.get(catName) || { sum: 0, count: 0 };
        current.sum += parsed;
        current.count += 1;
        perCatNum.set(catName, current);
      }
    });

    if (nums.length > 0) {
      const sum = nums.reduce((acc, n) => acc + n, 0);
      const byCategory: FieldCategoryContribution[] = Array.from(perCatNum.entries())
        .map(([categoryName, stats]) => ({
          categoryName,
          count: stats.count,
          sum: stats.sum,
          contributionPct: sum !== 0 ? (stats.sum / sum) * 100 : 0,
        }))
        .sort((a, b) => b.sum - a.sum);

      fieldStats.push({
        key: col.key,
        label: col.label,
        type: col.type,
        count: nums.length,
        sum,
        avg: sum / nums.length,
        min: Math.min(...nums),
        max: Math.max(...nums),
        byCategory,
      });
    }
  });

  const timeFields = dynamicColumns.filter(
    (c) =>
      c.type === 'time' ||
      c.key.includes('time') ||
      c.key.includes('in') ||
      c.key.includes('out') ||
      c.key.includes('start') ||
      c.key.includes('end')
  );

  if (timeFields.length >= 2) {
    const inKeys = timeFields.filter(
      (f) => f.key.includes('in') || f.key.includes('start') || f.key.includes('from')
    );
    const outKeys = timeFields.filter(
      (f) => f.key.includes('out') || f.key.includes('end') || f.key.includes('to')
    );

    const pair =
      inKeys.length > 0 && outKeys.length > 0
        ? {
            startKey: inKeys[0].key,
            endKey: outKeys[0].key,
            label: `Duration (${inKeys[0].label} → ${outKeys[0].label})`,
          }
        : {
            startKey: timeFields[0].key,
            endKey: timeFields[1].key,
            label: `Duration (${timeFields[0].label} → ${timeFields[1].label})`,
          };

    const durations: number[] = [];
    const perCatDur = new Map<string, { sum: number; count: number }>();

    filteredLogs.forEach((log: any) => {
      const startMins = parseTimeToMinutes(log.attributes?.[pair.startKey]);
      const endMins = parseTimeToMinutes(log.attributes?.[pair.endKey]);

      if (startMins !== null && endMins !== null) {
        let diff = endMins - startMins;
        if (diff < 0) diff += 24 * 60;
        const hours = diff / 60;
        const catName = log.categoryName || 'General';
        durations.push(hours);

        const current = perCatDur.get(catName) || { sum: 0, count: 0 };
        current.sum += hours;
        current.count += 1;
        perCatDur.set(catName, current);
      }
    });

    if (durations.length > 0) {
      const sum = durations.reduce((acc, n) => acc + n, 0);
      const byCategory: FieldCategoryContribution[] = Array.from(perCatDur.entries())
        .map(([categoryName, stats]) => ({
          categoryName,
          count: stats.count,
          sum: stats.sum,
          contributionPct: sum !== 0 ? (stats.sum / sum) * 100 : 0,
        }))
        .sort((a, b) => b.sum - a.sum);

      fieldStats.push({
        key: `duration_${pair.startKey}_${pair.endKey}`,
        label: pair.label,
        type: 'duration',
        count: durations.length,
        sum,
        avg: sum / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        byCategory,
      });
    }
  }

  return {
    totalLogs: filteredLogs.length,
    categoryBreakdownCount: categoryBreakdown.length,
    categoryBreakdown,
    fieldStats,
  };
}

export function buildPieSlices(
  isMultiCategoryScope: boolean,
  activePieField: FieldStat | undefined,
  categoryBreakdown: CategoryBreakdownItem[],
  totalLogs: number
): PieSlice[] {
  if (!isMultiCategoryScope) return [];

  if (activePieField && activePieField.byCategory.length > 0) {
    const positiveItems = activePieField.byCategory.filter((c) => c.contributionPct > 0);
    const sourceItems = positiveItems.length > 0 ? positiveItems : activePieField.byCategory;
    const totalPct = sourceItems.reduce((acc, item) => acc + item.contributionPct, 0);

    let currentAngle = 0;
    return sourceItems.map((item, idx) => {
      const normalizedPct =
        totalPct > 0 ? (item.contributionPct / totalPct) * 100 : 100 / sourceItems.length;
      const sweep = (normalizedPct / 100) * 360;
      const slice: PieSlice = {
        label: item.categoryName,
        valueLabel:
          activePieField.type === 'boolean'
            ? `${item.trueCount}/${item.count}`
            : formatMetric(item.sum, activePieField.type),
        percentage: item.contributionPct,
        startAngle: currentAngle,
        endAngle: currentAngle + sweep,
        color: PIE_COLORS[idx % PIE_COLORS.length],
      };
      currentAngle += sweep;
      return slice;
    });
  }

  if (categoryBreakdown.length > 0 && totalLogs > 0) {
    let currentAngle = 0;
    return categoryBreakdown.map((item, idx) => {
      const pct = (item.count / totalLogs) * 100;
      const sweep = (pct / 100) * 360;
      const slice: PieSlice = {
        label: item.categoryName,
        valueLabel: `${item.count} logs`,
        percentage: pct,
        startAngle: currentAngle,
        endAngle: currentAngle + sweep,
        color: PIE_COLORS[idx % PIE_COLORS.length],
      };
      currentAngle += sweep;
      return slice;
    });
  }

  return [];
}