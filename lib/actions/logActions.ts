'use server';

import dbConnect from '@/lib/mongodb';
import { Log } from '@/lib/models/Log';
import { Category } from '@/lib/models/Category';
import { revalidatePath } from 'next/cache';

interface CreateLogInput {
  userId: string;
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  title: string;
  notes?: string;
  tags?: string[];
  attributes?: Record<string, any>;
  timestamp?: Date;
}

function matchesSearchQuery(log: any, rawQuery: string, matchingCategoryIds: Set<string>): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;

  // 1. Category template name or custom field name matched on the user's Category
  if (log.categoryId && matchingCategoryIds.has(String(log.categoryId))) {
    return true;
  }

  // 2. Category name stored directly on the log
  if (typeof log.categoryName === 'string' && log.categoryName.toLowerCase().includes(q)) {
    return true;
  }

  // 3. Log title
  if (typeof log.title === 'string' && log.title.toLowerCase().includes(q)) {
    return true;
  }

  // 4. Log notes
  if (typeof log.notes === 'string' && log.notes.toLowerCase().includes(q)) {
    return true;
  }

  // 5. Tags
  if (Array.isArray(log.tags) && log.tags.some((tag: unknown) => String(tag).toLowerCase().includes(q))) {
    return true;
  }

  // 6. Dynamic attributes (both field keys/names and field values)
  if (log.attributes && typeof log.attributes === 'object') {
    for (const [key, val] of Object.entries(log.attributes)) {
      const normalizedKey = key.replace(/_/g, ' ').toLowerCase();
      if (key.toLowerCase().includes(q) || normalizedKey.includes(q)) {
        return true;
      }
      if (val !== undefined && val !== null && String(val).toLowerCase().includes(q)) {
        return true;
      }
    }
  }

  return false;
}

export async function createLog(data: CreateLogInput) {
  try {
    await dbConnect();

    let categoryIcon = data.categoryIcon || '';
    let categoryColor = data.categoryColor || '';

    if (data.categoryId) {
      const category = await Category.findById(data.categoryId);
      if (category) {
        categoryIcon = category.icon || '';
        categoryColor = category.color || '';
      }
    }

    const newLog = await Log.create({
      userId: data.userId,
      categoryId: data.categoryId || undefined,
      categoryName: data.categoryName || undefined,
      categoryIcon,
      categoryColor,
      title: data.title,
      notes: data.notes || '',
      tags: data.tags || [],
      attributes: data.attributes || {},
      timestamp: data.timestamp || new Date(),
    } as any);

    revalidatePath('/dashboard');
    return JSON.parse(JSON.stringify(newLog));
  } catch (error: any) {
    console.error('Error creating log:', error);
    throw new Error(error.message || 'Failed to create log.');
  }
}

export async function updateLog(logId: string, userId: string, data: Partial<CreateLogInput>) {
  try {
    await dbConnect();

    let categoryIcon = data.categoryIcon;
    let categoryColor = data.categoryColor;

    if (data.categoryId) {
      const category = await Category.findById(data.categoryId);
      if (category) {
        categoryIcon = category.icon || '';
        categoryColor = category.color || '';
      }
    }

    const updatedLog = await Log.findOneAndUpdate(
      { _id: logId, userId },
      {
        ...data,
        ...(categoryIcon !== undefined && { categoryIcon }),
        ...(categoryColor !== undefined && { categoryColor }),
      } as any,
      { new: true }
    );

    if (!updatedLog) {
      throw new Error('Log not found or unauthorized.');
    }

    revalidatePath('/dashboard');
    return JSON.parse(JSON.stringify(updatedLog));
  } catch (error: any) {
    console.error('Error updating log:', error);
    throw new Error(error.message || 'Failed to update log.');
  }
}

/**
 * Duplicate an existing log entry by ID
 */
export async function duplicateLog(logId: string, userId: string) {
  try {
    await dbConnect();

    const sourceLog = (await Log.findById(logId).lean()) as any;
    if (!sourceLog) {
      throw new Error('Log not found.');
    }

    const duplicatedData = {
      userId: sourceLog.userId || userId,
      categoryId: sourceLog.categoryId || undefined,
      categoryName: sourceLog.categoryName || '',
      categoryIcon: sourceLog.categoryIcon || '',
      categoryColor: sourceLog.categoryColor || '',
      title: `Copy of ${sourceLog.title}`,
      notes: sourceLog.notes || '',
      tags: sourceLog.tags || [],
      attributes: sourceLog.attributes || {},
      timestamp: new Date(),
    };

    const newLog = await Log.create(duplicatedData as any);

    revalidatePath('/dashboard');
    return JSON.parse(JSON.stringify(newLog));
  } catch (error: any) {
    console.error('Error duplicating log:', error);
    throw new Error(error.message || 'Failed to duplicate log.');
  }
}

export async function getFilteredLogs({
  userId,
  categoryId,
  tags,
  searchQuery,
}: {
  userId: string;
  categoryId?: string;
  tags?: string[];
  searchQuery?: string;
}) {
  try {
    await dbConnect();

    const query: any = { userId };

    if (categoryId) {
      query.categoryId = categoryId;
    }

    if (tags && tags.length > 0) {
      query.tags = { $all: tags };
    }

    const logs = await Log.find(query).sort({ timestamp: -1 }).lean();

    if (!searchQuery || searchQuery.trim() === '') {
      return JSON.parse(JSON.stringify(logs));
    }

    const q = searchQuery.trim().toLowerCase();
    const userCategories = (await Category.find({ userId }).lean()) as any[];
    const matchingCategoryIds = new Set<string>();

    for (const cat of userCategories) {
      const catNameMatch = typeof cat.name === 'string' && cat.name.toLowerCase().includes(q);
      const fieldMatch =
        Array.isArray(cat.fields) &&
        cat.fields.some((f: any) => {
          const label = typeof f.label === 'string' ? f.label.toLowerCase() : '';
          const fname = typeof f.name === 'string' ? f.name.toLowerCase() : '';
          return label.includes(q) || fname.includes(q);
        });

      if (catNameMatch || fieldMatch) {
        matchingCategoryIds.add(String(cat._id));
      }
    }

    const filteredLogs = logs.filter((log: any) =>
      matchesSearchQuery(log, searchQuery, matchingCategoryIds)
    );

    return JSON.parse(JSON.stringify(filteredLogs));
  } catch (error: any) {
    console.error('Error fetching filtered logs:', error);
    return [];
  }
}

export async function deleteLog(logId: string, userId: string) {
  try {
    await dbConnect();
    const deleted = await Log.findOneAndDelete({ _id: logId, userId });
    if (!deleted) {
      throw new Error('Log not found or unauthorized.');
    }
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting log:', error);
    throw new Error(error.message || 'Failed to delete log.');
  }
}

/**
 * Updates all logs referencing a specific category when the category template is renamed or restyled.
 */
export async function updateCategoryNameInLogs(
  categoryId: string,
  newCategoryName: string,
  newCategoryIcon?: string,
  newCategoryColor?: string
) {
  try {
    await dbConnect();

    await Log.updateMany(
      { categoryId: categoryId },
      {
        $set: {
          categoryName: newCategoryName,
          ...(newCategoryIcon !== undefined && { categoryIcon: newCategoryIcon }),
          ...(newCategoryColor !== undefined && { categoryColor: newCategoryColor }),
        },
      }
    );

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/analytics');
    return { success: true };
  } catch (error: any) {
    console.error('Error updating category name in logs:', error);
    throw new Error(error.message || 'Failed to update category name in logs.');
  }
}