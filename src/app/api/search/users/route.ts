// src/app/api/search/users/route.ts
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/get-auth-user';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const viewerId = user.id;
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
