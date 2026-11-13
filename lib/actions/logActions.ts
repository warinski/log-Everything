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

    let categoryName = data.categoryName || '';
    let categoryIcon = data.categoryIcon || '';
    let categoryColor = data.categoryColor || '';

    // If a categoryId is provided, double-check or fallback to fetching from DB
    if (data.categoryId) {
      const category = await Category.findById(data.categoryId);
      if (category) {
        categoryName = category.name || categoryName;
        categoryIcon = category.icon || categoryIcon;
        categoryColor = category.color || categoryColor;
      }
    }

    const newLog = await Log.create({
      userId: data.userId,
      categoryId: data.categoryId || undefined,
      categoryName: categoryName || undefined,
      categoryIcon: categoryIcon || undefined,
      categoryColor: categoryColor || undefined,
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

    let categoryName = data.categoryName;
    let categoryIcon = data.categoryIcon;
    let categoryColor = data.categoryColor;

    if (data.categoryId) {
      const category = await Category.findById(data.categoryId);
      if (category) {
        categoryName = category.name || categoryName;
        categoryIcon = category.icon || categoryIcon;
        categoryColor = category.color || categoryColor;
      }
    }

    const updatedLog = await Log.findOneAndUpdate(
      { _id: logId, userId },
      {
        ...data,
        ...(categoryName !== undefined && { categoryName }),
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

    // Fetch logs matching basic filters first, sorted with latest timestamp/creation first
    const logs = await Log.find(query)
      .sort({ timestamp: -1, createdAt: -1 })
      .lean();

    // If there is a search query, filter in-memory to guarantee exact matching
    // across title, notes, tags, categoryName, AND all dynamic attributes (keys and values)
    if (!searchQuery || searchQuery.trim() === '') {
      return JSON.parse(JSON.stringify(logs));
    }

    const q = searchQuery.toLowerCase();

    const filteredLogs = logs.filter((log: any) => {
      // 1. Check title
      if (log.title && log.title.toLowerCase().includes(q)) return true;

      // 2. Check notes
      if (log.notes && log.notes.toLowerCase().includes(q)) return true;

      // 3. Check categoryName
      if (log.categoryName && log.categoryName.toLowerCase().includes(q)) return true;

      // 4. Check tags array
      if (log.tags && log.tags.some((tag: string) => tag.toLowerCase().includes(q))) return true;

      // 5. Check dynamic attributes (both keys and values)
      if (log.attributes && typeof log.attributes === 'object') {
        const attributeString = JSON.stringify(log.attributes).toLowerCase();
        if (attributeString.includes(q)) return true;
      }

      return false;
    });

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