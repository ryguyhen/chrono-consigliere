// src/components/watches/WatchCard.tsx
'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import type { WatchWithRelations } from '@/types';

interface WatchCardProps {
  watch: WatchWithRelations;
  onLike?: (id: string, liked: boolean) => void;
  onSave?: (id: string, saved: boolean) => void;
}

function formatPrice(cents: number | null, currency = 'USD'): string {
  if (!cents) return 'Price on request';
  const amount = cents / 100;
  if (currency === 'JPY') return `¥${amount.toLocaleString('ja-JP')}`;
  if (currency === 'EUR') return `€${amount.toLocaleString('de-DE')}`;
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

const CONDITION_LABEL: Record<string, string> = {
  UNWORN: 'Unworn',
  MINT: 'Mint',
  EXCELLENT: 'Excellent',
  VERY_GOOD: 'V. Good',
  GOOD: 'Good',
  FAIR: 'Fair',
};

export function WatchCard({ watch, onLike, onSave }: WatchCardProps) {
  const [liked, setLiked] = useState(watch.isLiked ?? false);
  const [saved, setSaved] = useState(watch.isSaved ?? false);
  const [likeCount, setLikeCount] = useState(watch.likeCount);

  const primaryImage = watch.images?.[0];
  const friendLikeCount = watch.friendLikes?.length ?? 0;

  function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    const next = !liked;
    setLiked(next);
    setLikeCount(prev => prev + (next ? 1 : -1));
    onLike?.(watch.id, next);
    fetch(`/api/likes/${watch.id}`, { method: next ? 'POST' : 'DELETE' }).catch(() => {
      setLiked(!next);
      setLikeCount(prev => prev + (next ? -1 : 1));
    });
  }

  function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    const next = !saved;
    setSaved(next);
    onSave?.(watch.id, next);
    fetch(`/api/saves/${watch.id}`, { method: next ? 'POST' : 'DELETE' }).catch(() => setSaved(!next));
  }

  return (
    <Link
      href={`/watch/${watch.id}`}
      className="group block bg-surface overflow-hidden transition-all duration-200 hover:-translate-y-px"
    >
      {/* Image */}
      <div className="relative aspect-[4/5] bg-parchment overflow-hidden">
        {primaryImage ? (
          <Image
            src={primaryImage.url}
            alt={primaryImage.altText ?? watch.sourceTitle}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full border border-ink/8 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border border-ink/[0.05]" />
            </div>
          </div>
        )}

        {/* Hover actions */}
        <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/5 transition-colors duration-200" />
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={handleLike}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-[14px] transition-all backdrop-blur-sm
              ${liked
                ? 'bg-red-50/95 text-red-500 shadow-sm'
                : 'bg-surface/95 text-ink/50 hover:text-red-400 shadow-sm'}`}
            title={liked ? 'Unlike' : 'Like'}
          >
            {liked ? '♥' : '♡'}
          </button>
          <button
            onClick={handleSave}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] transition-all backdrop-blur-sm
              ${saved
                ? 'bg-gold/90 text-ink shadow-sm'
                : 'bg-surface/95 text-ink/50 hover:text-gold shadow-sm'}`}
            title={saved ? 'Remove from wishlist' : 'Save'}
          >
            {saved ? '◈' : '◇'}
          </button>
        </div>

        {/* Condition — minimal */}
        {watch.condition && watch.condition !== 'GOOD' && watch.condition !== 'VERY_GOOD' && (
          <div className="absolute bottom-3 left-3 text-[9px] tracking-[0.08em] uppercase px-2 py-0.5 bg-ink/80 text-cream/80 rounded-sm backdrop-blur-sm">
            {CONDITION_LABEL[watch.condition]}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="pt-3 pb-1">
        <div className="text-[9px] font-medium tracking-[0.14em] uppercase text-muted mb-1">
          {watch.brand}
        </div>
        <div className="font-serif text-[15px] font-normal text-ink leading-snug mb-2">
          {watch.model || watch.sourceTitle}
        </div>

        <div className="flex items-baseline justify-between">
          <div className="font-serif text-[17px] font-light text-ink">
            {watch.sourcePrice ?? formatPrice(watch.price, watch.currency)}
          </div>
          {friendLikeCount > 0 ? (
            <span className="text-[10px] text-muted italic">
              {friendLikeCount === 1 ? 'In your circle' : `${friendLikeCount} in your circle`}
            </span>
          ) : likeCount > 0 ? (
            <span className="text-[10px] text-muted/70 font-mono">{likeCount}</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
