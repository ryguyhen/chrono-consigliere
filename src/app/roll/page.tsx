// src/app/roll/page.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { prisma } from '@/lib/db';
import { WatchCard } from '@/components/watches/WatchCard';
import { UnavailableWatchCard } from '@/components/watches/UnavailableWatchCard';
import Link from 'next/link';
import type { WatchWithRelations } from '@/types';

interface PageProps {
  searchParams: { tab?: string; collection?: string };
}

export default async function RollPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  // Legacy redirect
  if (searchParams.tab === 'friends') redirect('/friends');

  const userId = session.user.id;
  const activeTab = searchParams.tab === 'owned' ? 'owned' : 'favorites';
  const activeCollectionId = activeTab === 'favorites' ? searchParams.collection : undefined;

  const [collections, favoritesCount, ownedCount, saves] = await Promise.all([
    prisma.collection.findMany({
      where: { userId },
      include: { _count: { select: { items: true } } },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.wishlistItem.count({ where: { userId, list: 'FAVORITES' } }),
    prisma.wishlistItem.count({ where: { userId, list: 'OWNED' } }),
    prisma.wishlistItem.findMany({
      where: {
        userId,
        list: activeTab === 'owned' ? 'OWNED' : 'FAVORITES',
        ...(activeCollectionId ? { collectionId: activeCollectionId } : {}),
      },
      include: {
        listing: {
          include: {
            source: { select: { id: true, name: true, slug: true, baseUrl: true } },
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const activeCollection = collections.find(c => c.id === activeCollectionId);

  return (
    <div>
      {/* Combined header + tabs — h1 suppressed on mobile (bottom nav labels this "WatchRoll") */}
      <div className="border-b border-[var(--border)]">
        <div className="max-w-[1040px] mx-auto px-4 sm:px-6">
          <h1 className="hidden md:block text-[1.4rem] font-semibold tracking-[-0.03em] pt-5 pb-3">
            WatchRoll
          </h1>
          <div className="flex">
            <Link
              href="/roll"
              className={`px-4 py-3.5 text-[11px] font-mono tracking-[0.1em] uppercase border-b-2 transition-colors
                ${activeTab === 'favorites'
                  ? 'border-gold text-gold'
                  : 'border-transparent text-muted hover:text-ink'}`}
            >
              Favorites {favoritesCount > 0 && <span className="ml-1 opacity-60">({favoritesCount})</span>}
            </Link>
            <Link
              href="/roll?tab=owned"
              className={`px-4 py-3.5 text-[11px] font-mono tracking-[0.1em] uppercase border-b-2 transition-colors
                ${activeTab === 'owned'
                  ? 'border-gold text-gold'
                  : 'border-transparent text-muted hover:text-ink'}`}
            >
              Owned {ownedCount > 0 && <span className="ml-1 opacity-60">({ownedCount})</span>}
            </Link>
          </div>
        </div>
      </div>

      {/* Collection filter — Favorites tab only */}
      {activeTab === 'favorites' && collections.length > 0 && (
        <div className="border-b border-[var(--border)] px-6 py-3 flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          <Link
            href="/roll"
            className={`px-3.5 py-1.5 rounded-full font-mono text-[10px] tracking-[0.06em] border whitespace-nowrap transition-colors
              ${!activeCollectionId
                ? 'bg-gold text-black border-gold font-bold'
                : 'border-[var(--border)] text-muted hover:border-gold/50 hover:text-gold'}`}
          >
            All ({favoritesCount})
          </Link>
          {collections.map(col => (
            <Link
              key={col.id}
              href={`/roll?collection=${col.id}`}
              className={`px-3.5 py-1.5 rounded-full font-mono text-[10px] tracking-[0.06em] border whitespace-nowrap transition-colors
                ${activeCollectionId === col.id
                  ? 'bg-gold text-black border-gold font-bold'
                  : 'border-[var(--border)] text-muted hover:border-gold/50 hover:text-gold'}`}
            >
              {col.name} ({col._count.items})
            </Link>
          ))}
        </div>
      )}

      {/* Watch grid */}
      <div className="px-4 sm:px-6 py-4 sm:py-6">
        {saves.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-5">
            {saves.map((s, i) => (
              s.listing.isAvailable
                ? <WatchCard
                    key={s.id}
                    watch={{ ...s.listing, isLiked: false, isSaved: activeTab === 'favorites', isOwned: activeTab === 'owned', friendLikes: [] } as WatchWithRelations}
                    priority={i < 6}
                  />
                : <UnavailableWatchCard
                    key={s.id}
                    listingId={s.listing.id}
                    brand={s.listing.brand}
                    title={s.listing.model || s.listing.sourceTitle}
                  />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <div className="text-3xl mb-5 opacity-15">◇</div>
            {activeTab === 'favorites' ? (
              <>
                <div className="text-[1.1rem] font-semibold mb-2">
                  {activeCollection ? `${activeCollection.name} is empty` : 'No favorites yet'}
                </div>
                <p className="text-[13px] text-muted mb-5">
                  {activeCollection ? 'Add some watches to get started.' : 'Save watches you want to track.'}
                </p>
              </>
            ) : (
              <>
                <div className="text-[1.1rem] font-semibold mb-2">Nothing owned yet</div>
                <p className="text-[13px] text-muted mb-5">Mark a watch as owned after you buy it.</p>
              </>
            )}
            <Link href="/browse" className="font-mono text-[10px] tracking-[0.1em] uppercase text-gold hover:text-gold-dark transition-colors">
              Browse watches →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
