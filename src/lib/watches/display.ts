// src/lib/watches/display.ts
//
// Pure display helpers for watch listing fields.
// Safe to import on both server and client (no React, no Prisma).
// Single source of truth for label maps — previously scattered across
// WatchCard, detail pages, and filter components.

// ─── Condition ────────────────────────────────────────────────────────────────

export const CONDITION_LABEL: Record<string, string> = {
  UNWORN:    'Unworn',
  MINT:      'Mint',
  EXCELLENT: 'Excellent',
  VERY_GOOD: 'Very Good',
  GOOD:      'Good',
  FAIR:      'Fair',
};

export const CONDITION_LABEL_SHORT: Record<string, string> = {
  UNWORN:    'Unworn',
  MINT:      'Mint',
  EXCELLENT: 'Excellent',
  VERY_GOOD: 'V. Good',
  GOOD:      'Good',
  FAIR:      'Fair',
};

export function formatCondition(condition: string | null): string | null {
  if (!condition) return null;
  return CONDITION_LABEL[condition] ?? condition;
}

// ─── Movement ─────────────────────────────────────────────────────────────────

export const MOVEMENT_LABEL: Record<string, string> = {
  AUTOMATIC: 'Automatic',
  MANUAL:    'Manual',
  QUARTZ:    'Quartz',
  OTHER:     'Other',
};

export function formatMovement(movement: string | null): string | null {
  if (!movement) return null;
  return MOVEMENT_LABEL[movement] ?? movement;
}

// ─── Style ────────────────────────────────────────────────────────────────────

export const STYLE_LABEL: Record<string, string> = {
  DRESS:       'Dress',
  SPORT:       'Sport',
  DIVE:        'Dive',
  PILOT:       'Pilot',
  CHRONOGRAPH: 'Chronograph',
  FIELD:       'Field',
  RACING:      'Racing',
  TONNEAU:     'Tonneau',
  POCKET:      'Pocket',
  MILITARY:    'Military',
  VINTAGE:     'Vintage',
};

export function formatStyle(style: string | null): string | null {
  if (!style) return null;
  return STYLE_LABEL[style] ?? style;
}

// ─── Listing state ────────────────────────────────────────────────────────────

/**
 * Canonical user-facing state of a listing for the authenticated viewer.
 * Drives button labels, badge visibility, and action availability.
 */
export type ListingUserState = 'owned' | 'saved' | 'none';

export function getListingUserState(
  isOwned: boolean | undefined,
  isSaved: boolean | undefined,
): ListingUserState {
  if (isOwned) return 'owned';
  if (isSaved) return 'saved';
  return 'none';
}
