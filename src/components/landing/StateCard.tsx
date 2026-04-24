// src/components/landing/StateCard.tsx
// Authenticated homepage top module. The ONE component that owns the
// "what should this user do next" decision. Three variants:
//
//   empty-roll    — no saves. Get them into their first save.
//   build-roll    — has saves, thin/quiet circle. Deepen the roll, find people.
//   active-circle — has saves AND recent feed activity. Show the circle moving.
//
// Variant selection lives in lib/landing/home-state.ts — this file only renders.

import Link from 'next/link';
import Image from 'next/image';
import type { HomeVariant } from '@/lib/landing/home-state';
import { formatPrice, timeAgo } from '@/lib/format';

interface StateCardProps {
  variant: HomeVariant;
  displayName: string;
  savedCount: number;
  followingCount: number;
  recentCircleEvents: any[];
}

const FEED_VERB: Record<string, string> = {
  LIKED: 'liked',
  SAVED: 'saved',
  OWNED: 'owns',
  PURCHASED: 'bought',
  INFLUENCED_PURCHASE: 'bought after you saved it',
  FOLLOWED: 'started following someone',
  ADDED_TO_COLLECTION: 'added to their roll',
};

// Hand-picked starter chips for first-time users. Cheaper than a groupBy query
// and more curated than whatever popularity happens to say today.
const STARTER_BRANDS = [
  'Rolex',
  'Omega',
  'Patek Philippe',
  'Tudor',
  'Cartier',
  'A. Lange & Söhne',
] as const;

export function StateCard(props: StateCardProps) {
  switch (props.variant) {
    case 'empty-roll':
      return <EmptyRollCard {...props} />;
    case 'build-roll':
      return <BuildRollCard {...props} />;
    case 'active-circle':
      return <ActiveCircleCard {...props} />;
  }
}

function CardShell({
  eyebrow,
  headline,
  subhead,
  primary,
  secondary,
  children,
}: {
  eyebrow: string;
  headline: string;
  subhead: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <section className="px-4 sm:px-8 pt-6 sm:pt-10 max-w-[1200px] mx-auto">
      <div className="rounded-xl bg-ink text-cream px-5 sm:px-8 py-7 sm:py-10 border border-[var(--border)]">
        <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-gold/80 mb-3">
          {eyebrow}
        </div>
        <h1 className="text-[1.8rem] sm:text-[2.4rem] font-semibold tracking-[-0.03em] leading-[1.05] mb-3">
          {headline}
        </h1>
        <p className="text-[13px] sm:text-[14px] text-cream/60 max-w-[520px] leading-relaxed mb-6">
          {subhead}
        </p>
        <div className="flex flex-wrap gap-3 mb-0">
          <Link
            href={primary.href}
            className="bg-gold text-black text-[11px] font-bold tracking-[0.1em] uppercase px-6 py-3 rounded hover:bg-gold-dark transition-colors"
          >
            {primary.label}
          </Link>
          {secondary && (
            <Link
              href={secondary.href}
              className="border border-white/15 text-cream/75 text-[11px] font-medium tracking-[0.1em] uppercase px-6 py-3 rounded hover:border-gold/60 hover:text-gold transition-colors"
            >
              {secondary.label}
            </Link>
          )}
        </div>
        {children && <div className="mt-7 pt-7 border-t border-white/[0.08]">{children}</div>}
      </div>
    </section>
  );
}

// ─── Variant A: empty-roll ────────────────────────────────────────────────────
// No saves yet. Prime action is "save your first watch" — browsing is the only
// path to that action, so Browse is the primary CTA.

function EmptyRollCard({ displayName }: StateCardProps) {
  const firstName = displayName.split(/\s+/)[0] ?? displayName;
  return (
    <CardShell
      eyebrow={`Welcome, ${firstName}`}
      headline="Start your roll."
      subhead="Your WatchRoll is empty. Pick a brand to start browsing, or jump into the full inventory — one tap saves a watch to your roll."
      primary={{ href: '/browse', label: 'Browse watches' }}
      secondary={{ href: '/friends?tab=people', label: 'Find collectors' }}
    >
      <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-cream/40 mb-3">
        Start with a brand
      </div>
      <div className="flex flex-wrap gap-2">
        {STARTER_BRANDS.map(brand => (
          <Link
            key={brand}
            href={`/browse?brand=${encodeURIComponent(brand)}`}
            className="inline-flex items-center px-3.5 py-1.5 border border-white/15 rounded-full text-[12px] text-cream/80 hover:border-gold/60 hover:text-gold transition-colors"
          >
            {brand}
          </Link>
        ))}
      </div>
    </CardShell>
  );
}

