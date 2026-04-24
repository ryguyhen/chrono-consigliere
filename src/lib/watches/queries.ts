// src/lib/watches/queries.ts
// Server-side data fetching for watch listings.

import { prisma } from '@/lib/db';
import type { BrowseFilters, PaginatedWatches, WatchWithRelations } from '@/types';

const PAGE_SIZE = 24;

/**
 * Non-watch title terms blocked from public browse regardless of source.
 * This is the last line of defence for items that slipped past adapter-level filtering.
 * Only terms with ~0% chance of appearing in a real watch product title.
 * Keep conservative — a false positive hides a real watch from every user.
 */
const BROWSE_TITLE_BLOCKLIST = [
  // Retail signage & display items
  // Note: 'signage' catches "Brass Case Signage"; 'brass sign' catches "Brass Sign - Small"
  // (different words — one does not subsume the other)
  'signage',
  'display stand',
  'display case',
  'brass sign',     // e.g. "Rolex 'Official Retailer' Brass Sign - Small" — slips past 'signage'
  'dealer sign',    // generic dealer display signs
  'retailer sign',  // generic retailer display signs
  // Branded textile merchandise
  'silk scarf',
  ' scarf',       // space-prefix avoids matching "scarface" watch nicknames
  // Branded leather goods
  'key pouch',
  'key chain',
  'key ring',
  // Watch accessories / bracelets / straps / rolls / pouches that are not watches
  'watch winder',
  'bracelet',       // metal/leather bracelets — never appears in a real watch product title
  ' strap',         // space-prefix avoids "bootstrap" — catches "nato strap", "rubber strap", etc.
  'watch roll',     // watch travel rolls — never appears in a real watch product title
  ' pouch',         // space-prefix avoids compound words — catches "watch pouch", "leather pouch"
  // Pins & wearable accessories
  'coronet pin',
  'lapel pin',
  'tie clip',
  'tie bar',
  // General merchandise
  'wallet',
  'umbrella',
  'brochure',
] as const;

/**
 * Base filter applied to ALL public-facing listing queries.
 * Excludes listings from disabled sources, deduplicates, hides unavailable inventory,
 * and blocks non-watch items that slipped past adapter-level filtering.
 */
const PUBLIC_WHERE = {
  isAvailable: true,
  duplicateOf: null,
  source: { isActive: true },
  NOT: {
    OR: BROWSE_TITLE_BLOCKLIST.map(term => ({
      sourceTitle: { contains: term, mode: 'insensitive' as const },
    })),
  },
};

const LISTING_SELECT = {
  id: true,
  brand: true,
  model: true,
  reference: true,
  year: true,
  caseSizeMm: true,
  caseMaterial: true,
  dialColor: true,
  movementType: true,
  condition: true,
  style: true,
  price: true,
  currency: true,
  description: true,
  sourceTitle: true,
  sourcePrice: true,
  sourceUrl: true,
  isAvailable: true,
  likeCount: true,
  saveCount: true,
  createdAt: true,
  updatedAt: true,
  source: { select: { id: true, name: true, slug: true, baseUrl: true } },
  images: {
    where: { isPrimary: true },
    select: { id: true, url: true, isPrimary: true, altText: true },
    take: 1,
  },
} as const;

