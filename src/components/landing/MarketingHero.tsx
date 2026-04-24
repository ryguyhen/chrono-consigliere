// src/components/landing/MarketingHero.tsx
// Logged-out hero. Frames Chrono Consigliere as a social watch discovery
// platform — not just a listings site — and routes to the single next action.
import Link from 'next/link';

interface MarketingHeroProps {
  inStockWatchCount: number;
  curatedDealerCount: number;
}

export function MarketingHero({ inStockWatchCount, curatedDealerCount }: MarketingHeroProps) {
  return (
    <section className="bg-black text-white px-5 sm:px-8 py-14 sm:py-20 md:py-28 border-b border-white/[0.06]">
      <div className="max-w-[620px] mx-auto text-center">
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/35 mb-6 sm:mb-8">
          Social watch discovery
        </p>
        <h1 className="text-[clamp(2.6rem,10vw,5.5rem)] font-semibold leading-[1.0] mb-4 sm:mb-5 tracking-[-0.04em]">
          Start your roll.
        </h1>
        <p className="text-[14px] sm:text-[15px] text-white/55 max-w-[460px] mx-auto mb-8 sm:mb-10 leading-relaxed font-normal">
          Save the watches you want, follow collectors who know, and see what your
          circle is into — live from the world&apos;s best dealers.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href="/register"
            className="w-full sm:w-auto bg-gold text-black text-[11px] font-bold tracking-[0.1em] uppercase px-7 py-3.5 rounded hover:bg-gold-dark transition-colors"
          >
            Start your roll
          </Link>
          <Link
            href="/browse"
            className="w-full sm:w-auto border border-white/15 text-white/60 text-[11px] font-medium tracking-[0.1em] uppercase px-7 py-3.5 rounded hover:border-gold/60 hover:text-gold transition-colors"
          >
            Browse watches
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
  );
}
