// src/components/landing/CircleActivityPreview.tsx
// Small (<=3 items) circle activity preview for the authenticated homepage.
// Used when the user has saves + a circle but the circle is quiet — so the
// top card is the build-roll variant and we surface any recent events here
// as a secondary tease rather than inside the hero.
//
// For the active-circle variant, recent events are rendered inside StateCard
// and this component returns null to avoid duplication.
import Link from 'next/link';
import Image from 'next/image';
import { formatPrice, timeAgo } from '@/lib/format';

const FEED_VERB: Record<string, string> = {
  LIKED: 'liked',
  SAVED: 'saved',
  OWNED: 'owns',
  PURCHASED: 'bought',
  INFLUENCED_PURCHASE: 'bought after you saved it',
  FOLLOWED: 'started following someone',
  ADDED_TO_COLLECTION: 'added to their roll',
};

export function CircleActivityPreview({
  events,
  followingCount,
}: {
  events: any[];
  followingCount: number;
}) {
  // If the circle is entirely empty, this module stays silent — the top card
  // already routes the user toward finding people.
  if (followingCount === 0) return null;

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
        <div className="border-t border-[var(--border)]" />
      </div>
      <section className="px-4 sm:px-8 py-6 sm:py-10 max-w-[1200px] mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted mb-1">
              From your circle
            </div>
            <h2 className="text-[1.05rem] sm:text-[1.15rem] font-semibold tracking-[-0.02em]">
              {events.length ? 'Recent activity' : 'Quiet in your circle'}
            </h2>
          </div>
          <Link
            href="/friends"
            className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted hover:text-gold transition-colors whitespace-nowrap ml-4"
          >
            All activity →
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="py-6 border border-dashed border-[var(--border)] rounded-lg text-center">
            <p className="text-[13px] text-muted max-w-[320px] mx-auto leading-relaxed mb-3">
              No new saves from your circle lately. Add a few more collectors to keep the feed moving.
            </p>
            <Link
              href="/friends?tab=people"
              className="font-mono text-[10px] tracking-[0.1em] uppercase text-gold hover:text-gold-dark transition-colors"
            >
              Find collectors →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {events.slice(0, 3).map((event: any) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function EventRow({ event }: { event: any }) {
  const actorName = event.actor.profile?.displayName ?? event.actor.name ?? 'Someone';
  const actorUsername = event.actor.profile?.username;
  const verb = FEED_VERB[event.type] ?? event.type.toLowerCase();
  const initials = actorName.slice(0, 2).toUpperCase();
  const hue = (initials.charCodeAt(0) * 37 + (initials.charCodeAt(1) || 0) * 13) % 360;

  return (
    <div className="py-3">
      <Link
        href={actorUsername ? `/profile/${actorUsername}` : '/friends'}
        className="flex items-center gap-2 mb-1.5 group/actor"
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white/75 font-medium text-[9px] flex-shrink-0"
          style={{ background: `hsl(${hue}, 18%, 24%)` }}
          aria-hidden
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-[12px] text-ink/60 truncate">
          <span className="text-ink font-medium group-hover/actor:text-gold transition-colors">
            {actorName}
          </span>
          {' '}{verb}
        </div>
        <span className="font-mono text-[9px] text-muted/60 flex-shrink-0">
          {timeAgo(new Date(event.createdAt))}
        </span>
      </Link>
      {event.listing && (
        <Link
          href={`/watch/${event.listing.id}`}
          className="flex gap-3 bg-parchment border border-[var(--border)] rounded-lg p-3 group"
        >
          <div className="w-14 h-14 rounded flex-shrink-0 bg-[#1A1A1A] overflow-hidden relative border border-[var(--border)]">
            {event.listing.images?.[0] ? (
              <Image
                src={event.listing.images[0].url}
                alt={event.listing.sourceTitle}
                fill sizes="56px"
                className="object-cover"
              />
            ) : null}
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
      )}
    </div>
  );
}