export async function getWatches(
  filters: BrowseFilters,
  userId?: string
): Promise<PaginatedWatches> {
  const page = filters.page ?? 1;
  const skip = (page - 1) * PAGE_SIZE;

  const where: any = { ...PUBLIC_WHERE };

  if (filters.q) {
    where.OR = [
      { brand: { contains: filters.q, mode: 'insensitive' } },
      { model: { contains: filters.q, mode: 'insensitive' } },
      { reference: { contains: filters.q, mode: 'insensitive' } },
      { description: { contains: filters.q, mode: 'insensitive' } },
      { sourceTitle: { contains: filters.q, mode: 'insensitive' } },
    ];
  }

  if (filters.brand?.length) {
    where.brand = { in: filters.brand, mode: 'insensitive' };
  }

  if (filters.style?.length) {
    where.style = { in: filters.style };
  }

  if (filters.movement?.length) {
    where.movementType = { in: filters.movement };
  }

  if (filters.condition?.length) {
    where.condition = { in: filters.condition };
  }

  if (filters.dealer?.length) {
    where.source = { isActive: true, slug: { in: filters.dealer } };
  }

  if (filters.minPrice || filters.maxPrice) {
    where.price = {};
    if (filters.minPrice) where.price.gte = filters.minPrice * 100;
    if (filters.maxPrice) where.price.lte = filters.maxPrice * 100;
  }

  if (filters.minCase || filters.maxCase) {
    where.caseSizeMm = {};
    if (filters.minCase) where.caseSizeMm.gte = filters.minCase;
    if (filters.maxCase) where.caseSizeMm.lte = filters.maxCase;
  }

  let orderBy: any = { createdAt: 'desc' };
  if (filters.sort === 'price-asc') orderBy = { price: 'asc' };
  if (filters.sort === 'price-desc') orderBy = [{ price: { sort: 'desc', nulls: 'last' } }];
  if (filters.sort === 'most-liked') orderBy = { likeCount: 'desc' };
  if (filters.sort === 'newest') orderBy = { createdAt: 'desc' };

  const [watches, total] = await Promise.all([
    prisma.watchListing.findMany({
      where,
      select: LISTING_SELECT,
      orderBy,
      skip,
      take: PAGE_SIZE,
    }),
    prisma.watchListing.count({ where }),
  ]);

  // Attach user-specific like/save state if logged in; null signals unauthenticated
  let likedIds: Set<string> | null = null;
  let savedIds: Set<string> | null = null;
  let ownedIds: Set<string> | null = null;
  if (userId) {
    const ids = watches.map(w => w.id);
    const [likes, wishlistItems] = await Promise.all([
      prisma.like.findMany({ where: { userId, listingId: { in: ids } }, select: { listingId: true } }),
      prisma.wishlistItem.findMany({ where: { userId, listingId: { in: ids } }, select: { listingId: true, list: true } }),
    ]);
    likedIds = new Set(likes.map(l => l.listingId));
    savedIds = new Set(wishlistItems.filter(s => s.list === 'FAVORITES').map(s => s.listingId));
    ownedIds = new Set(wishlistItems.filter(s => s.list === 'OWNED').map(s => s.listingId));
  }

  return {
    watches: watches.map(w => ({
      ...w,
      isLiked: likedIds ? likedIds.has(w.id) : null,
      isSaved: savedIds ? savedIds.has(w.id) : null,
      isOwned: ownedIds ? ownedIds.has(w.id) : null,
    })) as WatchWithRelations[],
    total,
    page,
    pageSize: PAGE_SIZE,
    hasMore: skip + watches.length < total,
  };
}

export async function getWatchById(
  id: string,
  userId?: string
): Promise<WatchWithRelations | null> {
  const watch = await prisma.watchListing.findFirst({
    where: {
      id,
      duplicateOf: null,
      source: { isActive: true },
      NOT: {
        OR: BROWSE_TITLE_BLOCKLIST.map(term => ({
          sourceTitle: { contains: term, mode: 'insensitive' as const },
        })),
      },
    },
    select: {
      ...LISTING_SELECT,
      images: {
        select: { id: true, url: true, isPrimary: true, altText: true },
        orderBy: { isPrimary: 'desc' },
      },
    },
  });

  if (!watch) return null;

  let isLiked: boolean | null = null;
  let isSaved: boolean | null = null;
  let isOwned: boolean | null = null;
  if (userId) {
    const [like, wishlistItem] = await Promise.all([
      prisma.like.findUnique({ where: { userId_listingId: { userId, listingId: id } } }),
      prisma.wishlistItem.findUnique({ where: { userId_listingId: { userId, listingId: id } }, select: { list: true } }),
    ]);
    isLiked = !!like;
    isSaved = wishlistItem?.list === 'FAVORITES';
    isOwned = wishlistItem?.list === 'OWNED';
  }

  return { ...watch, isLiked, isSaved, isOwned } as WatchWithRelations;
}

