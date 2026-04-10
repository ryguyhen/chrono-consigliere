// src/components/watches/WatchCard.tsx
'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import type { WatchWithRelations } from '@/types';
import { decodeHtmlEntities, formatPrice } from '@/lib/format';
import { CONDITION_LABEL_SHORT } from '@/lib/watches/display';
import { saveListing, unsaveListing } from '@/lib/api/client';

interface WatchCardProps {
  watch: WatchWithRelations;
  onSave?: (id: string, saved: boolean) => void;
  priority?: boolean;
}

export function WatchCard({ watch, onSave, priority = false }: WatchCardProps) {
  const [saved, setSaved] = useState(watch.isSaved ?? false);
  const isOwned = watch.isOwned ?? false;
  const friendCount = watch.friendLikes?.length ?? 0;
  const displayTitle = decodeHtmlEntities(watch.model || watch.sourceTitle);
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  async function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    if (isOwned) return;
    if (status === 'unauthenticated') {
      router.push(`/login?from=${encodeURIComponent(pathname)}&action=save`);
      return;
    }
    const next = !saved;
    setSaved(next);
    onSave?.(watch.id, next);
    const result = await (next ? saveListing(watch.id) : unsaveListing(watch.id));
    if (!result.ok) setSaved(!next); // revert on failure
  }

  const primaryImage = watch.images?.[0];

  return (
    <Link
      href={`/watch/${watch.id}`}
      className="group block overflow-hidden transition-all duration-200 hover:-translate-y-px"
    >
      {/* Image */}
      <div className="relative aspect-[4/5] bg-[#1A1A1A] overflow-hidden">
        {primaryImage ? (
          <Image
            src={primaryImage.url}
            alt={primaryImage.altText ?? displayTitle}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            priority={priority}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full border border-white/8 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border border-white/[0.05]" />
            </div>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/8 transition-colors duration-200" />

        {/* Save / owned button — always visible on mobile (44×44 touch target), hover-reveal on desktop */}
        {isOwned ? (
          <div className="absolute top-2.5 right-2.5 font-mono text-[8px] tracking-[0.1em] uppercase px-2 py-0.5 bg-gold text-black rounded-sm font-bold">
            Owned
          </div>
        ) : (
          <button
            onClick={handleSave}
            aria-label={saved ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={saved}
            className={`absolute top-2.5 right-2.5 w-11 h-11 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-150
              ${saved
                ? 'bg-gold text-black opacity-100'
                : 'bg-black/60 text-white/70 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-gold hover:text-black'}`}
          >
            {saved
              ? <span className="text-[13px] font-bold leading-none" aria-hidden="true">✓</span>
              : <span className="text-[18px] font-light leading-none" aria-hidden="true">+</span>}
          </button>
        )}

        {/* Condition badge */}
        {watch.condition && watch.condition !== 'GOOD' && watch.condition !== 'VERY_GOOD' && (
          <div className="absolute bottom-3 left-3 font-mono text-[8px] tracking-[0.1em] uppercase px-2 py-0.5 bg-black/75 text-white/75 rounded-sm">
            {CONDITION_LABEL_SHORT[watch.condition]}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="pt-3 pb-1">
        <div className="font-mono text-[9px] font-medium tracking-[0.14em] uppercase text-muted mb-1">
          {watch.brand}
        </div>
        <div className="text-[14px] font-medium text-ink leading-snug tracking-[-0.01em]">
          {displayTitle}
        </div>
        {/* Case size — key comparison metric, shown when available */}
        {watch.caseSizeMm && (
          <div className="text-[11px] text-muted/60 mt-0.5 mb-1.5">{watch.caseSizeMm}mm</div>
        )}
        {!watch.caseSizeMm && <div className="mb-2" />}

        <div className="flex items-baseline justify-between">
          <div className="text-[15px] font-normal text-ink tracking-[-0.01em]">
            {formatPrice(watch.price, watch.currency)}
          </div>
          {/* Social proof: friends override raw save count when present */}
          {friendCount > 0 ? (
            <span className="text-[10px] text-gold font-mono">
              {friendCount === 1 ? 'In your circle' : `${friendCount} in circle`}
            </span>
          ) : (watch.saveCount ?? 0) > 5 ? (
            <span className="text-[10px] text-muted/60 font-mono">{watch.saveCount} saved</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