// ─── Variant B: build-roll ────────────────────────────────────────────────────
// Has saves but no active social signal. Deepen the roll, pull them into the
// social graph. Numbers (saved / following) act as a status dashboard.

function BuildRollCard({ savedCount, followingCount }: StateCardProps) {
  return (
    <CardShell
      eyebrow="Your roll"
      headline="Keep building your roll."
      subhead={
        followingCount === 0
          ? 'You\'ve saved a few. Next: find some collectors to follow — the good stuff is easier to spot with a circle.'
          : 'Your circle has been quiet. Add more watches to your roll, or find more collectors to follow.'
      }
      primary={{ href: '/browse', label: 'Browse more' }}
      secondary={{ href: '/friends?tab=people', label: 'Find friends' }}
    >
      <div className="grid grid-cols-2 gap-6 sm:gap-10">
        <Stat label="In your roll" value={savedCount} href="/roll" />
        <Stat label="Following" value={followingCount} href="/friends" />
      </div>
    </CardShell>
  );
}

// ─── Variant C: active-circle ────────────────────────────────────────────────
// Saves + recent feed events. Lead with momentum: show the circle moving, but
// keep it to a preview — the full feed lives at /friends.

function ActiveCircleCard({ recentCircleEvents }: StateCardProps) {
  return (
    <CardShell
      eyebrow="From your circle"
      headline="Your circle is moving."
      subhead="Recent saves and buys from collectors you follow. Tap through for the full feed — or browse something new."
      primary={{ href: '/friends', label: 'View activity' }}
      secondary={{ href: '/browse?sort=newest', label: 'Browse fresh' }}
    >
      <div className="space-y-3">
        {recentCircleEvents.slice(0, 3).map((event: any) => (
          <CircleEventRow key={event.id} event={event} />
        ))}
      </div>
    </CardShell>
  );
}

// Note: actor and listing are rendered as sibling links, not nested.
// Nested <a> is invalid HTML; inline event handlers in Server Components
// cross the server→client boundary as functions (not allowed in RSC).
function CircleEventRow({ event }: { event: any }) {
  const actorName = event.actor.profile?.displayName ?? event.actor.name ?? 'Someone';
  const actorUsername = event.actor.profile?.username;
  const verb = FEED_VERB[event.type] ?? event.type.toLowerCase();
  const initials = actorName.slice(0, 2).toUpperCase();
  const hue = (initials.charCodeAt(0) * 37 + (initials.charCodeAt(1) || 0) * 13) % 360;

  return (
    <div className="flex items-center gap-3 py-2">
      <Link
        href={actorUsername ? `/profile/${actorUsername}` : '/friends'}
        className="flex items-center gap-3 min-w-0 flex-1 group"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 font-medium text-[10px] flex-shrink-0"
          style={{ background: `hsl(${hue}, 18%, 30%)` }}
          aria-hidden
        >
          {initials}
        </div>
        <div className="w-10 h-10 rounded flex-shrink-0 bg-[#222] overflow-hidden relative border border-white/[0.08]">
          {event.listing?.images?.[0] ? (
            <Image
              src={event.listing.images[0].url}
              alt={event.listing.sourceTitle ?? ''}
              fill sizes="40px"
              className="object-cover"
            />
          ) : null}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-cream/60 truncate">
            <span className="text-cream font-medium group-hover:text-gold transition-colors">
              {actorName}
            </span>
            {' '}{verb}
          </div>
          <div className="text-[12px] text-cream/80 truncate">
            <span className="text-gold/70 font-mono text-[9px] tracking-[0.1em] uppercase mr-1.5">
              {event.listing?.brand}
            </span>
            {event.listing?.model || event.listing?.sourceTitle}
          </div>
        </div>
      </Link>
      <Link
        href={event.listing ? `/watch/${event.listing.id}` : '/friends'}
        className="flex flex-col items-end flex-shrink-0 gap-0.5 hover:text-gold transition-colors"
      >
        <div className="text-[11px] text-cream/70">
          {formatPrice(event.listing?.price ?? null, event.listing?.currency ?? 'USD')}
        </div>
        <div className="font-mono text-[9px] text-cream/35">
          {timeAgo(new Date(event.createdAt))}
        </div>
      </Link>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="group block">
      <div className="text-[1.8rem] sm:text-[2rem] font-semibold tracking-[-0.02em] group-hover:text-gold transition-colors">
        {value.toLocaleString()}
      </div>
      <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-cream/50 mt-1">
        {label}
      </div>
    </Link>
  );
}
