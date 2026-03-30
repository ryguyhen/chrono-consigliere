// src/app/profile/[username]/page.tsx
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { prisma } from '@/lib/db';
import { getTasteOverlap } from '@/lib/social/feed-service';
import { WatchCard } from '@/components/watches/WatchCard';
import { FollowButton } from '@/components/profile/FollowButton';
import Link from 'next/link';

interface PageProps { params: { username: string } }

export async function generateMetadata({ params }: PageProps) {
  const profile = await prisma.profile.findUnique({ where: { username: params.username } });
  if (!profile) return { title: 'Profile not found' };
  return { title: `${profile.displayName ?? profile.username} — Chrono Consigliere` };
}

export default async function ProfilePage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const viewerId = (session?.user as any)?.id;

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
      <div className="bg-ink text-cream px-6 py-8">
        <div className="max-w-[900px] mx-auto">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="w-[72px] h-[72px] rounded-full bg-gold flex items-center justify-center font-serif text-[2rem] font-light text-cream flex-shrink-0 border-2 border-white/10">
              {displayName[0].toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-[1.8rem] font-light">{displayName}</h1>
              <div className="font-mono text-[12px] text-cream/40 mb-2">@{profile.username}</div>
              {profile.bio && (
                <p className="text-[13px] text-cream/60 max-w-[420px] leading-relaxed mb-3">{profile.bio}</p>
              )}

              {/* Stats */}
              <div className="flex gap-6">
                {[
                  [profile.user._count.saves, 'In roll'],
                  [profile.user._count.likes, 'Liked'],
                  [profile.user._count.following, 'Following'],
                  [profile.user._count.followers, 'Followers'],
                ].map(([n, l]) => (
                  <div key={l as string}>
                    <div className="font-serif text-[1.2rem] font-light">{n}</div>
                    <div className="text-[10px] tracking-[0.08em] uppercase text-cream/40">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex-shrink-0">
              {isOwnProfile ? (
                <button className="border border-white/20 text-cream text-[11px] uppercase tracking-wide px-4 py-2 rounded hover:border-gold hover:text-gold transition-colors">
                  Edit profile
                </button>
              ) : (
                <FollowButton userId={profile.userId} initialIsFollowing={isFollowing} />
              )}
            </div>
          </div>

          {/* Taste DNA */}
          {profile.tasteTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-white/10">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-cream/30 mr-1 self-center">Taste</span>
              {profile.tasteTags.map((tag, i) => (
                <span
                  key={tag}
                  className={`text-[10px] px-2.5 py-1 rounded-full border
                    ${i < 3
                      ? 'bg-gold/15 border-gold/25 text-gold'
                      : 'bg-white/5 border-white/10 text-cream/50'}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Taste overlap (only when viewing another person) */}
          {overlap && (overlap.overlapCount ?? 0) > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-cream/30">Shared taste</span>
              <span className="font-mono text-[14px] text-gold">{overlap.score}%</span>
              <span className="text-[12px] text-cream/50">
                {overlap.sharedBrands.slice(0, 2).join(', ')}
                {overlap.sharedStyles.length > 0 && ` · ${overlap.sharedStyles[0]}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content tabs */}
      <div className="border-b border-[var(--border)] bg-surface">
        <div className="max-w-[900px] mx-auto flex">
          {['Roll', 'Liked', 'Collections'].map(tab => (
            <div key={tab} className="px-5 py-3.5 text-[12px] uppercase tracking-[0.08em] cursor-pointer border-b-2 border-gold text-ink first:border-b-2">
              {tab}
            </div>
          ))}
        </div>
      </div>

      {/* Saved watches */}
      <div className="max-w-[900px] mx-auto px-6 py-6">
        {saves.length > 0 ? (
          <>
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted mb-4">
              {saves.length} in roll
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {saves.map(s => (
                <WatchCard
                  key={s.id}
                  watch={{
                    ...s.listing,
                    isLiked: false,
                    isSaved: true,
                    friendLikes: [],
                  } as any}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {collections.map((col, i) => {
                const bg = ['#1A1612', '#1A3A5C', '#2D6A4F', '#5C1A1A', '#3A1A5C'][i % 5];
                return (
                  <div
                    key={col.id}
                    className="aspect-[4/3] rounded-lg p-5 flex flex-col justify-end cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ background: bg }}
                  >
                    <div className="font-serif text-[1.1rem] text-cream/90 mb-1">{col.name}</div>
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
