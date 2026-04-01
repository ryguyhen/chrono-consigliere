// src/app/watch/[id]/page.tsx
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { getWatchById } from '@/lib/watches/queries';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import Image from 'next/image';
import { WatchRollActions } from '@/components/watches/WatchRollActions';
import { decodeHtmlEntities } from '@/lib/format';

// DISCLAIMER: This page links to the original dealer website for purchase.
// Chrono Consigliere is not a seller.

interface PageProps { params: { id: string } }

export async function generateMetadata({ params }: PageProps) {
  const watch = await getWatchById(params.id);
  if (!watch) return { title: 'Watch not found' };
  const model = decodeHtmlEntities(watch.model ?? watch.sourceTitle);
  return {
    title: `${watch.brand} ${model} — Chrono Consigliere`,
    description: watch.description?.slice(0, 155),
  };
}

const CONDITION_LABEL: Record<string, string> = {
  UNWORN: 'Unworn', MINT: 'Mint', EXCELLENT: 'Excellent',
  VERY_GOOD: 'Very Good', GOOD: 'Good', FAIR: 'Fair',
};

export default async function WatchDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  const watch = await getWatchById(params.id, userId);

  if (!watch || !watch.isAvailable) notFound();

  // Get friend likes if logged in
  let friendLikes: { username: string; displayName: string | null }[] = [];
  if (userId) {
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map(f => f.followingId);
    if (followingIds.length) {
      const likes = await prisma.like.findMany({
        where: { listingId: watch.id, userId: { in: followingIds } },
        include: { user: { include: { profile: true } } },
        take: 5,
      });
      friendLikes = likes.map(l => ({
        username: l.user.profile?.username ?? 'unknown',
        displayName: l.user.profile?.displayName ?? l.user.name,
      }));
    }
  }

  const price = watch.sourcePrice ?? (watch.price ? `$${(watch.price / 100).toLocaleString()}` : null);
  const primaryImage = watch.images?.[0];
  const allImages = watch.images;
  const displayTitle = decodeHtmlEntities(watch.model || watch.sourceTitle);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="px-4 sm:px-6 py-3 bg-surface border-b border-[var(--border)] flex items-center gap-2 text-[12px] text-muted overflow-hidden">
        <Link href="/browse" className="hover:text-ink flex-shrink-0">Browse</Link>
        <span className="flex-shrink-0">/</span>
        <Link href={`/browse?brand=${encodeURIComponent(watch.brand)}`} className="hover:text-ink flex-shrink-0">{watch.brand}</Link>
        <span className="flex-shrink-0">/</span>
        <span className="text-ink truncate">{displayTitle}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] min-h-[calc(100vh-96px)]">
        {/* Image panel */}
        <div className="bg-[#161616] flex flex-col items-center justify-center p-4 sm:p-8 min-h-[300px] sm:min-h-[400px]">
          <div className="relative w-full max-w-[500px] aspect-square rounded-lg overflow-hidden">
            {primaryImage ? (
              <Image
                src={primaryImage.url}
                alt={primaryImage.altText ?? displayTitle}
                fill
                sizes="500px"
                className="object-contain"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 rounded-full border-4 border-ink/10 flex items-center justify-center">
                  <div className="w-36 h-36 rounded-full border-2 border-ink/[0.07] flex items-center justify-center">
                    <div className="font-mono text-[9px] tracking-widest uppercase text-ink/20">Dial</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {allImages.length > 1 && (
            <div className="flex gap-2 mt-4 flex-wrap justify-center">
              {allImages.slice(0, 6).map((img, i) => (
                <div key={img.id} className="relative w-16 h-16 rounded border border-[var(--border)] overflow-hidden bg-white">
                  <Image src={img.url} alt={`Image ${i + 1}`} fill sizes="64px" className="object-cover" />
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-muted/60 mt-4 text-center italic max-w-[320px]">
            All photos from {watch.source.name}. View the original listing for complete photography.
          </p>
        </div>

        {/* Info panel */}
        <div className="bg-surface lg:border-l border-t lg:border-t-0 border-[var(--border)] p-5 sm:p-7 overflow-y-auto">
          <div className="text-[11px] font-medium tracking-[0.14em] uppercase text-gold mb-1.5">{watch.brand}</div>
          <h1 className="text-[1.8rem] font-semibold leading-tight tracking-[-0.03em] mb-2">{displayTitle}</h1>
          {watch.reference && (
            <div className="font-mono text-[12px] text-muted mb-5">Ref. {watch.reference}{watch.year ? ` · ${watch.year}` : ''}</div>
          )}

          {/* Price */}
          <div className="text-[2.2rem] font-semibold tracking-[-0.03em] mb-1">{price ?? 'Price on request'}</div>
          <div className="flex items-center gap-1.5 text-[12px] text-[var(--success)] font-medium mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] inline-block" />
            In Stock
            {watch.condition && ` — ${CONDITION_LABEL[watch.condition] ?? watch.condition}`}
          </div>

          {/* Friend social proof */}
          {friendLikes.length > 0 && (
            <div className="flex items-center gap-2.5 p-3 bg-gold/[0.07] border border-gold/20 rounded mb-5 text-[12px]">
              <div className="flex">
                {friendLikes.slice(0, 3).map((f, i) => (
                  <div key={f.username} className="w-6 h-6 rounded-full bg-gold text-black text-[8px] flex items-center justify-center font-bold border-2 border-surface" style={{ marginLeft: i > 0 ? '-6px' : 0 }}>
                    {(f.displayName ?? f.username)[0].toUpperCase()}
                  </div>
                ))}
              </div>
              <span className="text-ink/70">
                {friendLikes.slice(0, 2).map(f => f.displayName ?? f.username).join(' & ')}
                {friendLikes.length > 2 && ` +${friendLikes.length - 2} more`}
                {' '}have this in their roll
              </span>
            </div>
          )}

          {/* CTA buttons */}
          <div className="flex gap-2 mb-6 flex-col xs:flex-row sm:flex-row">
            <a
              href={watch.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-gold text-black text-[11px] font-bold tracking-[0.1em] uppercase px-5 py-3.5 rounded text-center hover:bg-gold-dark transition-colors"
            >
              View at {watch.source.name} ↗
            </a>
            <WatchRollActions
              watchId={watch.id}
              initialState={watch.isOwned ? 'owned' : watch.isSaved ? 'favorites' : 'none'}
            />
          </div>

          {/* Specs grid */}
          <div className="grid grid-cols-2 gap-px bg-[var(--border)] border border-[var(--border)] rounded overflow-hidden mb-5">
            {[
              ['Case size', watch.caseSizeMm ? `${watch.caseSizeMm}mm` : null],
              ['Material', watch.caseMaterial],
              ['Movement', watch.movementType ? { AUTOMATIC: 'Automatic', MANUAL: 'Manual Wind', QUARTZ: 'Quartz', SPRINGDRIVE: 'Spring Drive' }[watch.movementType] : null],
              ['Style', watch.style?.replace('_', ' ')],
              ['Year', watch.year?.toString()],
              ['Condition', watch.condition ? CONDITION_LABEL[watch.condition] : null],
              ['Dial', watch.dialColor],
              ['Currency', watch.currency],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label as string} className="bg-surface px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.1em] text-muted mb-1">{label}</div>
                <div className="text-[14px] font-medium text-ink">{value}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          {watch.description && (
            <>
              <div className="text-[10px] uppercase tracking-[0.1em] text-muted mb-2 mt-5">Description</div>
              <p className="text-[14px] text-ink/80 leading-relaxed mb-5">{watch.description}</p>
            </>
          )}

          {/* Source + disclaimer */}
          <div className="border-t border-[var(--border)] pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-muted mb-0.5">Source</div>
                <div className="text-[13px] font-medium text-ink">{watch.source.name}</div>
                <a href={watch.source.baseUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted hover:text-gold font-mono">
                  {watch.source.baseUrl.replace('https://', '')}
                </a>
              </div>
              <span className="flex items-center gap-1 text-[11px] text-[var(--success)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                In stock
              </span>
            </div>
            <p className="text-[10px] text-muted/60 italic leading-relaxed">
              Purchases are completed directly on {watch.source.name}'s website.
              Chrono Consigliere is a discovery layer — we are not a seller and make
              no warranties about listing accuracy or current availability.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
