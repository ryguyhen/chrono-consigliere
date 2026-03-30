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
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

const EVENT_COPY: Record<string, string> = {
  LIKED: 'liked',
  SAVED: 'added to their roll',
  PURCHASED: 'bought',
  INFLUENCED_PURCHASE: 'bought something in your roll',
  FOLLOWED: 'is now following',
  ADDED_TO_COLLECTION: 'added to',
};

function Avatar({ name, size = 34 }: { name: string | null; size?: number }) {
  const initials = (name ?? 'U').slice(0, 2).toUpperCase();
  const hue = (initials.charCodeAt(0) * 37 + initials.charCodeAt(1) * 13) % 360;
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-serif text-cream/70"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.32,
        background: `hsl(${hue}, 18%, 22%)`,
      }}
    >
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

  const overlaps = await Promise.all(
    following.slice(0, 3).map(async f => ({
      friend: f.following,
      overlap: await getTasteOverlap(userId, f.followingId),
    }))
  );

  return (
    <div className="max-w-[1040px] mx-auto px-6 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-12">

        {/* MAIN FEED */}
        <div>
          <h1 className="font-serif text-[1.5rem] font-light mb-8">Your circle</h1>

          {feedEvents.length === 0 ? (
            <div className="text-center py-24 text-muted">
              <div className="font-serif text-3xl mb-5 opacity-15">◈</div>
              <div className="font-serif text-xl font-light mb-2 text-ink">Nothing yet</div>
              <p className="text-[13px] text-muted mb-6">Follow people to see what they're saving.</p>
              <Link href="/people" className="font-mono text-[10px] tracking-[0.1em] uppercase text-gold hover:text-gold-dark">
                Find people →
              </Link>
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-[var(--border)]">
              {feedEvents.map(event => {
                const isInfluence = event.type === 'INFLUENCED_PURCHASE';
                const actorName = event.actor.profile?.displayName ?? event.actor.name ?? 'Someone';
                const actorUsername = event.actor.profile?.username;
                const verb = EVENT_COPY[event.type] ?? event.type.toLowerCase();
                const meta = event.metadata as Record<string, string> | null;

                return (
                  <div key={event.id} className={`py-5 flex gap-4 ${isInfluence ? 'bg-gold/[0.02] -mx-4 px-4' : ''}`}>
                    <Link href={`/profile/${actorUsername}`} className="flex-shrink-0 mt-0.5">
                      <Avatar name={actorName} />
                    </Link>

                    <div className="flex-1 min-w-0">
                      {isInfluence && (
                        <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-gold/80 mb-2">
                          In your roll
                        </div>
                      )}

                      <div className="text-[13px] text-ink/75 mb-3 leading-relaxed">
                        <Link href={`/profile/${actorUsername}`} className="text-ink font-medium hover:text-gold transition-colors">
                          {actorName}
                        </Link>
                        {' '}{verb}
                        {meta?.collectionName && (
                          <span className="text-muted"> — {meta.collectionName}</span>
                        )}
                      </div>

                      {event.listing && (
                        <Link
                          href={`/watch/${event.listing.id}`}
                          className="flex gap-3.5 group"
                        >
                          <div className="w-[52px] h-[52px] rounded flex-shrink-0 bg-parchment overflow-hidden relative border border-[var(--border)]">
                            {event.listing.images?.[0] ? (
                              <Image
                                src={event.listing.images[0].url}
                                alt={event.listing.sourceTitle}
                                fill
                                sizes="52px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-6 h-6 rounded-full border border-ink/10" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex flex-col justify-center">
                            <div className="font-mono text-[9px] tracking-[0.12em] uppercase text-gold/80 mb-0.5">{event.listing.brand}</div>
                            <div className="font-serif text-[15px] text-ink truncate group-hover:text-gold transition-colors">{event.listing.model || event.listing.sourceTitle}</div>
                            <div className="text-[11px] text-muted mt-0.5">{event.listing.sourcePrice}</div>
                          </div>
                        </Link>
                      )}

                      <div className="font-mono text-[9px] text-muted/60 mt-3">{timeAgo(new Date(event.createdAt))}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <div className="space-y-8">

          {/* Shared taste */}
          {overlaps.some(o => (o.overlap.overlapCount ?? 0) > 0) && (
            <div>
              <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted mb-4">Shared taste</div>
              <div className="space-y-4">
                {overlaps.filter(o => (o.overlap.overlapCount ?? 0) > 0).map(({ friend, overlap }) => (
                  <div key={friend.id} className="flex items-start gap-3">
                    <Avatar name={friend.profile?.displayName ?? friend.name} size={26} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-ink leading-snug">
                        <span className="font-medium">{friend.profile?.displayName ?? friend.name}</span>
                        {' '}— {overlap.sharedBrands.slice(0, 2).join(', ')}
                        {overlap.sharedStyles.length > 0 && `, ${overlap.sharedStyles[0]}`}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-gold flex-shrink-0">{overlap.score}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* What your circle's into */}
          {trendingBrands.length > 0 && (
            <div>
              <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted mb-4">What your circle's into</div>
              <div className="space-y-2">
                {trendingBrands.map((b, i) => (
                  <Link
                    key={b.brand}
                    href={`/browse?brand=${encodeURIComponent(b.brand)}`}
                    className="flex items-center gap-3 py-1 hover:text-gold transition-colors group"
                  >
                    <span className="font-mono text-[9px] text-muted/50 w-4 text-right">{i + 1}</span>
                    <span className="flex-1 text-[13px] text-ink group-hover:text-gold transition-colors">{b.brand}</span>
                    <span className="text-[10px] text-muted/60">{b._count.brand}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Worth following */}
          {suggestedUsers.length > 0 && (
            <div>
              <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted mb-4">Worth following</div>
              <div className="space-y-4">
                {suggestedUsers.map(user => (
                  <div key={user.id} className="flex items-center gap-3">
                    <Avatar name={user.profile?.displayName ?? user.name} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-ink truncate">
                        {user.profile?.displayName ?? user.name}
                      </div>
                      {user.profile?.tasteTags?.slice(0, 2).length ? (
                        <div className="text-[10px] text-muted truncate">
                          {user.profile.tasteTags.slice(0, 2).join(', ')}
                        </div>
                      ) : null}
                    </div>
                    <form action={`/api/follow/${user.id}`} method="POST">
                      <button
                        type="submit"
                        className="font-mono text-[9px] tracking-[0.1em] uppercase px-2.5 py-1 border border-[var(--border)] rounded hover:border-gold hover:text-gold text-muted/70 transition-colors"
                      >
                        Follow
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Following */}
          {following.length > 0 && (
            <div>
              <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted mb-4">
                Following ({following.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {following.map(f => (
                  <Link
                    key={f.followingId}
                    href={`/profile/${f.following.profile?.username}`}
                    title={f.following.profile?.displayName ?? f.following.name ?? ''}
                  >
                    <Avatar name={f.following.profile?.displayName ?? f.following.name} size={30} />
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
