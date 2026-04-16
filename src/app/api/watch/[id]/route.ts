// src/app/api/watch/[id]/route.ts
//
// GET /api/watch/:id
//
// JSON endpoint for a single watch listing, designed for native mobile clients.
// Returns the same data as the web detail page but as structured JSON.
//
// Authentication is optional — unauthenticated requests receive the listing
// with isLiked/isSaved/isOwned set to null.

import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth/get-auth-user';
import { getWatchById } from '@/lib/watches/queries';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await getAuthUserId(req);
    const watch = await getWatchById(params.id, userId ?? undefined);

    if (!watch || !watch.isAvailable) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Friend likes (same logic as the web detail page)
    let friendLikes: { username: string; displayName: string | null }[] = [];
    if (userId) {
      const following = await prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      });
      const followingIds = following.map(f => f.followingId);
      if (followingIds.length) {
        const likes = await prisma.like.findMany({
          where: { listingId: watch.id, userId: { in: followingIds } },
          include: { user: { include: { profile: true } } },
          take: 5,
        });
        friendLikes = likes.map(l => ({
          username: l.user.profile?.username ?? 'unknown',
          displayName: l.user.profile?.displayName ?? l.user.name,
        }));
      }
    }

    return NextResponse.json({ watch, friendLikes });
  } catch (err: any) {
    console.error('[GET /api/watch/:id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
