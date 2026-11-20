import type { UserPlan, UserRole } from '@/lib/models/User';

export type FeatureKey =
  | 'user_management'
  | 'view_all_logs'
  | 'advanced_analytics'
  | 'unlimited_categories';

export interface PermissionUser {
  role?: UserRole | string;
  plan?: UserPlan | string;
  features?: string[];
}

const PLAN_FEATURES: Record<string, FeatureKey[]> = {
  free: [],
  standard: ['advanced_analytics'],
  pro: ['advanced_analytics', 'unlimited_categories'],
};

export function isSuperUser(user?: PermissionUser | null): boolean {
  return user?.role === 'super_user';
}

export function hasFeature(user: PermissionUser | null | undefined, feature: FeatureKey): boolean {
  if (!user) return false;
  if (isSuperUser(user)) return true;

  const plan = user.plan || 'free';
  const planGrants = PLAN_FEATURES[plan] || [];
  if (planGrants.includes(feature)) return true;

  return Array.isArray(user.features) && user.features.includes(feature);
}

export function canAccessUserManagement(user?: PermissionUser | null): boolean {
  return isSuperUser(user) || hasFeature(user, 'user_management');
}