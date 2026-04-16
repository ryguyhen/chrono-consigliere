// src/app/api/profiles/[username]/route.ts
// Public profile endpoint — auth optional.
// Unauthenticated: returns profile data with isFollowing: false.
// Authenticated: includes viewer's follow status and isOwnProfile flag.

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/get-auth-user';
import { prisma } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: { username: string } }
) {
  try {
  const user = await getAuthUser(req); // null if unauthenticated — not a 401
  const viewerId = user?.id ?? null;

  const profile = await prisma.profile.findUnique({
    where: { username: params.username },
    include: {
      user: {
        include: {
          _count: {
            select: { likes: true, saves: true, following: true, followers: true },
          },
        },
      },
    },
  });

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isOwnProfile = viewerId === profile.userId;

  const isFollowing =
    viewerId && !isOwnProfile
      ? !!(await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: viewerId,
              followingId: profile.userId,
            },
          },
        }))
      : false;

  const saves = await prisma.wishlistItem.findMany({
    where: { userId: profile.userId },
    include: {
      listing: {
        select: {
          id: true,
          brand: true,
          model: true,
          sourceTitle: true,
          price: true,
          currency: true,
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { url: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });

  return NextResponse.json({
    profile: {
      userId: profile.userId,
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      tasteTags: profile.tasteTags,
      counts: {
        saves: profile.user._count.saves,
        likes: profile.user._count.likes,
        following: profile.user._count.following,
        followers: profile.user._count.followers,
      },
      isFollowing,
      isOwnProfile,
    },
    recentSaves: saves.map((s) => ({
      id: s.listing.id,
      brand: s.listing.brand,
      model: s.listing.model,
      sourceTitle: s.listing.sourceTitle,
      price: s.listing.price,
      currency: s.listing.currency,
      images: s.listing.images,
    })),
  });
  } catch (err) {
    console.error('[GET /api/profiles/:username]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
