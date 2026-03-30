// src/app/browse/page.tsx
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { getWatches, getFilterOptions } from '@/lib/watches/queries';
import { Suspense } from 'react';
import { WatchCard } from '@/components/watches/WatchCard';
import { BrowseFilters } from '@/components/watches/BrowseFilters';
import { SortSelect } from '@/components/watches/SortSelect';
import Link from 'next/link';
import type { BrowseFilters as FiltersType } from '@/types';

interface PageProps {
  searchParams: {
    q?: string;
    brand?: string | string[];
    style?: string | string[];
    movement?: string | string[];
    condition?: string | string[];
    dealer?: string | string[];
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    page?: string;
  };
}

function toArray(val: string | string[] | undefined): string[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

export default async function BrowsePage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  const filters: FiltersType = {
    q: searchParams.q,
    brand: toArray(searchParams.brand),
    style: toArray(searchParams.style),
    movement: toArray(searchParams.movement),
    condition: toArray(searchParams.condition),
    dealer: toArray(searchParams.dealer),
    minPrice: searchParams.minPrice ? parseInt(searchParams.minPrice) : undefined,
    maxPrice: searchParams.maxPrice ? parseInt(searchParams.maxPrice) : undefined,
    sort: searchParams.sort as FiltersType['sort'] ?? 'newest',
    page: searchParams.page ? parseInt(searchParams.page) : 1,
  };

  const [{ watches, total, hasMore, page }, filterOptions] = await Promise.all([
    getWatches(filters, userId),
    getFilterOptions(),
  ]);

  const hasFilters = (filters.brand?.length ?? 0) + (filters.style?.length ?? 0) +
    (filters.movement?.length ?? 0) + (filters.condition?.length ?? 0) +
    (filters.dealer?.length ?? 0) > 0 || filters.q || filters.minPrice || filters.maxPrice;

  return (
    <div className="flex min-h-[calc(100vh-52px)]">
      <Suspense fallback={<div className="w-[200px] flex-shrink-0 bg-surface border-r border-[var(--border)]" />}>
        <BrowseFilters {...filterOptions} />
      </Suspense>

      <div className="flex-1 flex flex-col">
        {/* Search + Sort bar */}
        <div className="bg-surface border-b border-[var(--border)] px-6 py-3 flex gap-3 items-center">
          <form className="flex-1" action="/browse" method="GET">
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Search by brand, reference, or description…"
              className="w-full px-3 py-2 text-[13px] border border-[var(--border)] rounded bg-cream text-ink outline-none focus:border-gold"
            />
          </form>
          <SortSelect defaultValue={filters.sort ?? 'newest'} />
          <span className="font-mono text-[11px] text-muted whitespace-nowrap">
            {total.toLocaleString()}
          </span>
          {hasFilters && (
            <Link href="/browse" className="font-mono text-[10px] tracking-[0.08em] uppercase text-muted hover:text-gold transition-colors">
              Clear
            </Link>
          )}
        </div>

        {/* Grid */}
        {watches.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 p-6">
            {watches.map(watch => (
              <WatchCard key={watch.id} watch={watch} />
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
          <div className="flex justify-center items-center gap-4 py-10 border-t border-[var(--border)]">
            {page > 1 && (
              <Link
                href={`/browse?${new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([,v]) => v !== undefined).map(([k,v]) => [k, String(v)])), page: String(page - 1) })}`}
                className="font-mono text-[10px] tracking-[0.1em] uppercase px-4 py-2 border border-[var(--border)] rounded hover:border-gold text-muted hover:text-gold transition-colors"
              >
                ← Prev
              </Link>
            )}
            <span className="font-mono text-[10px] text-muted">{page}</span>
            {hasMore && (
              <Link
                href={`/browse?${new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([,v]) => v !== undefined).map(([k,v]) => [k, String(v)])), page: String(page + 1) })}`}
                className="font-mono text-[10px] tracking-[0.1em] uppercase px-4 py-2 border border-[var(--border)] rounded hover:border-gold text-muted hover:text-gold transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
