// src/app/api/saves/[id]/route.ts
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/get-auth-user';
import { prisma } from '@/lib/db';
import { emitFeedEvent } from '@/lib/social/feed-service';

// POST — add to a list or move between lists
// Body: { list: 'FAVORITES' | 'OWNED' }  (defaults to FAVORITES)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = user.id;
  const listingId = params.id;

  let list: 'FAVORITES' | 'OWNED' = 'FAVORITES';
  try {
    const body = await req.json();
    if (body.list === 'OWNED') list = 'OWNED';
  } catch { /* no body is fine */ }

  // Check if already in any list (to detect create vs move)
  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_listingId: { userId, listingId } },
    select: { list: true },
  });

  const isNew = !existing;

  // Upsert the wishlist record + conditionally increment saveCount in one
  // transaction so both succeed or both fail. Prevents count drift under
  // concurrent traffic or mid-request deploys.
  await prisma.$transaction(async (tx) => {
    await tx.wishlistItem.upsert({
      where: { userId_listingId: { userId, listingId } },
      create: { userId, listingId, list },
      update: { list },
    });

    if (isNew) {
      await tx.watchListing.update({
        where: { id: listingId },
        data: { saveCount: { increment: 1 } },
      });
    }
  });

  // Emit feed event outside the transaction — non-critical, failure here
  // should not roll back the save itself.
  if (isNew || existing?.list !== list) {
    await emitFeedEvent({
      actorId: userId,
      type: list === 'OWNED' ? 'OWNED' : 'SAVED',
      listingId,
    }).catch((err) => console.error('[saves POST] emitFeedEvent failed:', err));
  }

  return NextResponse.json({ list });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = user.id;
  const listingId = params.id;

  // Delete + decrement in one transaction so counts stay consistent.
  await prisma.$transaction(async (tx) => {
    const deleted = await tx.wishlistItem.deleteMany({ where: { userId, listingId } });
    if (deleted.count > 0) {
      // Guard: only decrement if count is already positive to prevent going negative.
      await tx.watchListing.updateMany({
        where: { id: listingId, saveCount: { gt: 0 } },
        data: { saveCount: { decrement: 1 } },
      });
    }
  });

  return NextResponse.json({ list: null });
}
