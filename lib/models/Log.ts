import { Schema, model, models, Document, Types } from 'mongoose';

export interface ILog extends Document {
  userId: string;
  title: string;
  categoryId?: Types.ObjectId;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  tags: string[];
  notes?: string;
  attributes: Record<string, any>;
  loggedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LogSchema = new Schema<ILog>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    categoryName: { type: String, default: '' },
    categoryIcon: { type: String, default: '' },
    categoryColor: { type: String, default: '' },
    tags: [{ type: String }],
    notes: { type: String },
    attributes: { type: Schema.Types.Mixed, default: {} },
    loggedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// --- PERFORMANCE INDEXES ---
LogSchema.index({ tags: 1 });
LogSchema.index({ userId: 1, createdAt: -1 });
LogSchema.index({ userId: 1, categoryId: 1, createdAt: -1 });
LogSchema.index({ userId: 1, tags: 1, createdAt: -1 });
LogSchema.index({ title: 'text', 'attributes.$**': 'text' });

// 🛠️ FIX: Delete the cached model in development so Next.js recompiles it with the new fields
if (models.Log) {
  delete models.Log;
}

export const Log = model<ILog>('Log', LogSchema);