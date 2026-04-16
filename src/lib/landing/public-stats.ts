import { prisma } from '@/lib/db';

const ACTIVE_LISTING = { isAvailable: true, source: { isActive: true } } as const;

export async function getPublicLandingStats() {
  const [stats, dealerCount] = await Promise.all([
    prisma.watchListing.aggregate({ where: ACTIVE_LISTING, _count: { id: true } }),
    prisma.dealerSource.count({ where: { isActive: true } }),
  ]);

  return {
    inStockWatchCount: stats._count.id,
    curatedDealerCount: dealerCount,
  };
}

// Returns all active dealer sources for the homepage dealer list.
// Ordered by listing count desc (most-stocked dealers first), then name asc.
export async function getActiveDealers() {
  return prisma.dealerSource.findMany({
    where: { isActive: true },
    select: { name: true, slug: true },
    orderBy: [{ listings: { _count: 'desc' } }, { name: 'asc' }],
  });
}
