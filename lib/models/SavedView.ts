import { Schema, model, models, Document } from 'mongoose';
import {
  AnalyticsCardKey,
  AnalyticsSortConfig,
  SavedTrendGranularity,
} from '@/lib/analytics/savedViews';

export interface ISavedView extends Document {
  userId: string;
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
  createdAt: Date;
  updatedAt: Date;
}

const SortConfigSchema = new Schema<AnalyticsSortConfig>(
  {
    key: { type: String, required: true },
    direction: { type: String, enum: ['asc', 'desc'], required: true },
  },
  { _id: false }
);

const SavedViewSchema = new Schema<ISavedView>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    selectedCategory: { type: String, default: '' },
    selectedCategories: { type: [String], default: [] },
    searchQuery: { type: String, default: '' },
    dateFrom: { type: String, default: '' },
    dateTo: { type: String, default: '' },
    sortConfigs: {
      type: [SortConfigSchema],
      default: [{ key: 'timestamp', direction: 'desc' }],
    },
    pieFieldKey: { type: String, default: '' },
    timelineGranularity: {
      type: String,
      enum: ['day', 'week', 'month'],
      default: 'day',
    },
    timelineMetricKey: { type: String, default: '__count__' },
    breakdownFieldKey: { type: String, default: '' },
    breakdownMetricKey: { type: String, default: '' },
    hiddenCardKeys: {
      type: [String],
      enum: [
        'matching_logs',
        'field_stats',
        'category_share',
        'timeline_trend',
        'field_breakdown',
      ],
      default: [],
    },
  },
  { timestamps: true }
);

SavedViewSchema.index({ userId: 1, createdAt: -1 });

if (models.SavedView) {
  delete models.SavedView;
}

export const SavedView = model<ISavedView>('SavedView', SavedViewSchema);