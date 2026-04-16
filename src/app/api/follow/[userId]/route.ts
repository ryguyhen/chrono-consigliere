// src/app/api/follow/[userId]/route.ts
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/get-auth-user';
import { prisma } from '@/lib/db';
import { emitFeedEvent } from '@/lib/social/feed-service';

export async function POST(req: Request, { params }: { params: { userId: string } }) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const followerId = user.id;
  const followingId = params.userId;

  if (followerId === followingId)
    return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });

  try {
    await prisma.follow.create({ data: { followerId, followingId } });
    await emitFeedEvent({ actorId: followerId, type: 'FOLLOWED', metadata: { followingId } });
    return NextResponse.json({ following: true });
  } catch {
    return NextResponse.json({ following: false }, { status: 409 });
  }
}

export async function DELETE(req: Request, { params }: { params: { userId: string } }) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const followerId = user.id;

  await prisma.follow.deleteMany({ where: { followerId, followingId: params.userId } });
  return NextResponse.json({ following: false });
}
