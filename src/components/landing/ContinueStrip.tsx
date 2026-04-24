// src/components/landing/ContinueStrip.tsx
// Compact "pick up where you left off" module for authenticated users.
//
// Intentionally NOT a row of WatchCards — the homepage is not an inventory
// surface. This renders a tight 3-row list with small thumbnails and text,
// aligned with the circle-activity preview style. Users who want the full
// grid of their saved watches go to /roll.
import Link from 'next/link';
import Image from 'next/image';
import { getRecentlySavedListings } from '@/lib/watches/queries';
import { formatPrice } from '@/lib/format';

const MAX_ROWS = 3;

export async function ContinueStrip({ userId }: { userId: string }) {
  let listings;
  try {
    listings = await getRecentlySavedListings(userId, MAX_ROWS);
  } catch (err) {
    console.error('[ContinueStrip] query failed', err);
    return null;
  }
  if (listings.length < 1) return null;

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
        <div className="border-t border-[var(--border)]" />
      </div>
      <section className="px-4 sm:px-8 py-6 sm:py-10 max-w-[1200px] mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted mb-1">
              Pick up where you left off
            </div>
            <h2 className="text-[1.05rem] sm:text-[1.15rem] font-semibold tracking-[-0.02em]">
              Recent saves
            </h2>
          </div>
          <Link
            href="/roll"
            className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted hover:text-gold transition-colors whitespace-nowrap ml-4"
          >
            View roll →
          </Link>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {listings.map(listing => (
            <SaveRow key={listing.id} listing={listing} />
          ))}
        </div>
      </section>
    </>
  );
}

function SaveRow({ listing }: { listing: any }) {
  return (
    <Link
      href={`/watch/${listing.id}`}
      className="flex items-center gap-3 py-3 group"
    >
      <div className="w-11 h-11 rounded flex-shrink-0 bg-[#1A1A1A] overflow-hidden relative border border-[var(--border)]">
        {listing.images?.[0] ? (
          <Image
            src={listing.images[0].url}
            alt={listing.sourceTitle ?? ''}
            fill sizes="44px"
            className="object-cover"
          />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[9px] tracking-[0.12em] uppercase text-gold/75 mb-0.5">
          {listing.brand}
        </div>
        <div className="text-[13px] font-medium text-ink truncate group-hover:text-gold transition-colors">
          {listing.model || listing.sourceTitle}
        </div>
      </div>
      <div className="text-[12px] text-muted flex-shrink-0">
        {formatPrice(listing.price, listing.currency)}
      </div>
      <span className="text-muted/60 text-[16px] flex-shrink-0 leading-none">›</span>
    </Link>
  );
}
