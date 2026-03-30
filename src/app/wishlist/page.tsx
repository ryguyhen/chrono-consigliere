// src/app/wishlist/page.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { prisma } from '@/lib/db';
import { WatchCard } from '@/components/watches/WatchCard';
import Link from 'next/link';

export default async function WishlistPage({
  searchParams,
}: {
  searchParams: { collection?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const userId = (session.user as any).id;

  const [collections, totalSaves] = await Promise.all([
    prisma.collection.findMany({
      where: { userId },
      include: { _count: { select: { items: true } } },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.wishlistItem.count({ where: { userId } }),
  ]);

  const activeCollectionId = searchParams.collection;

  const saves = await prisma.wishlistItem.findMany({
    where: {
      userId,
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
  });

  const activeCollection = collections.find(c => c.id === activeCollectionId);

  return (
    <div>
      {/* Header */}
      <div className="bg-ink text-cream px-6 py-8">
        <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-gold/70 mb-2">Your roll</div>
        <h1 className="font-serif text-[1.8rem] font-light mb-1">
          {activeCollection ? activeCollection.name : 'Everything saved'}
        </h1>
        <div className="font-mono text-[11px] text-cream/30">
          {activeCollection
            ? `${activeCollection._count.items} watches`
            : `${totalSaves} watches`}
        </div>
      </div>

      {/* Collection tabs */}
      <div className="bg-surface border-b border-[var(--border)] px-5 py-3 flex gap-2 overflow-x-auto">
        <Link
          href="/wishlist"
          className={`px-3.5 py-1.5 rounded-full text-[11px] border whitespace-nowrap transition-colors
            ${!activeCollectionId
              ? 'bg-ink text-cream border-ink'
              : 'border-[var(--border)] text-ink/70 hover:border-gold hover:text-gold'}`}
        >
          All ({totalSaves})
        </Link>
        {collections.map(col => (
          <Link
            key={col.id}
            href={`/wishlist?collection=${col.id}`}
            className={`px-3.5 py-1.5 rounded-full text-[11px] border whitespace-nowrap transition-colors
              ${activeCollectionId === col.id
                ? 'bg-ink text-cream border-ink'
                : 'border-[var(--border)] text-ink/70 hover:border-gold hover:text-gold'}`}
          >
            {col.name} ({col._count.items})
          </Link>
        ))}
        <button className="px-3.5 py-1.5 rounded-full text-[11px] border border-dashed border-[var(--border)] text-muted hover:border-gold hover:text-gold transition-colors whitespace-nowrap">
          + New list
        </button>
      </div>

      {/* Grid */}
      <div className="px-6 py-6">
        {saves.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {saves.map(s => (
              <WatchCard
                key={s.id}
                watch={{ ...s.listing, isLiked: false, isSaved: true, friendLikes: [] } as any}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 text-muted">
            <div className="font-serif text-3xl mb-5 opacity-15">◇</div>
            <div className="font-serif text-xl font-light mb-2 text-ink">
              {activeCollection ? `${activeCollection.name} is empty` : 'Your roll is empty'}
            </div>
            <p className="text-[13px] text-muted mb-5">
              {activeCollection ? 'Add some watches to get started.' : 'Find something worth saving.'}
            </p>
            <Link href="/browse" className="font-mono text-[10px] tracking-[0.1em] uppercase text-gold hover:text-gold-dark transition-colors">
              Browse watches →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
