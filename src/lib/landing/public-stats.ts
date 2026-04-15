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
