// src/app/friends/page.tsx
// Social hub: activity feed + people discovery + taste overlap + following
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { prisma } from '@/lib/db';
import { getFeedForUser, getTasteOverlap } from '@/lib/social/feed-service';
import Link from 'next/link';
import Image from 'next/image';
import PeopleSearch from './PeopleSearch';

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

const EVENT_COPY: Record<string, string> = {
  LIKED: 'liked',
  SAVED: 'added to favorites',
  OWNED: 'marked as owned',
  PURCHASED: 'bought',
  INFLUENCED_PURCHASE: 'bought something in your roll',
  FOLLOWED: 'is now following',
  ADDED_TO_COLLECTION: 'added to',
};

function Avatar({ name, size = 34 }: { name: string | null; size?: number }) {
  const initials = (name ?? 'U').slice(0, 2).toUpperCase();
  const hue = (initials.charCodeAt(0) * 37 + (initials.charCodeAt(1) || 0) * 13) % 360;
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-medium text-white/70"
      style={{ width: size, height: size, fontSize: size * 0.32, background: `hsl(${hue}, 18%, 22%)` }}
    >
      {initials}
    </div>
  );
}

export default async function FriendsPage() {
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
      take: 6,
    }),
  ]);

  const trendingBrands = await prisma.watchListing.groupBy({
    by: ['brand'],
    where: {
      isAvailable: true,
      likes: { some: { userId: { in: following.map((f: any) => f.followingId) } } },
    },
    _count: { brand: true },
    orderBy: { _count: { brand: 'desc' } },
    take: 6,
  });

  const overlaps = await Promise.all(
    following.slice(0, 3).map(async (f: any) => ({
      friend: f.following,
      overlap: await getTasteOverlap(userId, f.followingId),
    }))
  );

  // Shape suggested users for the client component
  const initialSuggested = suggestedUsers.map((u: any) => ({
    id: u.id,
    username: u.profile?.username ?? u.id,
    displayName: u.profile?.displayName ?? u.name ?? null,
    tasteTags: u.profile?.tasteTags ?? [],
    isFollowing: false,
    followerCount: 0,
  }));

  return (
    <div>
      {/* Header */}
      <div className="bg-black border-b border-white/[0.07] px-4 sm:px-6 py-5 sm:py-7">
        <div className="max-w-[1040px] mx-auto">
          <h1 className="text-[1.5rem] sm:text-[1.8rem] font-semibold tracking-[-0.03em]">Friends</h1>
        </div>
      </div>

      <div className="max-w-[1040px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8 lg:gap-12">

          {/* Main column: activity feed */}
          <div>
            {feedEvents.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-3xl mb-5 opacity-15">◈</div>
                <div className="text-[1.1rem] font-semibold mb-2">Nothing yet</div>
                <p className="text-[13px] text-muted mb-1">Follow people to see what they're saving.</p>
                <p className="text-[13px] text-muted mb-0">Use the search below to find people.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {feedEvents.map((event: any) => {
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
                          <Link href={`/watch/${event.listing.id}`} className="flex gap-3 group">
                            <div className="w-[52px] h-[52px] rounded flex-shrink-0 bg-[#1A1A1A] overflow-hidden relative border border-[var(--border)]">
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
                                  <div className="w-6 h-6 rounded-full border border-white/10" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex flex-col justify-center">
                              <div className="font-mono text-[9px] tracking-[0.12em] uppercase text-gold/80 mb-0.5">{event.listing.brand}</div>
                              <div className="text-[14px] font-medium text-ink truncate group-hover:text-gold transition-colors">{event.listing.model || event.listing.sourceTitle}</div>
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

          {/* Sidebar */}
          <div className="space-y-8">

            {/* People search */}
            <div>
              <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted mb-4">Find people</div>
              <PeopleSearch initialSuggested={initialSuggested} />
            </div>

            {overlaps.some((o: any) => (o.overlap.overlapCount ?? 0) > 0) && (
              <div>
                <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted mb-4">Shared taste</div>
                <div className="space-y-4">
                  {overlaps.filter((o: any) => (o.overlap.overlapCount ?? 0) > 0).map(({ friend, overlap }: any) => (
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

            {trendingBrands.length > 0 && (
              <div>
                <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted mb-4">What your circle's into</div>
                <div className="space-y-2">
                  {trendingBrands.map((b: any, i: number) => (
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

            {following.length > 0 && (
              <div>
                <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted mb-4">
                  Following ({following.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {following.map((f: any) => (
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
    </div>
  );
}
