// src/components/watches/BrowseFilters.tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SaveCurrentSearch,
  SavedSearchesMenu,
  MobileSavedSearchList,
} from './SavedSearchControls';

interface FilterOption { value: string; count: number; label?: string; }

interface FilterOptions {
  brands: FilterOption[];
  movements: FilterOption[];
  conditions: FilterOption[];
  dealers: FilterOption[];
}

const CONDITION_LABELS: Record<string, string> = {
  UNWORN: 'Unworn', MINT: 'Mint', EXCELLENT: 'Excellent',
  VERY_GOOD: 'Very Good', GOOD: 'Good', FAIR: 'Fair',
};

const MOVEMENT_LABELS: Record<string, string> = {
  AUTOMATIC: 'Automatic', MANUAL: 'Manual Wind', QUARTZ: 'Quartz', SPRINGDRIVE: 'Spring Drive',
};

// ─── Shared hook ──────────────────────────────────────────────────────────────

function useFilterState() {
  const router = useRouter();
  const params = useSearchParams();

  const updateParam = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    const existing = next.getAll(key);
    if (existing.includes(value)) {
      next.delete(key);
      existing.filter(v => v !== value).forEach(v => next.append(key, v));
    } else {
      next.append(key, value);
    }
    next.delete('page');
    router.push(`/browse?${next.toString()}`);
  }, [params, router]);

  const clearParam = useCallback((key: string) => {
    const next = new URLSearchParams(params.toString());
    next.delete(key);
    next.delete('page');
    router.push(`/browse?${next.toString()}`);
  }, [params, router]);

  const isActive = (key: string, value: string) => params.getAll(key).includes(value);

  const activeCount = ['brand', 'movement', 'condition', 'dealer'].reduce(
    (sum, key) => sum + params.getAll(key).length, 0
  ) + (params.get('minPrice') ? 1 : 0) + (params.get('maxPrice') ? 1 : 0);

  const minPrice = params.get('minPrice') ?? '';
  const maxPrice = params.get('maxPrice') ?? '';

  function updatePrice(key: 'minPrice' | 'maxPrice', val: string) {
    const next = new URLSearchParams(params.toString());
    if (val) next.set(key, val); else next.delete(key);
    next.delete('page');
    router.push(`/browse?${next.toString()}`);
  }

  // Single-push clear of every filter at once. Calling clearParam/updatePrice
  // multiple times in a row each fires its own router.push with a stale copy
  // of `params`, so only the last call's URL takes effect — leaving the other
  // filters intact. This builds one URL and pushes once.
  const clearAll = useCallback(() => {
    const next = new URLSearchParams();
    const q = params.get('q');
    const sort = params.get('sort');
    if (q) next.set('q', q);
    if (sort) next.set('sort', sort);
    router.push(next.toString() ? `/browse?${next.toString()}` : '/browse');
  }, [params, router]);

  return { params, updateParam, clearParam, clearAll, isActive, activeCount, minPrice, maxPrice, updatePrice };
}

// ─── Reusable checkbox row ────────────────────────────────────────────────────

function CheckboxRow({
  active, label, count, onClick,
}: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="checkbox"
      aria-checked={active}
      className={`w-full flex items-center gap-2 py-2 sm:py-1.5 text-left text-[13px] sm:text-[12px] transition-colors
        ${active ? 'text-gold' : 'text-ink/65 hover:text-ink'}`}
    >
      <span className={`w-3.5 h-3.5 sm:w-3 sm:h-3 rounded-sm border flex-shrink-0 flex items-center justify-center text-[7px]
        ${active ? 'bg-gold border-gold text-ink' : 'border-ink/20'}`}>
        {active ? '✓' : ''}
      </span>
      <span className="flex-1 truncate">{label}</span>
      <span className="font-mono text-[9px] text-muted/60">{count}</span>
    </button>
  );
}

// ─── Mobile-only sectioned panel (used inside the bottom sheet) ───────────────

