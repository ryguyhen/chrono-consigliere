// src/lib/landing/home-state.ts
// Composes the user-state signal that drives the authenticated homepage top card.
// One server call → one variant decision. Keeps src/app/page.tsx thin.

import { prisma } from '@/lib/db';
import { getFeedForUser } from '@/lib/social/feed-service';

export type HomeVariant = 'empty-roll' | 'build-roll' | 'active-circle';

export type HomeState = {
  variant: HomeVariant;
  savedCount: number;
  followingCount: number;
  // Up to 3 recent circle events that have a listing attached — used inline by
  // the active-circle top card so we don't query the feed twice.
  recentCircleEvents: Awaited<ReturnType<typeof getFeedForUser>>['events'];
};

// A circle is considered "active" when there are at least ACTIVE_MIN_EVENTS
// feed events with a listing in the last ACTIVE_WINDOW_DAYS. Below that bar
// we show the build-roll variant instead, which has a clearer CTA shape.
const ACTIVE_MIN_EVENTS = 2;
const ACTIVE_WINDOW_DAYS = 14;

export async function getHomeState(userId: string): Promise<HomeState> {
  // Three independent queries. allSettled so a failure in any one of them
  // degrades the homepage gracefully — e.g. a feed outage still lets us
  // render the state card based on counts — instead of 500'ing the route.
  const [savedRes, followingRes, feedRes] = await Promise.allSettled([
    prisma.wishlistItem.count({ where: { userId, list: 'FAVORITES' } }),
    prisma.follow.count({ where: { followerId: userId } }),
    getFeedForUser(userId, undefined, 10),
  ]);

  if (savedRes.status === 'rejected') console.error('[home-state] savedCount failed', savedRes.reason);
  if (followingRes.status === 'rejected') console.error('[home-state] followingCount failed', followingRes.reason);
  if (feedRes.status === 'rejected') console.error('[home-state] feed failed', feedRes.reason);

  const savedCount = savedRes.status === 'fulfilled' ? savedRes.value : 0;
  const followingCount = followingRes.status === 'fulfilled' ? followingRes.value : 0;
  const feedEvents = feedRes.status === 'fulfilled' ? feedRes.value.events : [];

  const cutoff = Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentCircleEvents = feedEvents
    .filter(e => e.listing && new Date(e.createdAt).getTime() >= cutoff)
    .slice(0, 3);

  let variant: HomeVariant = 'empty-roll';
  if (savedCount > 0) {
    variant = recentCircleEvents.length >= ACTIVE_MIN_EVENTS ? 'active-circle' : 'build-roll';
  }

  return { variant, savedCount, followingCount, recentCircleEvents };
}