export async function getFilterOptions() {
  const [brands, styles, movements, conditions, dealers] = await Promise.all([
    prisma.watchListing.groupBy({
      by: ['brand'],
      // Exclude "Unknown" — it's a scraper fallback value, not a meaningful filter target.
      // Browsing by Unknown is not useful and it would otherwise dominate the list.
      where: { ...PUBLIC_WHERE, brand: { not: 'Unknown' } },
      _count: true,
      orderBy: { _count: { brand: 'desc' } },
      take: 60,
    }),
    prisma.watchListing.groupBy({
      by: ['style'],
      where: { ...PUBLIC_WHERE, style: { not: null } },
      _count: true,
    }),
    prisma.watchListing.groupBy({
      by: ['movementType'],
      where: { ...PUBLIC_WHERE, movementType: { not: null } },
      _count: true,
    }),
    prisma.watchListing.groupBy({
      by: ['condition'],
      where: { ...PUBLIC_WHERE, condition: { not: null } },
      _count: true,
    }),
    prisma.dealerSource.findMany({
      where: { isActive: true },
      select: { slug: true, name: true, _count: { select: { listings: { where: { isAvailable: true } } } } },
    }),
  ]);

  return {
    brands: brands.map(b => ({ value: b.brand, count: b._count })),
    styles: styles.map(s => ({ value: s.style!, count: s._count })),
    movements: movements.map(m => ({ value: m.movementType!, count: m._count })),
    conditions: conditions.map(c => ({ value: c.condition!, count: c._count })),
    dealers: dealers.map(d => ({ value: d.slug, label: d.name, count: d._count.listings })),
  };
}

