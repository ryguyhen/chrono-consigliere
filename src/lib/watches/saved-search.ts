// src/lib/watches/saved-search.ts
//
// Canonical (de)serialisation for saved Browse searches. Both the web and
// future native clients should rely on this module so the JSON shape stored
// in `SavedSearch.filters` stays stable across surfaces.
//
// Wire format ≡ BrowseFilters minus `page` (which is navigation, not intent).
// Empty arrays and falsy primitives are dropped on serialisation so the JSON
// is small and meaningful.

import type { BrowseFilters } from '@/types';

const VALID_SORTS = new Set(['newest', 'price-asc', 'price-desc', 'most-liked']);
export const NAME_MAX_LEN = 60;

export type SavedSearchFilters = Omit<BrowseFilters, 'page'>;

/** True when the filter set has at least one meaningful constraint. */
export function isMeaningful(f: SavedSearchFilters): boolean {
  return (
    !!f.q ||
    (f.brand?.length ?? 0) > 0 ||
    (f.style?.length ?? 0) > 0 ||
    (f.movement?.length ?? 0) > 0 ||
    (f.condition?.length ?? 0) > 0 ||
    (f.dealer?.length ?? 0) > 0 ||
    f.minPrice != null ||
    f.maxPrice != null ||
    f.minCase != null ||
    f.maxCase != null ||
    (!!f.sort && f.sort !== 'newest')
  );
}

/** Strip empties; produce the JSON we persist. */
export function canonicalize(f: SavedSearchFilters): SavedSearchFilters {
  const out: SavedSearchFilters = {};
  if (f.q && f.q.trim()) out.q = f.q.trim();
  if (f.brand?.length)     out.brand     = [...f.brand];
  if (f.style?.length)     out.style     = [...f.style];
  if (f.movement?.length)  out.movement  = [...f.movement];
  if (f.condition?.length) out.condition = [...f.condition];
  if (f.dealer?.length)    out.dealer    = [...f.dealer];
  if (f.minPrice != null) out.minPrice = f.minPrice;
  if (f.maxPrice != null) out.maxPrice = f.maxPrice;
  if (f.minCase  != null) out.minCase  = f.minCase;
  if (f.maxCase  != null) out.maxCase  = f.maxCase;
  if (f.sort && f.sort !== 'newest') out.sort = f.sort;
  return out;
}

/** Read a JSON value from the DB and coerce it to our shape, dropping junk. */
export function fromJson(raw: unknown): SavedSearchFilters {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const arr = (v: unknown): string[] | undefined =>
    Array.isArray(v) ? v.filter(x => typeof x === 'string') as string[] : undefined;
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;

  const sort = typeof r.sort === 'string' && VALID_SORTS.has(r.sort)
    ? (r.sort as BrowseFilters['sort'])
    : undefined;

  return canonicalize({
    q: typeof r.q === 'string' ? r.q : undefined,
    brand: arr(r.brand),
    style: arr(r.style),
    movement: arr(r.movement),
    condition: arr(r.condition),
    dealer: arr(r.dealer),
    minPrice: num(r.minPrice),
    maxPrice: num(r.maxPrice),
    minCase: num(r.minCase),
    maxCase: num(r.maxCase),
    sort,
  });
}

/** Build a /browse URL from a saved-search filter object. */
export function toBrowseUrl(f: SavedSearchFilters): string {
  const sp = new URLSearchParams();
  if (f.q)        sp.set('q', f.q);
  if (f.sort && f.sort !== 'newest') sp.set('sort', f.sort);
  if (f.minPrice != null) sp.set('minPrice', String(f.minPrice));
  if (f.maxPrice != null) sp.set('maxPrice', String(f.maxPrice));
  if (f.minCase  != null) sp.set('minCase',  String(f.minCase));
  if (f.maxCase  != null) sp.set('maxCase',  String(f.maxCase));
  f.brand?.forEach(v     => sp.append('brand',     v));
  f.style?.forEach(v     => sp.append('style',     v));
  f.movement?.forEach(v  => sp.append('movement',  v));
  f.condition?.forEach(v => sp.append('condition', v));
  f.dealer?.forEach(v    => sp.append('dealer',    v));
  const qs = sp.toString();
  return qs ? `/browse?${qs}` : '/browse';
}

/** Convert a URLSearchParams object (from the browser) into a filter set. */
export function fromUrlSearchParams(sp: URLSearchParams): SavedSearchFilters {
  const num = (v: string | null): number | undefined => {
    if (!v) return undefined;
    const n = parseInt(v, 10);
    return isNaN(n) || n < 0 ? undefined : n;
  };
  const sortRaw = sp.get('sort');
  const sort = sortRaw && VALID_SORTS.has(sortRaw)
    ? (sortRaw as BrowseFilters['sort'])
    : undefined;
  return canonicalize({
    q: sp.get('q') ?? undefined,
    brand:     sp.getAll('brand'),
    style:     sp.getAll('style'),
    movement:  sp.getAll('movement'),
    condition: sp.getAll('condition'),
    dealer:    sp.getAll('dealer'),
    minPrice: num(sp.get('minPrice')),
    maxPrice: num(sp.get('maxPrice')),
    minCase:  num(sp.get('minCase')),
    maxCase:  num(sp.get('maxCase')),
    sort,
  });
}

/** Validate + normalize a user-supplied name. Throws on invalid input. */
export function validateName(name: unknown): string {
  if (typeof name !== 'string') throw new Error('Name must be a string');
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Name is required');
  if (trimmed.length > NAME_MAX_LEN) throw new Error(`Name must be ${NAME_MAX_LEN} characters or fewer`);
  return trimmed;
}
