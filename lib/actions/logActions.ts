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
    });

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
      },
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

    const sourceLog = await Log.findById(logId).lean();
    if (!sourceLog) {
      throw new Error('Log not found.');
    }

    const duplicatedData = {
      userId: sourceLog.userId || userId, // Fallback to passed userId if sourceLog.userId is missing
      categoryId: sourceLog.categoryId || undefined,
      categoryName: (sourceLog as any).categoryName || '',
      categoryIcon: (sourceLog as any).categoryIcon || '',
      categoryColor: (sourceLog as any).categoryColor || '',
      title: `Copy of ${sourceLog.title}`,
      notes: sourceLog.notes || '',
      tags: sourceLog.tags || [],
      attributes: sourceLog.attributes || {},
      timestamp: new Date(),
    };

    const newLog = await Log.create(duplicatedData);

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

    if (searchQuery) {
      query.$or = [
        { title: { $regex: searchQuery, $options: 'i' } },
        { notes: { $regex: searchQuery, $options: 'i' } },
        { tags: { $regex: searchQuery, $options: 'i' } },
      ];
    }

    const logs = await Log.find(query).sort({ timestamp: -1 }).lean();
    return JSON.parse(JSON.stringify(logs));
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