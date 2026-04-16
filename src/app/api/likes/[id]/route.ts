// src/app/api/likes/[id]/route.ts
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/get-auth-user';
import { prisma } from '@/lib/db';
import { emitFeedEvent } from '@/lib/social/feed-service';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = user.id;
  const listingId = params.id;

  try {
    // Create like record + increment likeCount atomically.
    // If the like already exists, the unique constraint throws and we return 409.
    await prisma.$transaction(async (tx) => {
      await tx.like.create({ data: { userId, listingId } });
      await tx.watchListing.update({
        where: { id: listingId },
        data: { likeCount: { increment: 1 } },
      });
    });

    // Emit feed event outside the transaction — non-critical.
    await emitFeedEvent({ actorId: userId, type: 'LIKED', listingId })
      .catch((err) => console.error('[likes POST] emitFeedEvent failed:', err));

    return NextResponse.json({ liked: true });
  } catch {
    // Unique constraint violation = already liked. Return 409 without touching the count.
    return NextResponse.json({ liked: false }, { status: 409 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = user.id;
  const listingId = params.id;

  // Delete like + decrement count atomically.
  await prisma.$transaction(async (tx) => {
    const deleted = await tx.like.deleteMany({ where: { userId, listingId } });
    if (deleted.count > 0) {
      // Guard: only decrement if count is already positive to prevent going negative.
      await tx.watchListing.updateMany({
        where: { id: listingId, likeCount: { gt: 0 } },
        data: { likeCount: { decrement: 1 } },
      });
    }
  });

  return NextResponse.json({ liked: false });
}
