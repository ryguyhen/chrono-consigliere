// src/components/watches/BrowseFilters.tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface FilterOption { value: string; count: number; label?: string; }

interface BrowseFiltersProps {
  brands: FilterOption[];
  styles: FilterOption[];
  movements: FilterOption[];
  conditions: FilterOption[];
  dealers: FilterOption[];
}

const STYLE_LABELS: Record<string, string> = {
  DRESS: 'Dress', SPORT: 'Sport', DIVE: 'Dive', CHRONOGRAPH: 'Chronograph',
  FIELD: 'Field', GMT: 'GMT', PILOT: 'Pilot', INTEGRATED_BRACELET: 'Integrated Bracelet',
  VINTAGE: 'Vintage', TONNEAU: 'Tonneau', SKELETON: 'Skeleton',
};

const CONDITION_LABELS: Record<string, string> = {
  UNWORN: 'Unworn', MINT: 'Mint', EXCELLENT: 'Excellent',
  VERY_GOOD: 'Very Good', GOOD: 'Good', FAIR: 'Fair',
};

const MOVEMENT_LABELS: Record<string, string> = {
  AUTOMATIC: 'Automatic', MANUAL: 'Manual Wind', QUARTZ: 'Quartz', SPRINGDRIVE: 'Spring Drive',
};

export function BrowseFilters({ brands, styles, movements, conditions, dealers }: BrowseFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();

  const updateParam = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    const existing = next.getAll(key);
    if (existing.includes(value)) {
      // Remove
      next.delete(key);
      existing.filter(v => v !== value).forEach(v => next.append(key, v));
    } else {
      next.append(key, value);
    }
    next.delete('page');
    router.push(`/browse?${next.toString()}`);
  }, [params, router]);

  const isActive = (key: string, value: string) => params.getAll(key).includes(value);

  function FilterSection({ title, items, paramKey, labelMap }: {
    title: string;
    items: FilterOption[];
    paramKey: string;
    labelMap?: Record<string, string>;
  }) {
    if (!items.length) return null;
    return (
      <div className="mb-6">
        <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted mb-3">{title}</div>
        <div className="space-y-px">
          {items.map(item => {
            const active = isActive(paramKey, item.value);
            return (
              <button
                key={item.value}
                onClick={() => updateParam(paramKey, item.value)}
                className={`w-full flex items-center gap-2 py-1.5 text-left text-[12px] transition-colors
                  ${active ? 'text-gold' : 'text-ink/65 hover:text-ink'}`}
              >
                <span className={`w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center text-[7px]
                  ${active ? 'bg-gold border-gold text-ink' : 'border-ink/20'}`}>
                  {active ? '✓' : ''}
                </span>
                <span className="flex-1 truncate">{labelMap?.[item.value] ?? item.label ?? item.value}</span>
                <span className="font-mono text-[9px] text-muted/60">{item.count}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const minPrice = params.get('minPrice') ?? '';
  const maxPrice = params.get('maxPrice') ?? '';

  function updatePrice(key: 'minPrice' | 'maxPrice', val: string) {
    const next = new URLSearchParams(params.toString());
    if (val) next.set(key, val); else next.delete(key);
    next.delete('page');
    router.push(`/browse?${next.toString()}`);
  }

  return (
    <aside className="w-[200px] flex-shrink-0 bg-surface border-r border-[var(--border)] h-[calc(100vh-52px)] sticky top-[52px] overflow-y-auto px-5 py-6">
      <FilterSection title="Brand" items={brands} paramKey="brand" />
      <FilterSection title="Style" items={styles} paramKey="style" labelMap={STYLE_LABELS} />

      {/* Price range */}
      <div className="mb-6">
        <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted mb-3">Price</div>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            placeholder="Min"
            defaultValue={minPrice}
            onBlur={e => updatePrice('minPrice', e.target.value)}
            className="flex-1 px-2 py-1.5 text-[12px] border border-[var(--border)] rounded bg-cream text-ink outline-none focus:border-gold w-0 min-w-0"
          />
          <span className="text-muted text-[11px]">–</span>
          <input
            type="number"
            placeholder="Max"
            defaultValue={maxPrice}
            onBlur={e => updatePrice('maxPrice', e.target.value)}
            className="flex-1 px-2 py-1.5 text-[12px] border border-[var(--border)] rounded bg-cream text-ink outline-none focus:border-gold w-0 min-w-0"
          />
        </div>
      </div>

      <FilterSection title="Movement" items={movements} paramKey="movement" labelMap={MOVEMENT_LABELS} />
      <FilterSection title="Condition" items={conditions} paramKey="condition" labelMap={CONDITION_LABELS} />
      <FilterSection title="Dealer" items={dealers.map(d => ({ ...d, label: d.label }))} paramKey="dealer" />
    </aside>
  );
}
