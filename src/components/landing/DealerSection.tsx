// src/components/landing/DealerSection.tsx
// Thin wrapper around DealerRail — reused on the logged-out and logged-in
// homepages as the ambient-freshness rail. The rail itself is a client
// component (rAF auto-scroll); this server wrapper adds the section chrome.
import Link from 'next/link';
import { DealerRail } from './DealerRail';

interface DealerSectionProps {
  dealers: { name: string; slug: string }[];
  eyebrow?: string;
  title?: string;
  compact?: boolean;
}

export function DealerSection({
  dealers,
  eyebrow = 'Our sources',
  title = 'Curated dealers',
  compact = false,
}: DealerSectionProps) {
  if (!dealers.length) return null;

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
        <div className="border-t border-[var(--border)]" />
      </div>
      <section className={`${compact ? 'py-6 sm:py-8' : 'py-10 sm:py-14'} max-w-[1200px] mx-auto`}>
        <div className={`flex justify-between items-end px-4 sm:px-8 ${compact ? 'mb-3 sm:mb-4' : 'mb-5 sm:mb-7'}`}>
          <div>
            <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted mb-1.5 sm:mb-2">
              {eyebrow}
            </div>
            <h2 className={`${compact ? 'text-[1.05rem] sm:text-[1.15rem]' : 'text-[1.3rem] sm:text-[1.6rem]'} font-semibold tracking-[-0.02em]`}>
              {title}
            </h2>
          </div>
          <Link
            href="/browse"
            className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted hover:text-gold transition-colors whitespace-nowrap ml-4"
          >
            Browse all →
          </Link>
        </div>
        <DealerRail dealers={dealers} />
      </section>
    </>
  );
}
