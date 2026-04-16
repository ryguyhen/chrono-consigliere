// src/app/page.tsx
//
// Route structure decision: `/` serves both public and authenticated surfaces.
// This is the established app pattern (Instagram, Twitter, etc.) — the root IS
// the authenticated home. Adding a /home redirect would add a round-trip on
// every cold load and require session-aware hrefs in the static Nav component.
//
// The two render paths share zero code — an early return for auth users
// means no marketing data is fetched and no acquisition copy is rendered.
import Link from 'next/link';
import Image from 'next/image';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { getEngagedListings, getNewArrivals, getWeeklyTrending } from '@/lib/watches/queries';
import { getFeedForUser } from '@/lib/social/feed-service';
import { WatchCard } from '@/components/watches/WatchCard';
import { getActiveDealers, getPublicLandingStats } from '@/lib/landing/public-stats';
import { Suspense } from 'react';
import { formatPrice, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

const MIN_ENGAGED = 3;

const FEED_VERB: Record<string, string> = {
  LIKED: 'liked',
  SAVED: 'saved',
  OWNED: 'owns',
  PURCHASED: 'bought',
  INFLUENCED_PURCHASE: 'bought after you saved it',
  FOLLOWED: 'is now following someone',
  ADDED_TO_COLLECTION: 'added to their roll',
};

export default async function RootPage() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    // ── Authenticated home ──────────────────────────────────────────────────
    // Purpose-built for an existing collector. No marketing copy, no global
    // popularity signals — personalized circle activity first, then discovery.
    return (
      <div>
        <Suspense fallback={<CircleSectionSkeleton />}>
          <CircleSection userId={session.user.id} />
        </Suspense>
        <Suspense fallback={null}>
          <PopularSection userId={session.user.id} />
        </Suspense>
        <Suspense fallback={null}>
          <NewInPreview />
        </Suspense>
      </div>
    );
  }

  // ── Public landing page ───────────────────────────────────────────────────
  // Marketing data only fetched for unauthenticated visitors.
  const [{ inStockWatchCount, curatedDealerCount }, dealers] = await Promise.all([
    getPublicLandingStats(),
    getActiveDealers(),
  ]);

  return (
    <div>
      {/* HERO */}
      <section className="bg-black text-white px-5 sm:px-8 py-14 sm:py-20 md:py-28 border-b border-white/[0.06]">
        <div className="max-w-[560px] mx-auto text-center">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/35 mb-6 sm:mb-8">
            Presented by Chrono Consigliere
          </p>
          <h1 className="text-[clamp(2.6rem,10vw,5.5rem)] font-semibold leading-[1.0] mb-4 sm:mb-5 tracking-[-0.04em]">
            Start your roll.
          </h1>
          <p className="text-[14px] sm:text-[15px] text-white/50 max-w-[420px] mx-auto mb-8 sm:mb-10 leading-relaxed font-normal">
            Build your watch box, follow your friends, and keep up with what&apos;s good.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/register"
              className="bg-gold text-black text-[11px] font-bold tracking-[0.1em] uppercase px-6 py-3.5 rounded hover:bg-gold-dark transition-colors"
            >
              Start here
            </Link>
            <Link
              href="/browse"
              className="border border-white/15 text-white/60 text-[11px] font-medium tracking-[0.1em] uppercase px-6 py-3.5 rounded hover:border-gold/60 hover:text-gold transition-colors"
            >
              Browse
            </Link>
          </div>
          <div className="flex justify-center gap-10 sm:gap-16 mt-12 sm:mt-20 pt-8 border-t border-white/[0.07]">
            {[
              [inStockWatchCount.toLocaleString(), 'In-stock watches'],
              [curatedDealerCount.toString(), 'Curated dealers'],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="text-[1.8rem] sm:text-[2.2rem] font-semibold text-white tracking-[-0.03em]">{n}</div>
                <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-white/30 mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DealersSection dealers={dealers} />

      <Suspense fallback={null}>
        <EngagedSection />
      </Suspense>
      <Suspense fallback={null}>
        <NewInSection />
      </Suspense>
    </div>
  );
}

// ─── Authenticated: circle activity ───────────────────────────────────────────
// Shows recent feed events from people the collector follows.
// Empty state nudges them to find people — discovery as a CTA, not just copy.

function CircleSectionSkeleton() {
  return (
    <div className="px-4 sm:px-8 py-6 sm:py-10 max-w-[1200px] mx-auto">
      <div className="h-6 w-40 bg-ink/5 rounded mb-5" />
      <div className="space-y-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-parchment rounded-lg p-3 flex gap-3">
            <div className="w-14 h-14 rounded bg-ink/5 flex-shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 w-32 bg-ink/5 rounded" />
              <div className="h-4 w-48 bg-ink/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function CircleSection({ userId }: { userId: string }) {
  // Fetch 20 to improve odds of surfacing 3 listing events from a quiet circle.
  const { events: allEvents } = await getFeedForUser(userId, undefined, 20);
  const events = allEvents.filter((e: any) => e.listing).slice(0, 3);

  // True empty: no circle at all — different from "circle exists, just quiet".
  if (allEvents.length === 0) {
    return (
      <section className="px-4 sm:px-8 py-6 sm:py-10 max-w-[1200px] mx-auto">
        <h2 className="text-[1.1rem] font-semibold tracking-[-0.02em] mb-4">
          From your circle
        </h2>
        <div className="py-10 text-center border border-dashed border-[var(--border)] rounded-lg">
          <div className="text-3xl mb-4 opacity-10">◈</div>
          <div className="text-[1rem] font-semibold mb-2">Nobody in your circle yet</div>
          <p className="text-[13px] text-muted mb-6 max-w-[280px] mx-auto leading-relaxed">
            Follow collectors to see what they're saving and buying.
          </p>
          <Link
            href="/friends?tab=people"
            className="inline-block font-mono text-[10px] tracking-[0.12em] uppercase px-5 py-2.5 bg-gold text-black rounded font-bold hover:bg-gold-dark transition-colors"
          >
            Find collectors
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 sm:px-8 py-6 sm:py-10 max-w-[1200px] mx-auto">
      {/* Header with freshness signal — shows age of most recent event */}
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="text-[1.1rem] font-semibold tracking-[-0.02em]">
          From your circle
        </h2>
        {events.length > 0 && (
          <span className="font-mono text-[9px] tracking-[0.08em] text-muted/60">
            {timeAgo(new Date(events[0].createdAt))}
          </span>
        )}
      </div>

      {events.length === 0 ? (
        // Circle exists but no listing events recently
        <div className="py-8 text-center border border-dashed border-[var(--border)] rounded-lg">
          <div className="text-[0.95rem] font-semibold mb-1.5">Your circle's been quiet</div>
          <p className="text-[13px] text-muted mb-4 max-w-[260px] mx-auto leading-relaxed">
            No new saves from your circle recently.
          </p>
          <Link
            href="/friends"
            className="font-mono text-[10px] tracking-[0.1em] uppercase text-gold hover:text-gold-dark transition-colors"
          >
            See all activity →
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-4 mb-3">
            {events.map((event: any) => {
              const actorName = event.actor.profile?.displayName ?? event.actor.name ?? 'Someone';
              const actorUsername = event.actor.profile?.username;
              const verb = FEED_VERB[event.type] ?? event.type.toLowerCase();
              const initials = actorName.slice(0, 2).toUpperCase();
              const hue = (initials.charCodeAt(0) * 37 + (initials.charCodeAt(1) || 0) * 13) % 360;

              return (
                <div key={event.id}>
                  {/* Single link covering the whole actor row — 40px min-height for touch */}
                  <Link
                    href={`/profile/${actorUsername}`}
                    className="flex items-center gap-2 mb-1.5 min-h-[40px] group/actor"
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 font-medium text-[9px] flex-shrink-0"
                      style={{ background: `hsl(${hue}, 18%, 22%)` }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0 text-[12px] text-ink/60 truncate">
                      <span className="text-ink font-medium group-hover/actor:text-gold transition-colors">
                        {actorName}
                      </span>
                      {' '}{verb}
                    </div>
                    <span className="font-mono text-[9px] text-muted/50 flex-shrink-0">
                      {timeAgo(new Date(event.createdAt))}
                    </span>
                  </Link>
                  {/* Listing card — explicit border ensures contrast across themes */}
                  <Link href={`/watch/${event.listing.id}`} className="flex gap-3 bg-parchment border border-[var(--border)] rounded-lg p-3 group">
                    <div className="w-14 h-14 rounded flex-shrink-0 bg-[#1A1A1A] overflow-hidden relative border border-[var(--border)]">
                      {event.listing.images?.[0] ? (
                        <Image
                          src={event.listing.images[0].url}
                          alt={event.listing.sourceTitle}
                          fill sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-5 h-5 rounded-full border border-white/10" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex flex-col justify-center flex-1">
                      <div className="font-mono text-[9px] tracking-[0.1em] uppercase text-gold/75 mb-0.5">
                        {event.listing.brand}
                      </div>
                      <div className="text-[13px] font-medium text-ink truncate group-hover:text-gold transition-colors">
                        {event.listing.model || event.listing.sourceTitle}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {formatPrice(event.listing.price, event.listing.currency)}
                      </div>
                    </div>
                    <span className="text-muted/60 text-[18px] flex items-center flex-shrink-0">›</span>
                  </Link>
                </div>
              );
            })}
          </div>
          {/* Full-width drill-down — min-h-[44px] for touch */}
          <Link
            href="/friends"
            className="flex items-center justify-between w-full min-h-[44px] py-3.5 text-[12px] text-muted hover:text-gold transition-colors border-t border-[var(--border)]"
          >
            <span>All activity from your circle</span>
            <span className="text-[16px] leading-none">›</span>
          </Link>
        </>
      )}
    </section>
  );
}

// ─── Authenticated: new arrivals strip ────────────────────────────────────────
// Horizontal scroll strip — feels native, doesn't compete with the feed above.
// Uses WatchCard inside fixed-width wrappers so the grid layout is overridden.

async function NewInPreview() {
  const listings = await getNewArrivals(6);
  if (!listings.length) return null;

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
        <div className="border-t border-[var(--border)]" />
      </div>
      <section className="py-6 sm:py-8 max-w-[1200px] mx-auto">
        <div className="flex justify-between items-center px-4 sm:px-8 mb-4">
          <h2 className="text-[1.1rem] font-semibold tracking-[-0.02em]">New in</h2>
          <Link
            href="/browse?sort=newest"
            className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted hover:text-gold transition-colors"
          >
            Browse all →
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto px-4 sm:px-8 pb-3 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {listings.map(watch => (
            <div key={watch.id} className="w-[155px] sm:w-[175px] flex-shrink-0">
              <WatchCard watch={watch} />
            </div>
          ))}
          {/* Trailing spacer — overflow-x-auto clips end padding in most mobile browsers */}
          <div className="w-4 sm:w-8 flex-shrink-0" />
        </div>
      </section>
    </>
  );
}

// ─── Authenticated: trending strip ───────────────────────────────────────────
// Weekly-windowed popularity signal. Sits between the social feed (personal) and
// New In (inventory freshness) — answers "what are collectors into right now?"
// Falls back to all-time engaged when the 7-day window is thin.

async function PopularSection({ userId }: { userId: string }) {
  const listings = await getWeeklyTrending(6, userId);
  if (listings.length < 3) return null;

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
        <div className="border-t border-[var(--border)]" />
      </div>
      <section className="py-6 sm:py-8 max-w-[1200px] mx-auto">
        <div className="flex justify-between items-center px-4 sm:px-8 mb-4">
          <h2 className="text-[1.1rem] font-semibold tracking-[-0.02em]">Popular this week</h2>
          <Link
            href="/browse?sort=most-liked"
            className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted hover:text-gold transition-colors"
          >
            See all →
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto px-4 sm:px-8 pb-3 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {listings.map(watch => (
            <div key={watch.id} className="w-[155px] sm:w-[175px] flex-shrink-0">
              <WatchCard watch={watch} />
            </div>
          ))}
          <div className="w-4 sm:w-8 flex-shrink-0" />
        </div>
      </section>
    </>
  );
}

// ─── Public sections (used on the unauthenticated landing only) ───────────────

// Curated dealers — flex-wrap chip list linking into filtered browse results.
// No logos (none available). Ordered by listing count so the most-stocked
// dealers appear first. Automatically reflects active dealer sources in the DB.

function DealersSection({ dealers }: { dealers: { name: string; slug: string }[] }) {
  if (!dealers.length) return null;

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
        <div className="border-t border-[var(--border)]" />
      </div>
      <section className="px-4 sm:px-8 py-10 sm:py-14 max-w-[1200px] mx-auto">
        <div className="flex justify-between items-end mb-5 sm:mb-7">
          <div>
            <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted mb-1.5 sm:mb-2">
              Our sources
            </div>
            <h2 className="text-[1.3rem] sm:text-[1.6rem] font-semibold tracking-[-0.02em]">
              Curated dealers
            </h2>
          </div>
          <Link
            href="/browse"
            className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted hover:text-gold transition-colors whitespace-nowrap ml-4"
          >
            Browse all →
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {dealers.map((dealer) => (
            <Link
              key={dealer.slug}
              href={`/browse?dealer=${dealer.slug}`}
              className="inline-flex items-center px-3.5 py-1.5 border border-[var(--border)] rounded text-[12px] sm:text-[13px] text-ink/60 hover:border-gold/40 hover:text-gold transition-colors whitespace-nowrap"
            >
              {dealer.name}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

async function EngagedSection() {
  const listings = await getEngagedListings(6);
  if (listings.length < MIN_ENGAGED) return null;

  return (
    <section className="px-4 sm:px-8 py-10 sm:py-14 max-w-[1200px] mx-auto">
      <div className="flex justify-between items-end mb-5 sm:mb-8">
        <div>
          <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted mb-1.5 sm:mb-2">
            Most saved
          </div>
          <h2 className="text-[1.3rem] sm:text-[1.6rem] font-semibold tracking-[-0.02em]">
            Popular right now
          </h2>
        </div>
        <Link
          href="/browse?sort=most-liked"
          className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted hover:text-gold transition-colors whitespace-nowrap ml-4"
        >
          See all →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-5">
        {listings.map(watch => (
          <WatchCard key={watch.id} watch={watch} />
        ))}
      </div>
    </section>
  );
}

// ─── Shared section (both render paths) ───────────────────────────────────────

async function NewInSection() {
  const listings = await getNewArrivals(8);
  if (!listings.length) return null;

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
        <div className="border-t border-[var(--border)]" />
      </div>
      <section className="px-4 sm:px-8 py-10 sm:py-14 max-w-[1200px] mx-auto">
        <div className="flex justify-between items-end mb-5 sm:mb-8">
          <div>
            <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted mb-1.5 sm:mb-2">
              Just dropped
            </div>
            <h2 className="text-[1.3rem] sm:text-[1.6rem] font-semibold tracking-[-0.02em]">
              New in
            </h2>
          </div>
          <Link
            href="/browse?sort=newest"
            className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted hover:text-gold transition-colors whitespace-nowrap ml-4"
          >
            See all →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-5">
          {listings.map(watch => (
            <WatchCard key={watch.id} watch={watch} />
          ))}
        </div>
      </section>
    </>
  );
}
