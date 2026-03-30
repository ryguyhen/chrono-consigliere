// src/app/feed/page.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { getFeedForUser, getTasteOverlap } from '@/lib/social/feed-service';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import Image from 'next/image';

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const EVENT_VERB: Record<string, string> = {
  LIKED: 'liked',
  SAVED: 'saved to wishlist',
  PURCHASED: 'marked as purchased',
  INFLUENCED_PURCHASE: 'bought something you had saved',
  FOLLOWED: 'started following someone',
  ADDED_TO_COLLECTION: 'added to a collection',
};

function Avatar({ name, image, size = 36 }: { name: string | null; image?: string | null; size?: number }) {
  const initials = (name ?? 'U').slice(0, 2).toUpperCase();
  const colors = ['bg-gold', 'bg-[#5A6E8C]', 'bg-[#6E5A8C]', 'bg-[#5A8C6E]', 'bg-[#8C6E5A]'];
  const color = colors[initials.charCodeAt(0) % colors.length];
  return (
    <div className={`rounded-full ${color} flex items-center justify-center flex-shrink-0 text-cream font-serif`}
      style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
}

export default async function FeedPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const userId = (session.user as any).id;

  const [feedEvents, following, suggestedUsers] = await Promise.all([
    getFeedForUser(userId, undefined, 30),
    prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          include: { profile: true, _count: { select: { likes: true, saves: true } } },
        },
      },
      take: 8,
    }),
    // Suggest people to follow (not already following)
    prisma.user.findMany({
      where: {
        id: { not: userId },
        followers: { none: { followerId: userId } },
        profile: { isNot: null },
      },
      include: { profile: true },
      take: 4,
    }),
  ]);

  // Trending brands in network (requires following list)
  const trendingBrands = await prisma.watchListing.groupBy({
    by: ['brand'],
    where: {
      isAvailable: true,
      likes: { some: { userId: { in: following.map(f => f.followingId) } } },
    },
    _count: { brand: true },
    orderBy: { _count: { brand: 'desc' } },
    take: 6,
  });

  // Taste overlaps with first 3 friends
  const overlaps = await Promise.all(
    following.slice(0, 3).map(async f => ({
      friend: f.following,
      overlap: await getTasteOverlap(userId, f.followingId),
    }))
  );

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">

        {/* MAIN FEED */}
        <div>
          <h1 className="font-serif text-[1.4rem] font-light mb-6">Friends Activity</h1>

          {feedEvents.length === 0 ? (
            <div className="text-center py-20 text-muted">
              <div className="font-serif text-4xl mb-4 opacity-20">◈</div>
              <div className="font-serif text-xl font-light mb-2">Your feed is quiet</div>
              <p className="text-sm mb-5">Follow friends to see what they're into.</p>
              <Link href="/browse" className="text-[12px] uppercase tracking-wide text-gold hover:text-gold-dark">
                Browse watches →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {feedEvents.map(event => {
                const isInfluence = event.type === 'INFLUENCED_PURCHASE';
                const actorName = event.actor.profile?.displayName ?? event.actor.name ?? 'Someone';
                const actorUsername = event.actor.profile?.username;
                const verb = EVENT_VERB[event.type] ?? event.type.toLowerCase();
                const meta = event.metadata as Record<string, string> | null;

                return (
                  <div
                    key={event.id}
                    className={`bg-surface border rounded-lg p-4 flex gap-3 transition-colors
                      ${isInfluence ? 'border-gold/25 bg-gold/[0.03]' : 'border-[var(--border)]'}`}
                  >
                    <Link href={`/profile/${actorUsername}`}>
                      <Avatar name={actorName} image={event.actor.image} />
                    </Link>

                    <div className="flex-1 min-w-0">
                      {isInfluence && (
                        <div className="text-[9px] font-medium tracking-[0.12em] uppercase text-gold mb-1.5 flex items-center gap-1">
                          <span>⟡</span> Influence event
                        </div>
                      )}

                      <div className="text-[13px] text-ink/80 mb-2">
                        <Link href={`/profile/${actorUsername}`} className="font-medium text-ink hover:text-gold">
                          {actorName}
                        </Link>
                        {' '}{verb}
                        {meta?.collectionName && (
                          <span className="text-muted"> · {meta.collectionName}</span>
                        )}
                      </div>

                      {/* Watch preview */}
                      {event.listing && (
                        <Link
                          href={`/watch/${event.listing.id}`}
                          className="flex gap-3 bg-parchment rounded p-2.5 hover:bg-parchment/80 transition-colors"
                        >
                          <div className="w-12 h-12 rounded flex-shrink-0 bg-ink/5 overflow-hidden relative">
                            {event.listing.images?.[0] ? (
                              <Image
                                src={event.listing.images[0].url}
                                alt={event.listing.sourceTitle}
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-7 h-7 rounded-full border border-ink/10" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[9px] uppercase tracking-[0.1em] text-gold">{event.listing.brand}</div>
                            <div className="font-serif text-[14px] truncate">{event.listing.model || event.listing.sourceTitle}</div>
                            <div className="text-[11px] text-muted">{event.listing.sourcePrice}</div>
                          </div>
                        </Link>
                      )}

                      <div className="text-[10px] text-muted font-mono mt-2">{timeAgo(new Date(event.createdAt))}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <div className="space-y-5">

          {/* Taste overlap */}
          {overlaps.some(o => (o.overlap.overlapCount ?? 0) > 0) && (
            <div className="bg-surface border border-[var(--border)] rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted mb-3 font-medium">Taste overlap</div>
              <div className="space-y-3">
                {overlaps.filter(o => (o.overlap.overlapCount ?? 0) > 0).map(({ friend, overlap }) => (
                  <div key={friend.id} className="flex items-start gap-2.5 py-2.5 border-b border-[var(--border-soft)] last:border-0">
                    <Avatar name={friend.profile?.displayName ?? friend.name} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-ink leading-tight">
                        You and <span className="font-medium">{friend.profile?.displayName ?? friend.name}</span> both love{' '}
                        {overlap.sharedBrands.slice(0, 2).join(', ')}
                      </div>
                      {overlap.sharedStyles.length > 0 && (
                        <div className="text-[10px] text-muted mt-0.5">{overlap.sharedStyles.slice(0, 2).join(', ')}</div>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-gold flex-shrink-0">{overlap.score}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trending brands */}
          {trendingBrands.length > 0 && (
            <div className="bg-surface border border-[var(--border)] rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted mb-3 font-medium">Trending in your network</div>
              <div className="space-y-1.5">
                {trendingBrands.map((b, i) => (
                  <Link
                    key={b.brand}
                    href={`/browse?brand=${encodeURIComponent(b.brand)}`}
                    className="flex items-center gap-2.5 py-1.5 hover:text-gold transition-colors"
                  >
                    <span className="text-[10px] font-mono text-muted w-4">{i + 1}</span>
                    <span className="flex-1 text-[13px] text-ink">{b.brand}</span>
                    <span className="text-[10px] text-muted">{b._count} friends</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* People to follow */}
          {suggestedUsers.length > 0 && (
            <div className="bg-surface border border-[var(--border)] rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted mb-3 font-medium">People to follow</div>
              <div className="space-y-3">
                {suggestedUsers.map(user => (
                  <div key={user.id} className="flex items-center gap-2.5">
                    <Avatar name={user.profile?.displayName ?? user.name} size={30} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-ink truncate">
                        {user.profile?.displayName ?? user.name}
                      </div>
                      <div className="text-[10px] text-muted truncate">
                        {user.profile?.tasteTags?.slice(0, 2).join(', ')}
                      </div>
                    </div>
                    <form action={`/api/follow/${user.id}`} method="POST">
                      <button
                        type="submit"
                        className="text-[10px] uppercase tracking-wide px-2.5 py-1 border border-[var(--border)] rounded hover:border-gold hover:text-gold text-muted transition-colors"
                      >
                        Follow
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Who you follow */}
          {following.length > 0 && (
            <div className="bg-surface border border-[var(--border)] rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted mb-3 font-medium">
                Following ({following.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {following.map(f => (
                  <Link key={f.followingId} href={`/profile/${f.following.profile?.username}`} title={f.following.profile?.displayName ?? f.following.name ?? ''}>
                    <Avatar name={f.following.profile?.displayName ?? f.following.name} size={32} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
