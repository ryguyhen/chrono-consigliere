// src/app/api/me/following/route.ts
// Returns the authenticated user's following list.
// Response shape matches /api/search/users so mobile can share UserRow component.

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/get-auth-user';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const follows = await prisma.follow.findMany({
    where: { followerId: user.id },
    include: {
      following: {
        include: {
          profile: {
            select: { username: true, displayName: true, tasteTags: true },
          },
          _count: { select: { followers: true, likes: true } },
        },
      },
    },
    take: 100,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    following: follows
      .filter((f) => f.following.profile)
      .map((f) => ({
        id: f.following.id,
        username: f.following.profile!.username,
        displayName: f.following.profile!.displayName,
        tasteTags: f.following.profile!.tasteTags,
        isFollowing: true,
        followerCount: f.following._count.followers,
        likeCount: f.following._count.likes,
      })),
  });
}