function MobileFilterPanel({
  brands, movements, conditions, dealers,
  updateParam, isActive, minPrice, maxPrice, updatePrice,
}: FilterOptions & ReturnType<typeof useFilterState>) {
  function Section({ title, items, paramKey, labelMap }: {
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
          {items.map(item => (
            <CheckboxRow
              key={item.value}
              active={isActive(paramKey, item.value)}
              label={labelMap?.[item.value] ?? item.label ?? item.value}
              count={item.count}
              onClick={() => updateParam(paramKey, item.value)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <Section title="Brand" items={brands} paramKey="brand" />
      <div className="mb-6">
        <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted mb-3">Price</div>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            placeholder="Min"
            aria-label="Minimum price"
            defaultValue={minPrice}
            onBlur={e => updatePrice('minPrice', e.target.value)}
            className="flex-1 px-2 py-1.5 text-[12px] border border-[var(--border)] rounded bg-cream text-ink outline-none focus:border-gold w-0 min-w-0"
          />
          <span className="text-muted text-[11px]" aria-hidden="true">–</span>
          <input
            type="number"
            placeholder="Max"
            aria-label="Maximum price"
            defaultValue={maxPrice}
            onBlur={e => updatePrice('maxPrice', e.target.value)}
            className="flex-1 px-2 py-1.5 text-[12px] border border-[var(--border)] rounded bg-cream text-ink outline-none focus:border-gold w-0 min-w-0"
          />
        </div>
      </div>
      <Section title="Movement" items={movements} paramKey="movement" labelMap={MOVEMENT_LABELS} />
      <Section title="Condition" items={conditions} paramKey="condition" labelMap={CONDITION_LABELS} />
      <Section title="Dealer" items={dealers} paramKey="dealer" />
    </>
  );
}

// ─── Desktop dropdown ──────────────────────────────────────────────────────────

function FilterDropdown({
  label, activeCount, children, panelWidth = 280,
}: {
  label: string;
  activeCount: number;
  children: (close: () => void) => React.ReactNode;
  panelWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] border rounded transition-colors whitespace-nowrap
          ${activeCount > 0
            ? 'border-gold text-ink bg-gold/10'
            : 'border-[var(--border)] text-ink/75 hover:text-ink hover:border-ink/30 bg-parchment'}
          ${open ? 'border-gold' : ''}`}
      >
        <span>{label}</span>
        {activeCount > 0 && (
          <span className="bg-gold text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
            {activeCount}
          </span>
        )}
        <svg
          width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor"
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          className={`opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <polyline points="3 4.5 6 7.5 9 4.5" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-40 bg-surface border border-[var(--border)] rounded shadow-lg py-2 px-3 max-h-[60vh] overflow-y-auto"
          style={{ width: panelWidth }}
          role="dialog"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function DropdownCheckList({
  items, paramKey, labelMap, isActive, updateParam,
}: {
  items: FilterOption[];
  paramKey: string;
  labelMap?: Record<string, string>;
  isActive: (k: string, v: string) => boolean;
  updateParam: (k: string, v: string) => void;
}) {
  if (!items.length) {
    return <div className="px-1 py-2 text-[12px] text-muted">No options</div>;
  }
  return (
    <div className="space-y-px">
      {items.map(item => (
        <CheckboxRow
          key={item.value}
          active={isActive(paramKey, item.value)}
          label={labelMap?.[item.value] ?? item.label ?? item.value}
          count={item.count}
          onClick={() => updateParam(paramKey, item.value)}
        />
      ))}
    </div>
  );
}

// ─── Desktop horizontal filter bar ────────────────────────────────────────────

export function BrowseFilters(props: FilterOptions & { signedIn?: boolean }) {
  const state = useFilterState();
  const { params, updateParam, clearAll, isActive, activeCount, minPrice, maxPrice, updatePrice } = state;

  const brandCount     = params.getAll('brand').length;
  const movementCount  = params.getAll('movement').length;
  const conditionCount = params.getAll('condition').length;
  const dealerCount    = params.getAll('dealer').length;
  const priceCount     = (minPrice ? 1 : 0) + (maxPrice ? 1 : 0);

  // Bumping this number re-fetches the Saved menu after a successful save.
  const [savedRefresh, setSavedRefresh] = useState(0);

  return (
    <div className="hidden md:flex items-center gap-2 px-6 py-3 bg-surface border-b border-[var(--border)] flex-wrap">
      <FilterDropdown label="Brand" activeCount={brandCount} panelWidth={300}>
        {() => (
          <DropdownCheckList items={props.brands} paramKey="brand" isActive={isActive} updateParam={updateParam} />
        )}
      </FilterDropdown>

      <FilterDropdown label="Price" activeCount={priceCount} panelWidth={260}>
        {() => (
          <div className="px-1 py-1">
            <div className="flex gap-2 items-center">
              <input
                type="number"
                placeholder="Min"
                aria-label="Minimum price"
                defaultValue={minPrice}
                onBlur={e => updatePrice('minPrice', e.target.value)}
                className="flex-1 px-2 py-1.5 text-[12px] border border-[var(--border)] rounded bg-cream text-ink outline-none focus:border-gold w-0 min-w-0"
              />
              <span className="text-muted text-[11px]" aria-hidden="true">–</span>
              <input
                type="number"
                placeholder="Max"
                aria-label="Maximum price"
                defaultValue={maxPrice}
                onBlur={e => updatePrice('maxPrice', e.target.value)}
                className="flex-1 px-2 py-1.5 text-[12px] border border-[var(--border)] rounded bg-cream text-ink outline-none focus:border-gold w-0 min-w-0"
              />
            </div>
          </div>
        )}
      </FilterDropdown>

      <FilterDropdown label="Movement" activeCount={movementCount} panelWidth={240}>
        {() => (
          <DropdownCheckList items={props.movements} paramKey="movement" labelMap={MOVEMENT_LABELS} isActive={isActive} updateParam={updateParam} />
        )}
      </FilterDropdown>

      <FilterDropdown label="Condition" activeCount={conditionCount} panelWidth={240}>
        {() => (
          <DropdownCheckList items={props.conditions} paramKey="condition" labelMap={CONDITION_LABELS} isActive={isActive} updateParam={updateParam} />
        )}
      </FilterDropdown>

      <FilterDropdown label="Dealer" activeCount={dealerCount} panelWidth={300}>
        {() => (
          <DropdownCheckList items={props.dealers} paramKey="dealer" isActive={isActive} updateParam={updateParam} />
        )}
      </FilterDropdown>

      <ActiveFilterChips
        params={params}
        brands={props.brands}
        movements={props.movements}
        conditions={props.conditions}
        dealers={props.dealers}
        updateParam={updateParam}
        clearAll={clearAll}
        updatePrice={updatePrice}
      />

      {props.signedIn && (
        <div className="ml-auto flex items-center gap-2">
          <SavedSearchesMenu refreshKey={savedRefresh} />
          <SaveCurrentSearch
            hasActiveFilters={activeCount > 0}
            onSaved={() => setSavedRefresh(n => n + 1)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Active-filter chip row ───────────────────────────────────────────────────

function ActiveFilterChips({
  params, brands, movements, conditions, dealers,
  updateParam, clearAll, updatePrice,
}: {
  params: URLSearchParams;
  brands: FilterOption[];
  movements: FilterOption[];
  conditions: FilterOption[];
  dealers: FilterOption[];
  updateParam: (k: string, v: string) => void;
  clearAll: () => void;
  updatePrice: (k: 'minPrice' | 'maxPrice', v: string) => void;
}) {
  const labelFor = (items: FilterOption[], v: string, map?: Record<string, string>) =>
    map?.[v] ?? items.find(i => i.value === v)?.label ?? v;

  const chips: { label: string; onRemove: () => void; key: string }[] = [];
  params.getAll('brand').forEach(v =>
    chips.push({ key: `brand:${v}`, label: labelFor(brands, v), onRemove: () => updateParam('brand', v) }));
  params.getAll('movement').forEach(v =>
    chips.push({ key: `movement:${v}`, label: labelFor(movements, v, MOVEMENT_LABELS), onRemove: () => updateParam('movement', v) }));
  params.getAll('condition').forEach(v =>
    chips.push({ key: `condition:${v}`, label: labelFor(conditions, v, CONDITION_LABELS), onRemove: () => updateParam('condition', v) }));
  params.getAll('dealer').forEach(v =>
    chips.push({ key: `dealer:${v}`, label: labelFor(dealers, v), onRemove: () => updateParam('dealer', v) }));

  const min = params.get('minPrice');
  const max = params.get('maxPrice');
  if (min || max) {
    const fmt = (cents: string) => `$${parseInt(cents, 10).toLocaleString()}`;
    const label = min && max ? `${fmt(min)} – ${fmt(max)}` : min ? `≥ ${fmt(min)}` : `≤ ${fmt(max!)}`;
    chips.push({
      key: 'price',
      label,
      onRemove: () => {
        if (min) updatePrice('minPrice', '');
        if (max) updatePrice('maxPrice', '');
      },
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap basis-full md:basis-auto md:ml-2">
      {chips.map(c => (
        <button
          key={c.key}
          onClick={c.onRemove}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-gold/15 text-ink border border-gold/40 rounded hover:bg-gold/25 transition-colors"
          aria-label={`Remove ${c.label}`}
        >
          <span className="truncate max-w-[160px]">{c.label}</span>
          <span aria-hidden="true" className="text-muted">×</span>
        </button>
      ))}
      <button
        onClick={clearAll}
        className="font-mono text-[10px] tracking-[0.08em] uppercase text-muted hover:text-gold transition-colors ml-1"
      >
        Clear all
      </button>
    </div>
  );
}

// ─── Mobile filter button (inline in header) + bottom sheet ───────────────────

export function MobileFilterButton(props: FilterOptions & { signedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  const filterState = useFilterState();
  const { activeCount } = filterState;

  return (
    <>
      {/* Trigger — rendered inline in the search bar row */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open filters"
        className="md:hidden flex items-center gap-1.5 px-3 py-2 text-[12px] border border-[var(--border)] rounded bg-parchment text-ink whitespace-nowrap"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="8" y1="12" x2="16" y2="12" />
          <line x1="11" y1="18" x2="13" y2="18" />
        </svg>
        Filters
        {activeCount > 0 && (
          <span className="bg-gold text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
            {activeCount}
          </span>
        )}
      </button>

      {/* Bottom sheet */}
      {open && (
        <div className="md:hidden fixed inset-0 z-[60] flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setOpen(false)}
          />

          {/* Sheet */}
          <div
            className="relative bg-surface rounded-t-2xl flex flex-col"
            style={{ maxHeight: '80vh' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-4 pb-0 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-ink/15" />
            </div>

            {/* Header */}
            <div className="flex justify-between items-center px-5 pt-4 pb-3 flex-shrink-0">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Filters</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close filters"
                className="w-10 h-10 flex items-center justify-center text-muted hover:text-ink text-xl leading-none -mr-2"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            {/* Scrollable filter content */}
            <div className="overflow-y-auto flex-1 px-5 pb-4">
              {props.signedIn && (
                <MobileSavedSearchList
                  hasActiveFilters={activeCount > 0}
                  onApplied={() => setOpen(false)}
                />
              )}
              <MobileFilterPanel {...props} {...filterState} />
            </div>

            {/* Sticky done button */}
            <div
              className="flex-shrink-0 px-5 pt-3 border-t border-[var(--border)] bg-surface"
              style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <button
                onClick={() => setOpen(false)}
                className="w-full py-3 bg-gold text-black font-mono text-[10px] tracking-[0.12em] uppercase font-bold rounded"
              >
                Done{activeCount > 0 ? ` · ${activeCount} active` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
