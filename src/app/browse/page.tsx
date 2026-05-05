// src/app/browse/page.tsx
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { getWatches, getFilterOptions } from '@/lib/watches/queries';
import { parseBrowseFilters, hasActiveFilters, buildPageUrl } from '@/lib/watches/filters';
import { Suspense } from 'react';
import { WatchCard } from '@/components/watches/WatchCard';
import { BrowseFilters, MobileFilterButton } from '@/components/watches/BrowseFilters';
import { SortSelect } from '@/components/watches/SortSelect';
import Link from 'next/link';

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function BrowsePage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const filters = parseBrowseFilters(searchParams);

  const [{ watches, total, hasMore, page, pageSize }, filterOptions] = await Promise.all([
    getWatches(filters, userId),
    getFilterOptions(),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  const hasFilters = hasActiveFilters(filters);

  return (
    <div className="flex min-h-[calc(100vh-52px)]">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search + Sort bar */}
        <div className="bg-surface border-b border-[var(--border)] px-4 sm:px-6 py-3 flex flex-wrap gap-2 sm:gap-3 items-center">
          {/* Hidden inputs preserve active filters when a new search is submitted.
              Without these, a GET form submission replaces the entire query string. */}
          <form className="flex-1 min-w-[160px]" action="/browse" method="GET">
            {filters.brand?.map(v => <input key={v} type="hidden" name="brand" value={v} />)}
            {filters.movement?.map(v => <input key={v} type="hidden" name="movement" value={v} />)}
            {filters.condition?.map(v => <input key={v} type="hidden" name="condition" value={v} />)}
            {filters.dealer?.map(v => <input key={v} type="hidden" name="dealer" value={v} />)}
            {filters.sort && filters.sort !== 'newest' && <input type="hidden" name="sort" value={filters.sort} />}
            {filters.minPrice && <input type="hidden" name="minPrice" value={filters.minPrice} />}
            {filters.maxPrice && <input type="hidden" name="maxPrice" value={filters.maxPrice} />}
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Search brand, reference…"
              className="w-full px-3 py-2 text-[13px] border border-[var(--border)] rounded bg-cream text-ink outline-none focus:border-gold"
            />
          </form>
          <Suspense fallback={null}>
            <MobileFilterButton {...filterOptions} signedIn={!!userId} />
          </Suspense>
          <div className="flex items-center gap-2">
            <SortSelect defaultValue={filters.sort ?? 'newest'} />
            <span className="font-mono text-[11px] text-muted whitespace-nowrap">
              {total.toLocaleString()}
            </span>
            {hasFilters && (
              <Link href="/browse" className="font-mono text-[10px] tracking-[0.08em] uppercase text-muted hover:text-gold transition-colors whitespace-nowrap">
                Clear
              </Link>
            )}
          </div>
        </div>

        {/* Desktop horizontal filter bar */}
        <Suspense fallback={<div className="hidden md:block h-[52px] bg-surface border-b border-[var(--border)]" />}>
          <BrowseFilters {...filterOptions} signedIn={!!userId} />
        </Suspense>

        {/* Grid */}
        {watches.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5 p-3 sm:p-6">
            {watches.map((watch, i) => (
              <WatchCard key={watch.id} watch={watch} priority={i < 6} />
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-24 text-muted">
            <div className="text-3xl mb-5 opacity-15">◇</div>
            <div className="text-[1.1rem] font-semibold mb-2 text-ink">No watches found</div>
            <p className="text-[13px] text-muted mb-5">Try adjusting your filters.</p>
            <Link href="/browse" className="font-mono text-[10px] tracking-[0.1em] uppercase text-gold hover:text-gold-dark transition-colors">
              Clear all filters
            </Link>
          </div>
        )}

        {/* Pagination */}
        {(hasMore || page > 1) && (
          <div className="flex justify-center items-center gap-3 py-10 border-t border-[var(--border)]">
            {page > 1 ? (
              <Link
                href={buildPageUrl(filters, page - 1)}
                className="font-mono text-[10px] tracking-[0.1em] uppercase px-4 py-2.5 border border-[var(--border)] rounded hover:border-gold text-muted hover:text-gold transition-colors"
              >
                ← Prev
              </Link>
            ) : (
              <span className="font-mono text-[10px] px-4 py-2.5 text-muted/30 select-none">← Prev</span>
            )}
            <span className="font-mono text-[10px] text-muted tabular-nums">
              {page} / {totalPages}
            </span>
            {hasMore ? (
              <Link
                href={buildPageUrl(filters, page + 1)}
                className="font-mono text-[10px] tracking-[0.1em] uppercase px-4 py-2.5 border border-[var(--border)] rounded hover:border-gold text-muted hover:text-gold transition-colors"
              >
                Next →
              </Link>
            ) : (
              <span className="font-mono text-[10px] px-4 py-2.5 text-muted/30 select-none">Next →</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
