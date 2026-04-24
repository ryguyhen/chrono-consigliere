// src/components/landing/ContinueStrip.tsx
// Horizontal scroll strip of the user's most recently saved watches.
// Lets authenticated users pick up where they left off. Renders nothing when
// the user has no saves — empty-roll state handles that case via the top card.
import Link from 'next/link';
import { WatchCard } from '@/components/watches/WatchCard';
import { getRecentlySavedListings } from '@/lib/watches/queries';

export async function ContinueStrip({ userId }: { userId: string }) {
  const listings = await getRecentlySavedListings(userId, 8);
  if (listings.length < 2) return null;

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
        <div className="border-t border-[var(--border)]" />
      </div>
      <section className="py-6 sm:py-8 max-w-[1200px] mx-auto">
        <div className="flex justify-between items-baseline px-4 sm:px-8 mb-4">
          <div>
            <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted mb-1">
              Pick up where you left off
            </div>
            <h2 className="text-[1.05rem] sm:text-[1.15rem] font-semibold tracking-[-0.02em]">
              Your recent saves
            </h2>
          </div>
          <Link
            href="/roll"
            className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted hover:text-gold transition-colors whitespace-nowrap ml-4"
          >
            View roll →
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto px-4 sm:px-8 pb-3 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {listings.map(watch => (
            <div key={watch.id} className="w-[155px] sm:w-[175px] flex-shrink-0">
              <WatchCard watch={watch} />
            </div>
          ))}
          <div className="w-4 sm:w-8 flex-shrink-0" aria-hidden />
        </div>
      </section>
    </>
  );
}
