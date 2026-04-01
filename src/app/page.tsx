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

  const [trending, newArrivals, stats, followingCount, recentTicker] = await Promise.all([
    getTrendingWatches(userId, 6),
    getNewArrivals(8),
    prisma.watchListing.aggregate({
      where: { isAvailable: true },
      _count: { id: true },
    }),
    userId
      ? prisma.follow.count({ where: { followerId: userId } })
      : Promise.resolve(0),
    prisma.watchListing.findMany({
      where: { isAvailable: true },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        brand: true,
        model: true,
        sourceTitle: true,
        source: { select: { name: true } },
      },
    }),
  ]);

  const totalListings = stats._count.id;
  const hasCircle = followingCount > 0;

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
          <p className="text-[14px] sm:text-[15px] text-white/50 max-w-[380px] sm:max-w-[420px] mx-auto mb-8 sm:mb-10 leading-relaxed font-normal">
            Build your watch box, follow your friends, and keep up with what's good.
          </p>
          <div className="flex gap-3 justify-center">
            {!session ? (
              <>
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
              </>
            ) : (
              <Link
                href="/browse"
                className="bg-gold text-black text-[11px] font-bold tracking-[0.1em] uppercase px-6 py-3.5 rounded hover:bg-gold-dark transition-colors"
              >
                Browse watches
              </Link>
            )}
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-10 sm:gap-16 mt-12 sm:mt-20 pt-8 border-t border-white/[0.07]">
            {[
              [totalListings.toLocaleString(), 'In-stock watches'],
              ['20+', 'Curated dealers'],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="text-[1.8rem] sm:text-[2.2rem] font-semibold text-white tracking-[-0.03em]">{n}</div>
                <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-white/30 mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RECENTLY ADDED TICKER */}
      {recentTicker.length > 0 && (
        <div className="bg-parchment border-b border-[var(--border)] py-3 px-4 overflow-x-hidden">
          <div className="flex gap-10 text-[11px] text-muted whitespace-nowrap">
            {recentTicker.map((w, i) => (
              <div key={i} className="flex items-center gap-2.5 flex-shrink-0">
                <span className="w-1 h-1 rounded-full bg-gold/50 flex-shrink-0" />
                {w.brand && w.model
                  ? `Just in: ${w.brand} ${w.model}${w.source?.name ? ` — ${w.source.name}` : ''}`
                  : `Just in: ${w.sourceTitle}${w.source?.name ? ` — ${w.source.name}` : ''}`}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TRENDING / CIRCLE */}
      {trending.length > 0 && (
        <section className="px-4 sm:px-8 py-10 sm:py-14 max-w-[1200px] mx-auto">
          <div className="flex justify-between items-end mb-5 sm:mb-8">
            <div>
              <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted mb-1.5 sm:mb-2">
                {hasCircle ? 'Getting around' : 'Most saved'}
              </div>
              <h2 className="text-[1.3rem] sm:text-[1.6rem] font-semibold tracking-[-0.02em]">
                {hasCircle ? "What your circle's into" : 'Popular right now'}
              </h2>
            </div>
            <Link href="/browse?sort=most-liked" className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted hover:text-gold transition-colors whitespace-nowrap ml-4">
              See all →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-5">
            {trending.map(watch => (
              <WatchCard key={watch.id} watch={watch} />
            ))}
          </div>
        </section>
      )}

      {newArrivals.length > 0 && trending.length > 0 && (
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
          <div className="border-t border-[var(--border)]" />
        </div>
      )}

      {/* NEW IN */}
      {newArrivals.length > 0 && (
        <section className="px-4 sm:px-8 py-10 sm:py-14 max-w-[1200px] mx-auto">
          <div className="flex justify-between items-end mb-5 sm:mb-8">
            <div>
              <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted mb-1.5 sm:mb-2">Just dropped</div>
              <h2 className="text-[1.3rem] sm:text-[1.6rem] font-semibold tracking-[-0.02em]">New in</h2>
            </div>
            <Link href="/browse?sort=newest" className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted hover:text-gold transition-colors whitespace-nowrap ml-4">
              See all →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-5">
            {newArrivals.map(watch => (
              <WatchCard key={watch.id} watch={watch} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
