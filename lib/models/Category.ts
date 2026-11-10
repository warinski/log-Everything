import { Schema, model, models, Document } from 'mongoose';

export interface IFieldDefinition {
  name: string; // Internal key (e.g., "distance_km")
  label: string; // Display label (e.g., "Distance (km)")
  fieldType: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options?: string[]; // Options if fieldType is 'select'
  required: boolean;
}

export interface ICategory extends Document {
  userId: string;
  name: string;
  color?: string;
  icon?: string;
  defaultTags?: string[];
  fields: IFieldDefinition[];
  createdAt: Date;
  updatedAt: Date;
}

const FieldDefinitionSchema = new Schema<IFieldDefinition>({
  name: { type: String, required: true },
  label: { type: String, required: true },
  fieldType: { 
    type: String, 
    enum: ['text', 'number', 'date', 'select', 'boolean'], 
    required: true 
  },
  options: [{ type: String }],
  required: { type: Boolean, default: false }
});

const CategorySchema = new Schema<ICategory>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    color: { type: String, default: '#3B82F6' },
    icon: { type: String, default: '📁' },
    defaultTags: [{ type: String }],
    fields: [FieldDefinitionSchema]
  },
  { timestamps: true }
);

// Ensures a user cannot create duplicate category names
CategorySchema.index({ userId: 1, name: 1 }, { unique: true });

export const Category = models.Category || model<ICategory>('Category', CategorySchema);