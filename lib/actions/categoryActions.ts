'use server';

import dbConnect from '@/lib/mongodb';
import { Category, IFieldDefinition } from '@/lib/models/Category';
import { Log } from '@/lib/models/Log';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';

interface CreateCategoryInput {
  userId: string;
  name: string;
  color?: string;
  icon?: string;
  defaultTags?: string[];
  fields: IFieldDefinition[];
}

interface UpdateCategoryInput {
  name?: string;
  color?: string;
  icon?: string;
  defaultTags?: string[];
  fields?: IFieldDefinition[];
}

/**
 * Fetch all category templates belonging exclusively to a specific user
 */
export async function getUserCategories(userId: string) {
  noStore(); // 👈 Prevents Next.js from caching stale categories
  try {
    await dbConnect();

    if (!userId) {
      throw new Error('Unauthorized: Missing user ID.');
    }

    const categories = await Category.find({ userId }).sort({ name: 1 }).lean();
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
    revalidatePath('/dashboard/analytics');

    return { success: true, categoryId: newCategory._id.toString() };
  } catch (error: any) {
    console.error('Failed to create category:', error);
    if (error.code === 11000) {
      throw new Error('A category with this name already exists.');
    }
    throw new Error(error.message || 'Could not create category template.');
  }
}

/**
 * Update an existing category template
 */
export async function updateCategory(categoryId: string, data: UpdateCategoryInput) {
  console.log('🚨 updateCategory server action CALLED with ID:', categoryId, 'Data:', data);
  
  try {
    await dbConnect();

    if (!categoryId) {
      throw new Error('Category ID is required.');
    }

    const oldCategory = await Category.findById(categoryId);
    if (!oldCategory) {
      throw new Error('Category not found.');
    }
    const oldFields = oldCategory.fields || [];

    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.defaultTags !== undefined && { defaultTags: data.defaultTags }),
        ...(data.fields !== undefined && { fields: data.fields }),
      },
      { new: true }
    );

    if (!updatedCategory) {
      throw new Error('Category not found.');
    }

    const logUpdateFields: any = {};
    if (data.name !== undefined) logUpdateFields.categoryName = data.name.trim();
    if (data.icon !== undefined) logUpdateFields.categoryIcon = data.icon;
    if (data.color !== undefined) logUpdateFields.categoryColor = data.color;

    if (Object.keys(logUpdateFields).length > 0) {
      await Log.updateMany({ categoryId: categoryId }, { $set: logUpdateFields });
    }

    if (data.fields !== undefined) {
      const logs = await Log.find({ categoryId: categoryId });
      const newFields = updatedCategory.fields || [];

      for (const log of logs) {
        let attributes = log.attributes instanceof Map 
          ? Object.fromEntries(log.attributes) 
          : { ...(log.attributes || {}) };

        let hasChanges = false;
        const newAttributes: Record<string, any> = {};

        newFields.forEach((newField: any, index: number) => {
          const oldField = oldFields[index];
          
          const oldKeyByName = oldField?.name || oldField?.label?.trim().toLowerCase().replace(/\s+/g, '_');
          const newKey = newField.name || newField.label.trim().toLowerCase().replace(/\s+/g, '_');

          if (oldKeyByName && attributes[oldKeyByName] !== undefined) {
            newAttributes[newKey] = attributes[oldKeyByName];
            if (oldKeyByName !== newKey) hasChanges = true;
          } else if (oldField?.label && attributes[oldField.label.trim().toLowerCase().replace(/\s+/g, '_')] !== undefined) {
            const fallbackKey = oldField.label.trim().toLowerCase().replace(/\s+/g, '_');
            newAttributes[newKey] = attributes[fallbackKey];
            hasChanges = true;
          } else {
            const existingKeys = Object.keys(attributes);
            if (existingKeys[index] !== undefined && newAttributes[newKey] === undefined) {
              const guessedKey = existingKeys[index];
              newAttributes[newKey] = attributes[guessedKey];
              if (guessedKey !== newKey) hasChanges = true;
            } else if (attributes[newKey] !== undefined) {
              newAttributes[newKey] = attributes[newKey];
            }
          }
        });

        if (hasChanges || Object.keys(newAttributes).length !== Object.keys(attributes).length) {
          log.attributes = newAttributes;
          log.markModified('attributes');
          await log.save();
        }
      }
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/categories');
    revalidatePath('/dashboard/analytics');

    return JSON.parse(JSON.stringify(updatedCategory));
  } catch (error: any) {
    console.error('Error updating category:', error);
    throw new Error(error.message || 'Failed to update category.');
  }
}

/**
 * Delete a category template by ID and reassign associated logs to General Log
 */
export async function deleteCategory(categoryId: string) {
  try {
    await dbConnect();

    if (!categoryId) {
      throw new Error('Category ID is required.');
    }

    const deletedCategory = await Category.findByIdAndDelete(categoryId);

    if (!deletedCategory) {
      throw new Error('Category not found.');
    }

    // 🚀 Reassign any logs previously tied to this deleted category to General Log
    await Log.updateMany(
      { categoryId: categoryId },
      {
        $unset: { categoryId: "" },
        $set: {
          categoryName: "_General log",
          categoryIcon: "📁",
          categoryColor: "#3B82F6",
        },
      }
    );

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/categories');
    revalidatePath('/dashboard/analytics');

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting category:', error);
    throw new Error(error.message || 'Failed to delete category.');
  }
}