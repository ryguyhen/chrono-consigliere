// src/app/api/saves/[id]/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { prisma } from '@/lib/db';
import { emitFeedEvent } from '@/lib/social/feed-service';

// POST — add to a list or move between lists
// Body: { list: 'FAVORITES' | 'OWNED' }  (defaults to FAVORITES)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id;
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

  await prisma.wishlistItem.upsert({
    where: { userId_listingId: { userId, listingId } },
    create: { userId, listingId, list },
    update: { list },
  });

  const isNew = !existing;
  if (isNew) {
    // First time saving — increment counter and emit event
    await prisma.watchListing.update({
      where: { id: listingId },
      data: { saveCount: { increment: 1 } },
    });
  }
  // Emit feed event on add or move
  if (isNew || existing?.list !== list) {
    await emitFeedEvent({ actorId: userId, type: list === 'OWNED' ? 'OWNED' : 'SAVED', listingId });
  }

  return NextResponse.json({ list });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as any).id;
  const listingId = params.id;

  const deleted = await prisma.wishlistItem.deleteMany({ where: { userId, listingId } });
  if (deleted.count > 0) {
    await prisma.watchListing.update({
      where: { id: listingId },
      data: { saveCount: { decrement: 1 } },
    });
  }
  return NextResponse.json({ list: null });
}
