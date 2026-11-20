import mongoose, { Schema, model, models } from 'mongoose';

export type UserRole = 'user' | 'super_user';
export type UserPlan = 'free' | 'standard' | 'pro';

export interface IUser {
  name: string;
  email: string;
  password: string; // Hashed with bcrypt
  role: UserRole;
  plan: UserPlan;
  features: string[]; // Optional per-user feature grants or overrides
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true }, // Hashed with bcrypt
    role: {
      type: String,
      enum: ['user', 'super_user'],
      default: 'user',
      index: true,
    },
    plan: {
      type: String,
      enum: ['free', 'standard', 'pro'],
      default: 'free',
    },
    features: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

if (models.User) {
  delete models.User;
}

export const User = model<IUser>('User', UserSchema);