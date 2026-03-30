// src/lib/social/feed-service.ts
// Handles social event creation and feed fanout.
// When a user likes, saves, or purchases, feed events are written
// for all followers of that user.

import { prisma } from '@/lib/db';
import type { FeedEventType } from '@prisma/client';

export async function emitFeedEvent({
  actorId,
  type,
  listingId,
  metadata,
}: {
  actorId: string;
  type: FeedEventType;
  listingId?: string;
  metadata?: Record<string, string>;
}) {
  // Create the feed event
  const event = await prisma.activityFeedEvent.create({
    data: {
      actorId,
      type,
      listingId,
      metadata,
    },
  });

  // If this is a purchase, check for influence events:
  // Did any followers of the buyer like/save this watch?
  if (type === 'PURCHASED' && listingId) {
    await checkAndEmitInfluenceEvents(actorId, listingId);
  }

  return event;
}

async function checkAndEmitInfluenceEvents(
  buyerId: string,
  listingId: string
) {
  // Find who the buyer follows
  const following = await prisma.follow.findMany({
    where: { followerId: buyerId },
    select: { followingId: true },
  });
  const followingIds = following.map(f => f.followingId);

  if (!followingIds.length) return;

  // Find friends who had liked or saved this listing
  const [friendLikes, friendSaves] = await Promise.all([
    prisma.like.findMany({
      where: { listingId, userId: { in: followingIds } },
      select: { userId: true },
    }),
    prisma.wishlistItem.findMany({
      where: { listingId, userId: { in: followingIds } },
      select: { userId: true },
    }),
  ]);

  const influencerIds = [
    ...new Set([
      ...friendLikes.map(l => l.userId),
      ...friendSaves.map(s => s.userId),
    ]),
  ];

  // Emit influence events — one per influencer friend
  for (const influencerId of influencerIds) {
    await prisma.activityFeedEvent.create({
      data: {
        actorId: buyerId,
        targetUserId: influencerId,
        type: 'INFLUENCED_PURCHASE',
        listingId,
        metadata: { influencedBy: influencerId },
      },
    });
  }
}

export async function getFeedForUser(userId: string, cursor?: string, limit = 20) {
  // Get who this user follows
  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  const followingIds = following.map(f => f.followingId);

  return prisma.activityFeedEvent.findMany({
    where: {
      actorId: { in: followingIds },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    include: {
      actor: { include: { profile: true } },
      listing: { include: { images: { where: { isPrimary: true } }, source: true } },
    },
  });
}

export async function getTasteOverlap(userId: string, friendId: string) {
  const [myLikes, friendLikes, mySaves, friendSaves] = await Promise.all([
    prisma.like.findMany({ where: { userId }, select: { listingId: true } }),
    prisma.like.findMany({ where: { userId: friendId }, select: { listingId: true } }),
    prisma.wishlistItem.findMany({ where: { userId }, select: { listingId: true } }),
    prisma.wishlistItem.findMany({ where: { userId: friendId }, select: { listingId: true } }),
  ]);

  const myIds = new Set([...myLikes, ...mySaves].map(i => i.listingId));
  const friendIds = new Set([...friendLikes, ...friendSaves].map(i => i.listingId));
  const overlapIds = [...myIds].filter(id => friendIds.has(id));

  if (!overlapIds.length) return { overlap: [], score: 0, sharedBrands: [], sharedStyles: [] };

  const overlapListings = await prisma.watchListing.findMany({
    where: { id: { in: overlapIds } },
    select: { brand: true, style: true, movementType: true, caseSizeMm: true },
  });

  const brands = overlapListings.map(l => l.brand).filter(Boolean);
  const styles = overlapListings.map(l => l.style).filter(Boolean);

  return {
    overlapCount: overlapIds.length,
    score: Math.round((overlapIds.length / Math.max(myIds.size, 1)) * 100),
    sharedBrands: [...new Set(brands)] as string[],
    sharedStyles: [...new Set(styles)] as string[],
    sampleListingIds: overlapIds.slice(0, 6),
  };
}
