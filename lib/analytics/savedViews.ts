export interface AnalyticsSortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export type SavedTrendGranularity = 'day' | 'week' | 'month';

export type AnalyticsCardKey =
  | 'matching_logs'
  | 'field_stats'
  | 'category_share'
  | 'timeline_trend'
  | 'field_breakdown';

export interface SavedAnalyticsView {
  id: string;
  name: string;
  selectedCategory?: string;
  selectedCategories?: string[];
  searchQuery: string;
  dateFrom: string;
  dateTo: string;
  sortConfigs: AnalyticsSortConfig[];
  pieFieldKey?: string;
  timelineGranularity?: SavedTrendGranularity;
  timelineMetricKey?: string;
  breakdownFieldKey?: string;
  breakdownMetricKey?: string;
  hiddenCardKeys?: AnalyticsCardKey[];
  createdAt: string;
}

const STORAGE_PREFIX = 'loggerlogger_analytics_saved_views_';

export function getSavedViewsStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId || 'default'}`;
}

export function loadSavedAnalyticsViews(userId: string): SavedAnalyticsView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getSavedViewsStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load saved analytics views:', error);
    return [];
  }
}

export function persistSavedAnalyticsViews(
  userId: string,
  views: SavedAnalyticsView[]
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getSavedViewsStorageKey(userId),
      JSON.stringify(views)
    );
  } catch (error) {
    console.error('Failed to persist saved analytics views:', error);
  }
}