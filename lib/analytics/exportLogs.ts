import * as XLSX from 'xlsx';
import { CategoryTemplate } from '@/components/LogModal';

interface DynamicColumn {
  key: string;
  label: string;
  type?: string;
}

interface ExportLogsParams {
  format: 'csv' | 'xlsx' | 'json';
  logs: any[];
  selectedCategories: string[];
  singleCategoryObj?: CategoryTemplate;
  dynamicColumns: DynamicColumn[];
  showCategoryColumn: boolean;
  getLogTimestamp: (log: any) => Date;
}

export function exportAnalyticsLogs({
  format,
  logs,
  selectedCategories,
  singleCategoryObj,
  dynamicColumns,
  showCategoryColumn,
  getLogTimestamp,
}: ExportLogsParams) {
  const filePrefix =
    selectedCategories.length === 1 && singleCategoryObj
      ? singleCategoryObj.name.toLowerCase().replace(/\s+/g, '_')
      : selectedCategories.length > 1
        ? `selected_${selectedCategories.length}_categories`
        : 'all_logs';
  const dateStamp = new Date().toISOString().split('T')[0];

  if (format === 'json') {
    const exportData = logs.map((log: any) => ({
      id: log._id,
      title: log.title,
      category: log.categoryName || 'General',
      attributes: log.attributes || {},
      tags: log.tags || [],
      notes: log.notes || '',
      lastModified: getLogTimestamp(log).toISOString(),
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filePrefix}_${dateStamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  const rows = logs.map((log: any) => {
    const baseRow: Record<string, any> = { Title: log.title };
    if (showCategoryColumn) baseRow['Category'] = log.categoryName || 'General';
    dynamicColumns.forEach((col) => {
      const raw = log.attributes?.[col.key];
      baseRow[col.label] =
        typeof raw === 'boolean' ? (raw ? 'Yes' : 'No') : (raw ?? '');
    });
    baseRow['Tags'] = (log.tags || []).join(', ');
    baseRow['Notes'] = log.notes || '';
    baseRow['Last Modified'] = getLogTimestamp(log).toLocaleString();
    return baseRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  const sheetName =
    selectedCategories.length === 1 && singleCategoryObj
      ? singleCategoryObj.name.slice(0, 30)
      : 'Analytics Logs';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  if (format === 'csv') {
    XLSX.writeFile(workbook, `${filePrefix}_${dateStamp}.csv`, { bookType: 'csv' });
  } else {
    XLSX.writeFile(workbook, `${filePrefix}_${dateStamp}.xlsx`, { bookType: 'xlsx' });
  }
}