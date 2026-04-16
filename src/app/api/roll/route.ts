// src/app/api/roll/route.ts
//
// GET /api/roll
//
// Returns the authenticated user's saved watches (favorites + owned).
// Designed for native mobile clients.
//
// Query params:
//   tab   — "favorites" (default) | "owned"
//
// Response:
//   {
//     watches: WatchListing[],
//     counts: { favorites: number, owned: number }
//   }

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/get-auth-user';
import { prisma } from '@/lib/db';
import { shopifyThumbnailUrl } from '@/lib/format';

export async function GET(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = user.id;
  const url = new URL(req.url);
  const tab = url.searchParams.get('tab') === 'owned' ? 'OWNED' : 'FAVORITES';
  const collectionId = url.searchParams.get('collectionId') ?? undefined;

  const [favoritesCount, ownedCount, saves] = await Promise.all([
    prisma.wishlistItem.count({ where: { userId, list: 'FAVORITES' } }),
    prisma.wishlistItem.count({ where: { userId, list: 'OWNED' } }),
    prisma.wishlistItem.findMany({
      where: { userId, list: tab, ...(collectionId ? { collectionId } : {}) },
      include: {
        listing: {
          include: {
            source: { select: { id: true, name: true, slug: true, baseUrl: true } },
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // safety cap — full pagination is a 60-day item
    }),
  ]);

  const watches = saves.map(s => ({
    ...s.listing,
    isSaved: tab === 'FAVORITES',
    isOwned: tab === 'OWNED',
    isLiked: false,
    friendLikes: [],
    images: s.listing.images.map(img => ({
      ...img,
      url: shopifyThumbnailUrl(img.url),
    })),
  }));

  return NextResponse.json({
    watches,
    counts: { favorites: favoritesCount, owned: ownedCount },
  });
}
