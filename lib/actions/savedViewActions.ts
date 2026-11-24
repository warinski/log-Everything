'use server';

import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/mongodb';
import { SavedView } from '@/lib/models/SavedView';
import { SavedAnalyticsView } from '@/lib/analytics/savedViews';

export interface SaveViewInput {
  userId: string;
  name: string;
  selectedCategory?: string;
  selectedCategories?: string[];
  searchQuery: string;
  dateFrom: string;
  dateTo: string;
  sortConfigs: SavedAnalyticsView['sortConfigs'];
  pieFieldKey?: string;
  timelineGranularity?: SavedAnalyticsView['timelineGranularity'];
  timelineMetricKey?: string;
  breakdownFieldKey?: string;
  breakdownMetricKey?: string;
  hiddenCardKeys?: SavedAnalyticsView['hiddenCardKeys'];
}

function serializeView(doc: any): SavedAnalyticsView {
  const plain = JSON.parse(JSON.stringify(doc));
  return {
    ...plain,
    id: plain._id ? String(plain._id) : plain.id,
  };
}

export async function getSavedViews(userId: string): Promise<SavedAnalyticsView[]> {
  try {
    await dbConnect();
    if (!userId) {
      throw new Error('Unauthorized: Missing user ID.');
    }
    const docs = await SavedView.find({ userId }).sort({ createdAt: -1 }).lean();
    return docs.map(serializeView);
  } catch (error: any) {
    console.error('Error fetching saved views:', error);
    throw new Error(error.message || 'Failed to fetch saved views.');
  }
}

export async function createSavedView(data: SaveViewInput): Promise<SavedAnalyticsView> {
  try {
    await dbConnect();
    if (!data.userId) {
      throw new Error('Unauthorized: Missing user ID.');
    }
    const trimmedName = data.name?.trim();
    if (!trimmedName) {
      throw new Error('View name is required.');
    }

    const created = await SavedView.create({
      userId: data.userId,
      name: trimmedName,
      selectedCategory: data.selectedCategory ?? '',
      selectedCategories: data.selectedCategories ?? [],
      searchQuery: data.searchQuery ?? '',
      dateFrom: data.dateFrom ?? '',
      dateTo: data.dateTo ?? '',
      sortConfigs:
        data.sortConfigs && data.sortConfigs.length > 0
          ? data.sortConfigs
          : [{ key: 'timestamp', direction: 'desc' }],
      pieFieldKey: data.pieFieldKey ?? '',
      timelineGranularity: data.timelineGranularity ?? 'day',
      timelineMetricKey: data.timelineMetricKey ?? '__count__',
      breakdownFieldKey: data.breakdownFieldKey ?? '',
      breakdownMetricKey: data.breakdownMetricKey ?? '',
      hiddenCardKeys: data.hiddenCardKeys ?? [],
    });

    revalidatePath('/dashboard/analytics');
    return serializeView(created);
  } catch (error: any) {
    console.error('Error creating saved view:', error);
    throw new Error(error.message || 'Failed to save view.');
  }
}

export async function updateSavedView(
  viewId: string,
  userId: string,
  data: Omit<SaveViewInput, 'userId' | 'name'>
): Promise<SavedAnalyticsView> {
  try {
    await dbConnect();
    if (!userId) {
      throw new Error('Unauthorized: Missing user ID.');
    }
    if (!viewId) {
      throw new Error('View ID is required.');
    }

    const updated = await SavedView.findOneAndUpdate(
      { _id: viewId, userId },
      {
        $set: {
          selectedCategory: data.selectedCategory ?? '',
          selectedCategories: data.selectedCategories ?? [],
          searchQuery: data.searchQuery ?? '',
          dateFrom: data.dateFrom ?? '',
          dateTo: data.dateTo ?? '',
          sortConfigs:
            data.sortConfigs && data.sortConfigs.length > 0
              ? data.sortConfigs
              : [{ key: 'timestamp', direction: 'desc' }],
          pieFieldKey: data.pieFieldKey ?? '',
          timelineGranularity: data.timelineGranularity ?? 'day',
          timelineMetricKey: data.timelineMetricKey ?? '__count__',
          breakdownFieldKey: data.breakdownFieldKey ?? '',
          breakdownMetricKey: data.breakdownMetricKey ?? '',
          hiddenCardKeys: data.hiddenCardKeys ?? [],
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      throw new Error('Saved view not found or unauthorized.');
    }

    revalidatePath('/dashboard/analytics');
    return serializeView(updated);
  } catch (error: any) {
    console.error('Error updating saved view:', error);
    throw new Error(error.message || 'Failed to update saved view.');
  }
}

export async function renameSavedView(
  viewId: string,
  userId: string,
  newName: string
): Promise<SavedAnalyticsView> {
  try {
    await dbConnect();
    if (!userId) {
      throw new Error('Unauthorized: Missing user ID.');
    }
    const trimmedName = newName?.trim();
    if (!trimmedName) {
      throw new Error('View name is required.');
    }

    const updated = await SavedView.findOneAndUpdate(
      { _id: viewId, userId },
      { $set: { name: trimmedName } },
      { new: true }
    ).lean();

    if (!updated) {
      throw new Error('Saved view not found or unauthorized.');
    }

    revalidatePath('/dashboard/analytics');
    return serializeView(updated);
  } catch (error: any) {
    console.error('Error renaming saved view:', error);
    throw new Error(error.message || 'Failed to rename saved view.');
  }
}

export async function deleteSavedView(
  viewId: string,
  userId: string
): Promise<{ success: boolean }> {
  try {
    await dbConnect();
    if (!userId) {
      throw new Error('Unauthorized: Missing user ID.');
    }
    if (!viewId) {
      throw new Error('View ID is required.');
    }

    const deleted = await SavedView.findOneAndDelete({ _id: viewId, userId });
    if (!deleted) {
      throw new Error('Saved view not found or unauthorized.');
    }

    revalidatePath('/dashboard/analytics');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting saved view:', error);
    throw new Error(error.message || 'Failed to delete saved view.');
  }
}

export async function restoreSavedView(
  userId: string,
  view: Omit<SavedAnalyticsView, 'id' | 'createdAt'>
): Promise<SavedAnalyticsView> {
  try {
    await dbConnect();
    if (!userId) {
      throw new Error('Unauthorized: Missing user ID.');
    }
    const trimmedName = view.name?.trim();
    if (!trimmedName) {
      throw new Error('View name is required.');
    }

    const restored = await SavedView.create({
      userId,
      name: trimmedName,
      selectedCategory: view.selectedCategory ?? '',
      selectedCategories: view.selectedCategories ?? [],
      searchQuery: view.searchQuery ?? '',
      dateFrom: view.dateFrom ?? '',
      dateTo: view.dateTo ?? '',
      sortConfigs:
        view.sortConfigs && view.sortConfigs.length > 0
          ? view.sortConfigs
          : [{ key: 'timestamp', direction: 'desc' }],
      pieFieldKey: view.pieFieldKey ?? '',
      timelineGranularity: view.timelineGranularity ?? 'day',
      timelineMetricKey: view.timelineMetricKey ?? '__count__',
      breakdownFieldKey: view.breakdownFieldKey ?? '',
      breakdownMetricKey: view.breakdownMetricKey ?? '',
      hiddenCardKeys: view.hiddenCardKeys ?? [],
    });

    revalidatePath('/dashboard/analytics');
    return serializeView(restored);
  } catch (error: any) {
    console.error('Error restoring saved view:', error);
    throw new Error(error.message || 'Failed to restore saved view.');
  }
}