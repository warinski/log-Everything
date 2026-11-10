'use server';

import dbConnect from '@/lib/mongodb';
import { Category, IFieldDefinition } from '@/lib/models/Category';
import { revalidatePath } from 'next/cache';

interface CreateCategoryInput {
  userId: string;
  name: string;
  color?: string;
  icon?: string;
  defaultTags?: string[];
  fields: IFieldDefinition[];
}

/**
 * Fetch all category templates belonging exclusively to a specific user
 */
export async function getUserCategories(userId: string) {
  try {
    await dbConnect();

    if (!userId) {
      throw new Error('Unauthorized: Missing user ID.');
    }

    // Query exclusively by the authenticated user's ID and sort by name
    const categories = await Category.find({ userId }).sort({ name: 1 }).lean();
    
    // Convert any ObjectIds or complex types to standard JSON values safely
    return JSON.parse(JSON.stringify(categories));
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    throw new Error(error.message || 'Failed to fetch categories');
  }
}

/**
 * Create a new category template tied strictly to the authenticated user
 */
export async function createCategory(data: CreateCategoryInput) {
  try {
    await dbConnect();

    if (!data.userId) {
      throw new Error('Unauthorized: Missing user ID.');
    }

    if (!data.name || !data.name.trim()) {
      throw new Error('Category name is required.');
    }

    const newCategory = await Category.create({
      userId: data.userId,
      name: data.name.trim(),
      color: data.color || '#3B82F6',
      icon: data.icon || '📁',
      defaultTags: data.defaultTags || [],
      fields: data.fields || [],
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/categories');

    return { success: true, categoryId: newCategory._id.toString() };
  } catch (error: any) {
    console.error('Failed to create category:', error);
    if (error.code === 11000) {
      throw new Error('A category with this name already exists.');
    }
    throw new Error(error.message || 'Could not create category template.');
  }
}