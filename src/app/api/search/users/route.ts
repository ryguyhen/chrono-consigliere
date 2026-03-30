// src/app/api/search/users/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const viewerId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) return NextResponse.json({ users: [] });

  const users = await prisma.profile.findMany({
    where: {
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
      ],
      userId: { not: viewerId },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          followers: { where: { followerId: viewerId }, select: { followerId: true } },
          _count: { select: { followers: true, likes: true } },
        },
      },
    },
    take: 20,
  });

  return NextResponse.json({
    users: users.map(p => ({
      id: p.user.id,
      username: p.username,
      displayName: p.displayName ?? p.user.name,
      tasteTags: p.tasteTags,
      isFollowing: p.user.followers.length > 0,
      followerCount: p.user._count.followers,
      likeCount: p.user._count.likes,
    })),
  });
}
