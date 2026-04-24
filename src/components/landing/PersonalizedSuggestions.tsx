// src/components/landing/PersonalizedSuggestions.tsx
// Suggestions derived from the brands in the user's roll. Replaces the generic
// homepage "Popular right now" shelf with something actually personal.
// Renders nothing when the user has no saves (empty-roll has its own CTAs)
// or when there aren't enough unsaved matches in their top brands.
import Link from 'next/link';
import { WatchCard } from '@/components/watches/WatchCard';
import { getPersonalizedSuggestions } from '@/lib/watches/queries';

export async function PersonalizedSuggestions({ userId }: { userId: string }) {
  let listings;
  try {
    listings = await getPersonalizedSuggestions(userId, 6);
  } catch (err) {
    console.error('[PersonalizedSuggestions] query failed', err);
    return null;
  }
  if (listings.length < 3) return null;

  const brands = [...new Set(listings.slice(0, 3).map(l => l.brand))].slice(0, 2);
  const brandHint = brands.length ? `Based on ${brands.join(' and ')} in your roll` : 'Based on your roll';

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
        <div className="border-t border-[var(--border)]" />
      </div>
      <section className="py-6 sm:py-10 max-w-[1200px] mx-auto">
        <div className="flex justify-between items-baseline px-4 sm:px-8 mb-4">
          <div>
            <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted mb-1">
              {brandHint}
            </div>
            <h2 className="text-[1.05rem] sm:text-[1.15rem] font-semibold tracking-[-0.02em]">
              You might like
            </h2>
          </div>
          <Link
            href="/browse"
            className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted hover:text-gold transition-colors whitespace-nowrap ml-4"
          >
            Browse →
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
