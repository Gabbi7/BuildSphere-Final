/**
 * BuildSphere Phase 2 — Global Constants & Enums
 * Single source of truth for all enum values shared between mobile and backend.
 */

// ── Inventory Action Types ──────────────────────────────────────────────
export const ACTION_TYPES = ['RECEIVING', 'CONSUMPTION', 'SPOILAGE', 'ADJUSTMENT'] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  RECEIVING: 'Receiving',
  CONSUMPTION: 'Consumption',
  SPOILAGE: 'Defective',
  ADJUSTMENT: 'Adjustment',
};

export const ACTION_TYPE_COLORS: Record<ActionType, string> = {
  RECEIVING: '#5DBF50',   // Green  — stock in
  CONSUMPTION: '#FF9F43', // Orange — stock out (linked to task)
  SPOILAGE: '#FF6B6B',    // Red    - stock out (defective)
  ADJUSTMENT: '#7370FF',  // Purple — correction
};

// ── Project Status ──────────────────────────────────────────────────────
export const PROJECT_STATUS = ['proposed', 'active', 'completed'] as const;
export type ProjectStatus = (typeof PROJECT_STATUS)[number];

// ── Task Status ─────────────────────────────────────────────────────────
export const TASK_STATUS = ['todo', 'in_progress', 'in_review', 'completed'] as const;
export type TaskStatus = (typeof TASK_STATUS)[number];

// ── User Roles ──────────────────────────────────────────────────────────
export const USER_ROLES = [
  'CEO',
  'COO',
  'Project Engineer',
  'Project Coordinator',
  'Foreman',
  'Procurement',
  'Accounting',
] as const;
export type UserRoleLabel = (typeof USER_ROLES)[number];

// ── Notification Types (Phase 2 RBAC Triggers) ─────────────────────────
export const NOTIFICATION_TYPES = ['WARNING', 'SUCCESS', 'INFO'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Legacy type mapping (old → new) for backward compatibility
export const LEGACY_NOTIFICATION_TYPE_MAP: Record<string, NotificationType> = {
  alert: 'WARNING',
  success: 'SUCCESS',
  update: 'INFO',
  message: 'INFO',
};

export const RAW_LABEL_OVERRIDES: Record<string, string> = {
  PREPARATION_PLANNING: 'Preparation Planning',
  CLOSE_OUT: 'Close Out',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'To Review',
  TO_REVIEW: 'To Review',
  TO_DO: 'To Do',
  PENDING: 'To Do',
  TODO: 'To Do',
  COMPLETED: 'Completed',
  PROJECT_ENGINEER: 'Project Engineer',
  PROJECT_COORDINATOR: 'Project Coordinator',
  HUMAN_RESOURCE: 'Human Resource',
  LOW_STOCK: 'Low Stock',
  SPOILAGE: 'Defective',
};

export const formatRawLabel = (value?: string | null, fallback = 'Not set') => {
  if (!value) return fallback;
  const normalized = String(value).trim();
  if (!normalized) return fallback;
  const key = normalized.replace(/[-\s]+/g, '_').toUpperCase();
  if (RAW_LABEL_OVERRIDES[key]) return RAW_LABEL_OVERRIDES[key];
  return normalized
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};
