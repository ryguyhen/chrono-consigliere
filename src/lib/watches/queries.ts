// src/lib/watches/queries.ts
// Server-side data fetching for watch listings.

import { prisma } from '@/lib/db';
import type { BrowseFilters, PaginatedWatches, WatchWithRelations } from '@/types';

const PAGE_SIZE = 24;

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

  const where: any = {
    isAvailable: true,
    duplicateOf: null, // exclude deduplicated listings
  };

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
    where.source = { slug: { in: filters.dealer } };
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

  // Attach user-specific like/save state if logged in
  let likedIds = new Set<string>();
  let savedIds = new Set<string>();
  let ownedIds = new Set<string>();
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
      isLiked: likedIds.has(w.id),
      isSaved: savedIds.has(w.id),
      isOwned: ownedIds.has(w.id),
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
  const watch = await prisma.watchListing.findUnique({
    where: { id },
    select: {
      ...LISTING_SELECT,
      images: {
        select: { id: true, url: true, isPrimary: true, altText: true },
        orderBy: { isPrimary: 'desc' },
      },
    },
  });

  if (!watch) return null;

  let isLiked = false;
  let isSaved = false;
  let isOwned = false;
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
      where: { isAvailable: true },
      _count: true,
      orderBy: { _count: { brand: 'desc' } },
      take: 60,
    }),
    prisma.watchListing.groupBy({
      by: ['style'],
      where: { isAvailable: true, style: { not: null } },
      _count: true,
    }),
    prisma.watchListing.groupBy({
      by: ['movementType'],
      where: { isAvailable: true, movementType: { not: null } },
      _count: true,
    }),
    prisma.watchListing.groupBy({
      by: ['condition'],
      where: { isAvailable: true, condition: { not: null } },
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
      isAvailable: true,
      duplicateOf: null,
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
  return listings.map(w => ({ ...w, isLiked: false, isSaved: false, isOwned: false })) as WatchWithRelations[];
}

export async function getNewArrivals(limit = 8): Promise<WatchWithRelations[]> {
  const listings = await prisma.watchListing.findMany({
    where: { isAvailable: true, duplicateOf: null },
    select: LISTING_SELECT,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return listings.map(w => ({ ...w, isLiked: false, isSaved: false, isOwned: false })) as WatchWithRelations[];
}