// Listings with at least one real engagement signal, ordered by social rank.
// Used for the homepage "Popular right now" section.
// Returns empty array (not dummy inventory) if no engaged listings exist.
export async function getEngagedListings(limit = 6): Promise<WatchWithRelations[]> {
  const listings = await prisma.watchListing.findMany({
    where: {
      ...PUBLIC_WHERE,
      OR: [{ likeCount: { gt: 0 } }, { saveCount: { gt: 0 } }],
    },
    select: LISTING_SELECT,
    orderBy: [
      { likeCount: 'desc' },
      { saveCount: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  });
  return listings.map(w => ({ ...w, isLiked: null, isSaved: null, isOwned: null })) as WatchWithRelations[];
}

export async function getNewArrivals(limit = 8): Promise<WatchWithRelations[]> {
  const listings = await prisma.watchListing.findMany({
    where: { ...PUBLIC_WHERE },
    select: LISTING_SELECT,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return listings.map(w => ({ ...w, isLiked: null, isSaved: null, isOwned: null })) as WatchWithRelations[];
}

// Recently-saved listings for the authenticated user — backs the homepage
// "Continue where you left off" strip. Falls through to an empty array if the
// user has no saves, in which case the caller should hide the section entirely.
export async function getRecentlySavedListings(userId: string, limit = 8): Promise<WatchWithRelations[]> {
  const saves = await prisma.wishlistItem.findMany({
    where: { userId, list: 'FAVORITES', listing: { ...PUBLIC_WHERE } },
    select: { listingId: true, listing: { select: LISTING_SELECT } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return saves.map(s => ({
    ...s.listing,
    isLiked: null,
    isSaved: true,
    isOwned: false,
  })) as WatchWithRelations[];
}

// Personalized suggestions by brand overlap — for users who have started a roll
// but don't have an active circle yet. Pulls the top 3 brands from their saves,
// then returns engaging listings from those brands they haven't saved yet.
// Returns empty array when the user has no saves — caller should hide the
// section in that case (use getEngagedListings for the empty-roll variant instead).
export async function getPersonalizedSuggestions(userId: string, limit = 6): Promise<WatchWithRelations[]> {
  const saves = await prisma.wishlistItem.findMany({
    where: { userId, list: 'FAVORITES' },
    select: { listingId: true, listing: { select: { brand: true } } },
  });
  if (!saves.length) return [];

  const brandCounts = new Map<string, number>();
  for (const s of saves) {
    const b = s.listing?.brand;
    if (!b) continue;
    brandCounts.set(b, (brandCounts.get(b) ?? 0) + 1);
  }
  const topBrands = [...brandCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([b]) => b);

  if (!topBrands.length) return [];

  const savedIds = saves.map(s => s.listingId);
  const listings = await prisma.watchListing.findMany({
    where: {
      ...PUBLIC_WHERE,
      brand: { in: topBrands },
      id: { notIn: savedIds },
    },
    select: LISTING_SELECT,
    orderBy: [{ saveCount: 'desc' }, { likeCount: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });

  return listings.map(w => ({
    ...w,
    isLiked: null,
    isSaved: false,
    isOwned: false,
  })) as WatchWithRelations[];
}

// Listings most liked in the last 7 days, with fallback to all-time engaged.
// Ranked by recent activity count so the list changes as collector interest shifts.
// Accepts an optional userId to attach correct save state — callers on authenticated
// surfaces should always pass userId to prevent WatchCard showing stale unsaved state.
export async function getWeeklyTrending(limit = 6, userId?: string): Promise<WatchWithRelations[]> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Oversample (limit × 3) to account for unavailable/duplicate listings being filtered.
  const recentLikes = await prisma.like.groupBy({
    by: ['listingId'],
    where: { createdAt: { gte: weekAgo } },
    _count: { listingId: true },
    orderBy: { _count: { listingId: 'desc' } },
    take: limit * 3,
  });

  let rawListings: any[] = [];

  if (recentLikes.length >= 3) {
    const ids = recentLikes.map(l => l.listingId);
    const fetched = await prisma.watchListing.findMany({
      where: { ...PUBLIC_WHERE, id: { in: ids } },
      select: LISTING_SELECT,
    });
    // Preserve the weekly-rank order from the groupBy
    const byId = new Map(fetched.map(l => [l.id, l]));
    const ordered = ids.map(id => byId.get(id)).filter(Boolean);
    if (ordered.length >= 3) {
      rawListings = ordered.slice(0, limit);
    }
  }

  // Fallback: all-time engaged listings (same signal as public home but as a fallback only)
  if (rawListings.length < 3) {
    rawListings = await prisma.watchListing.findMany({
      where: {
        ...PUBLIC_WHERE,
        OR: [{ likeCount: { gt: 0 } }, { saveCount: { gt: 0 } }],
      },
      select: LISTING_SELECT,
      orderBy: [{ likeCount: 'desc' }, { saveCount: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  if (!rawListings.length) {
    return [];
  }

  // Attach save/owned state if logged in — prevents WatchCard showing wrong button state
  let savedIds: Set<string> | null = null;
  let ownedIds: Set<string> | null = null;
  if (userId) {
    const ids = rawListings.map((l: any) => l.id);
    const wishlistItems = await prisma.wishlistItem.findMany({
      where: { userId, listingId: { in: ids } },
      select: { listingId: true, list: true },
    });
    savedIds = new Set(wishlistItems.filter(s => s.list === 'FAVORITES').map(s => s.listingId));
    ownedIds = new Set(wishlistItems.filter(s => s.list === 'OWNED').map(s => s.listingId));
  }

  return rawListings.map((w: any) => ({
    ...w,
    isLiked: null,
    isSaved: savedIds ? savedIds.has(w.id) : null,
    isOwned: ownedIds ? ownedIds.has(w.id) : null,
  })) as WatchWithRelations[];
}
