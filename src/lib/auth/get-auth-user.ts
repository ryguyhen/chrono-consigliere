// src/lib/auth/get-auth-user.ts
//
// Unified auth helper for API routes.
//
// Resolves the authenticated user from EITHER:
//   1. Authorization: Bearer <mobile-jwt>  (native clients)
//   2. NextAuth cookie session              (web client)
//
// Returns the same shape regardless of source so route handlers don't need
// to know or care which client is calling.
//
// Usage:
//   const user = await getAuthUser(req);
//   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//   // user.id is the DB user CUID

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { verifyAccessToken } from '@/lib/auth/mobile-jwt';

export interface AuthUser {
  id: string;
}

/**
 * Extract the authenticated user from a request.
 *
 * Checks the Bearer token first (fast, no DB hit for access tokens),
 * then falls back to the cookie-based NextAuth session.
 */
export async function getAuthUser(req?: Request): Promise<AuthUser | null> {
  // 1. Try Bearer token (mobile clients)
  if (req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = verifyAccessToken(token);
      if (payload) {
        return { id: payload.sub };
      }
      // Invalid/expired Bearer token — don't fall through to cookies.
      // Mobile clients should refresh, not silently degrade to cookie auth.
      return null;
    }
  }

  // 2. Fall back to cookie session (web client)
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    return { id: session.user.id };
  }

  return null;
}

/**
 * Convenience: extract user ID or null.
 * For routes where auth is optional (e.g. /api/browse — unauthenticated
 * requests get listings without isLiked/isSaved fields).
 */
export async function getAuthUserId(req?: Request): Promise<string | null> {
  const user = await getAuthUser(req);
  return user?.id ?? null;
}
