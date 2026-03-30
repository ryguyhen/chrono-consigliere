// src/app/page.tsx
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { getTrendingWatches, getNewArrivals } from '@/lib/watches/queries';
import { WatchCard } from '@/components/watches/WatchCard';
import { prisma } from '@/lib/db';

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  const [trending, newArrivals, stats] = await Promise.all([
    getTrendingWatches(userId, 6),
    getNewArrivals(8),
    prisma.watchListing.aggregate({
      where: { isAvailable: true },
      _count: { id: true },
    }),
  ]);

  const totalListings = stats._count.id;

  return (
    <div>
      {/* HERO */}
      <section className="bg-ink text-cream px-8 py-28 relative overflow-hidden">
        <div className="relative z-10 max-w-[600px] mx-auto text-center">
          <h1 className="font-serif text-[clamp(3rem,7vw,5.5rem)] font-light leading-[1.02] mb-8 text-cream">
            Watch what your<br />
            <em className="italic text-gold">friends are into.</em>
          </h1>
          <p className="text-[14px] text-cream/50 max-w-[400px] mx-auto mb-12 leading-relaxed font-light">
            Live inventory from the world's best dealers. See what your circle is saving,
            what's heating up, and what's worth a look.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/browse"
              className="bg-gold text-ink text-[11px] font-medium tracking-[0.1em] uppercase px-6 py-3 rounded hover:bg-gold-dark transition-colors"
            >
              Browse watches
            </Link>
            {!session && (
              <Link
                href="/register"
                className="border border-white/15 text-cream/70 text-[11px] font-medium tracking-[0.1em] uppercase px-6 py-3 rounded hover:border-gold/50 hover:text-gold/80 transition-colors"
              >
                Start your roll
              </Link>
            )}
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-16 mt-20 pt-8 border-t border-white/8">
            {[
              [totalListings.toLocaleString(), 'In-stock watches'],
              ['20+', 'Curated dealers'],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="font-serif text-[2.2rem] font-light text-cream/90">{n}</div>
                <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-cream/30 mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT'S MOVING */}
      <div className="bg-parchment border-b border-[var(--border)] py-3 px-6 overflow-x-hidden">
        <div className="flex gap-10 text-[11px] text-muted/70 whitespace-nowrap">
          {[
            'James added a Rolex Explorer II to his roll',
            'Marcus bought a Lange 1 — it was on Ryan\'s roll',
            'New from Goldfinger\'s: Patek 5712A — just landed',
            'Priya liked 4 this morning',
            'Just dropped: Heuer Autavia from Craft & Tailored',
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 flex-shrink-0">
              <span className="w-1 h-1 rounded-full bg-gold/40 flex-shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* WHAT YOUR CIRCLE'S INTO */}
      {trending.length > 0 && (
        <section className="px-8 py-14 max-w-[1200px] mx-auto">
          <div className="flex justify-between items-end mb-8">
            <div>
              <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted mb-2">Getting around</div>
              <h2 className="font-serif text-[1.75rem] font-light">What your circle's into</h2>
            </div>
            <Link href="/browse?sort=most-liked" className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted hover:text-gold transition-colors">
              All watches →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
            {trending.map(watch => (
              <WatchCard key={watch.id} watch={watch} />
            ))}
          </div>
        </section>
      )}

      {/* DIVIDER */}
      {newArrivals.length > 0 && trending.length > 0 && (
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="border-t border-[var(--border)]" />
        </div>
      )}

      {/* NEW IN */}
      {newArrivals.length > 0 && (
        <section className="px-8 py-14 max-w-[1200px] mx-auto">
          <div className="flex justify-between items-end mb-8">
            <div>
              <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted mb-2">Just dropped</div>
              <h2 className="font-serif text-[1.75rem] font-light">New in</h2>
            </div>
            <Link href="/browse?sort=newest" className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted hover:text-gold transition-colors">
              All watches →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-5">
            {newArrivals.map(watch => (
              <WatchCard key={watch.id} watch={watch} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
