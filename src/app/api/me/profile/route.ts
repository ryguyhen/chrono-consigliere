// src/app/api/me/profile/route.ts
// PATCH — update the authenticated user's own profile.
//
// Accepts: { displayName?, username? }
// Auth:    Bearer token (mobile) or NextAuth cookie (web) — via getAuthUser
//
// Validation rules:
//   displayName — optional; 0–50 chars after trim; empty string → stored as null
//   username    — 2–30 chars; lowercase letters, numbers, underscores;
//                 must start and end with a letter or number;
//                 no consecutive underscores; must be unique across all profiles
//
// Returns: { username, displayName } reflecting the saved values.
// Errors:
//   401 — not authenticated
//   409 — username already taken
//   422 — validation failure (with field-level detail)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth/get-auth-user';

// Lowercase letters, numbers, underscores; starts/ends with alphanumeric; 2–30 chars.
// No consecutive underscores checked separately for a clearer error message.
const USERNAME_RE = /^[a-z0-9][a-z0-9_]*[a-z0-9]$|^[a-z0-9]$/;

function validateUsername(raw: string): string | null {
  const u = raw.trim();
  if (u.length < 2)  return 'Username must be at least 2 characters.';
  if (u.length > 30) return 'Username must be 30 characters or fewer.';
  if (!USERNAME_RE.test(u)) return 'Username may only contain lowercase letters, numbers, and underscores, and must start and end with a letter or number.';
  if (u.includes('__')) return 'Username may not contain consecutive underscores.';
  return null; // valid
}

function validateDisplayName(raw: string): string | null {
  const d = raw.trim();
  if (d.length > 50) return 'Display name must be 50 characters or fewer.';
  return null; // valid (empty is allowed — stored as null)
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { displayName: rawDisplayName, username: rawUsername } = body as Record<string, unknown>;

  // Must provide at least one field
  const hasDisplayName = 'displayName' in (body as object);
  const hasUsername    = 'username'    in (body as object);
  if (!hasDisplayName && !hasUsername) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  // Validate each field that was provided
  const errors: Record<string, string> = {};

  let validatedDisplayName: string | null | undefined = undefined;
  if (hasDisplayName) {
    if (typeof rawDisplayName !== 'string' && rawDisplayName !== null) {
      errors.displayName = 'Display name must be a string.';
    } else {
      const err = validateDisplayName((rawDisplayName as string | null) ?? '');
      if (err) {
        errors.displayName = err;
      } else {
        const trimmed = ((rawDisplayName as string | null) ?? '').trim();
        validatedDisplayName = trimmed.length > 0 ? trimmed : null;
      }
    }
  }

  let validatedUsername: string | undefined = undefined;
  if (hasUsername) {
    if (typeof rawUsername !== 'string') {
      errors.username = 'Username must be a string.';
    } else {
      const err = validateUsername(rawUsername);
      if (err) {
        errors.username = err;
      } else {
        validatedUsername = rawUsername.trim().toLowerCase();
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'Validation failed', fields: errors }, { status: 422 });
  }

  try {
    // Load current profile to compare username
    const current = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { username: true },
    });

    if (!current) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check uniqueness only if username is changing
    if (validatedUsername !== undefined && validatedUsername !== current.username) {
      const conflict = await prisma.profile.findUnique({
        where: { username: validatedUsername },
        select: { userId: true },
      });
      if (conflict) {
        return NextResponse.json(
          { error: 'Username already taken', fields: { username: 'That username is already taken.' } },
          { status: 409 }
        );
      }
    }

    // Build update payload — only include fields that were sent
    const profileUpdate: { username?: string; displayName?: string | null } = {};
    if (validatedUsername    !== undefined) profileUpdate.username    = validatedUsername;
    if (validatedDisplayName !== undefined) profileUpdate.displayName = validatedDisplayName;

    const updated = await prisma.profile.update({
      where: { userId: user.id },
      data: profileUpdate,
      select: { username: true, displayName: true },
    });

    return NextResponse.json({ username: updated.username, displayName: updated.displayName });

  } catch (err) {
    console.error('[PATCH /api/me/profile]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
