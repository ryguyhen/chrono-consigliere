// src/app/profile/[username]/page.tsx
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { prisma } from '@/lib/db';
import { getTasteOverlap } from '@/lib/social/feed-service';
import { WatchCard } from '@/components/watches/WatchCard';
import { FollowButton } from '@/components/profile/FollowButton';
import { EditProfileButton } from '@/components/profile/EditProfileButton';
import type { WatchWithRelations } from '@/types';
import Link from 'next/link';

interface PageProps { params: { username: string } }

export async function generateMetadata({ params }: PageProps) {
  const profile = await prisma.profile.findUnique({ where: { username: params.username } });
  if (!profile) return { title: 'Profile not found' };
  return { title: `${profile.displayName ?? profile.username} — Chrono Consigliere` };
}

export default async function ProfilePage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;

  const profile = await prisma.profile.findUnique({
    where: { username: params.username },
    include: {
      user: {
        include: {
          _count: { select: { likes: true, saves: true, following: true, followers: true } },
          following: viewerId ? { where: { followingId: viewerId }, take: 1 } : false,
        },
      },
    },
  });

  if (!profile) notFound();

  const isOwnProfile = viewerId === profile.userId;

  // Check if viewer follows this user
  const isFollowing = viewerId ? !!(await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: profile.userId } },
  })) : false;

  // Fetch saves and likes
  const [saves, likes, collections] = await Promise.all([
    prisma.wishlistItem.findMany({
      where: { userId: profile.userId },
      include: {
        listing: {
          include: {
            source: { select: { id: true, name: true, slug: true, baseUrl: true } },
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 24,
    }),
    prisma.like.findMany({
      where: { userId: profile.userId },
      include: {
        listing: {
          include: {
            source: { select: { id: true, name: true, slug: true, baseUrl: true } },
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 24,
    }),
    prisma.collection.findMany({
      where: { userId: profile.userId, privacy: isOwnProfile ? undefined : 'PUBLIC' },
      include: { _count: { select: { items: true } } },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  // Taste overlap if viewing someone else's profile
  let overlap = null;
  if (viewerId && !isOwnProfile) {
    overlap = await getTasteOverlap(viewerId, profile.userId);
  }

  const displayName = profile.displayName ?? profile.username;

  return (
    <div>
      {/* Profile header */}
      <div className="bg-black text-white px-4 sm:px-6 py-6 sm:py-8 border-b border-white/[0.07]">
        <div className="max-w-[900px] mx-auto">
          <div className="flex items-start gap-4 sm:gap-5">
            {/* Avatar */}
            <div className="w-[56px] h-[56px] sm:w-[72px] sm:h-[72px] rounded-full bg-gold flex items-center justify-center text-[1.3rem] sm:text-[1.6rem] font-bold text-black flex-shrink-0">
              {displayName[0].toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-[1.3rem] sm:text-[1.7rem] font-semibold tracking-[-0.03em] mb-0.5 truncate">{displayName}</h1>
                  <div className="font-mono text-[11px] text-white/35 mb-2">@{profile.username}</div>
                </div>
                {/* Actions — moved inside flex row */}
                <div className="flex-shrink-0">
                  {isOwnProfile ? (
                    <EditProfileButton
                      currentDisplayName={profile.displayName}
                      currentUsername={profile.username}
                    />
                  ) : (
                    <FollowButton userId={profile.userId} initialIsFollowing={isFollowing} />
                  )}
                </div>
              </div>

              {profile.bio && (
                <p className="text-[13px] text-white/55 max-w-[420px] leading-relaxed mb-3">{profile.bio}</p>
              )}

              {/* Stats */}
              <div className="flex gap-4 sm:gap-6 flex-wrap">
                {[
                  [profile.user._count.saves, 'In roll'],
                  [profile.user._count.likes, 'Liked'],
                  [profile.user._count.following, 'Following'],
                  [profile.user._count.followers, 'Followers'],
                ].map(([n, l]) => (
                  <div key={l as string}>
                    <div className="text-[1rem] sm:text-[1.15rem] font-semibold">{n}</div>
                    <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-white/30 mt-0.5">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Taste */}
          {profile.tasteTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-white/[0.07]">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/25 mr-1 self-center">Taste</span>
              {profile.tasteTags.map((tag, i) => (
                <span
                  key={tag}
                  className={`font-mono text-[9px] px-2.5 py-1 rounded-full border tracking-[0.06em]
                    ${i < 3
                      ? 'bg-gold/10 border-gold/25 text-gold'
                      : 'bg-white/[0.04] border-white/10 text-white/40'}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Shared taste */}
          {overlap && (overlap.overlapCount ?? 0) > 0 && (
            <div className="mt-4 pt-4 border-t border-white/[0.07] flex items-center gap-3">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/25">Shared taste</span>
              <span className="font-mono text-[14px] text-gold font-medium">{overlap.score}%</span>
              <span className="text-[12px] text-white/45">
                {overlap.sharedBrands.slice(0, 2).join(', ')}
                {overlap.sharedStyles.length > 0 && ` · ${overlap.sharedStyles[0]}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Roll */}
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {saves.length > 0 ? (
          <>
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted mb-4">
              {saves.length} in roll
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {saves.map(s => (
                <WatchCard
                  key={s.id}
                  watch={{ ...s.listing, isLiked: false, isSaved: true, isOwned: false, friendLikes: [] } as WatchWithRelations}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16 text-muted">
            <div className="font-serif text-3xl mb-3 opacity-15">◇</div>
            <div className="font-serif text-lg font-light mb-2 text-ink">Roll is empty</div>
            <Link href="/browse" className="font-mono text-[10px] tracking-[0.1em] uppercase text-gold hover:text-gold-dark transition-colors">Browse watches →</Link>
          </div>
        )}

        {/* Collections */}
        {collections.length > 0 && (
          <div className="mt-10">
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted mb-4">Collections</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {collections.map((col, i) => {
                const bg = ['#1A1612', '#1A3A5C', '#2D6A4F', '#5C1A1A', '#3A1A5C'][i % 5];
                return (
                  <div
                    key={col.id}
                    className="aspect-[4/3] rounded-lg p-5 flex flex-col justify-end cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ background: bg }}
                  >
                    <div className="text-[1rem] font-normal text-cream/90 mb-1 tracking-[-0.01em]">{col.name}</div>
                    <div className="text-[11px] text-cream/40">{col._count.items} watches</div>
                  </div>
                );
              })}
              {isOwnProfile && (
                <div className="aspect-[4/3] rounded-lg border border-dashed border-[var(--border)] flex items-center justify-center cursor-pointer hover:border-gold text-muted hover:text-gold transition-colors text-[12px]">
                  + New collection
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
