// src/components/watches/WatchCard.tsx
'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import type { WatchWithRelations } from '@/types';

interface WatchCardProps {
  watch: WatchWithRelations;
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

export function WatchCard({ watch, onSave }: WatchCardProps) {
  const [saved, setSaved] = useState(watch.isSaved ?? false);
  const friendCount = watch.friendLikes?.length ?? 0;

  function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    const next = !saved;
    setSaved(next);
    onSave?.(watch.id, next);
    fetch(`/api/saves/${watch.id}`, { method: next ? 'POST' : 'DELETE' }).catch(() => setSaved(!next));
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
            alt={primaryImage.altText ?? watch.sourceTitle}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
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

        {/* Save button */}
        <button
          onClick={handleSave}
          className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150
            ${saved
              ? 'bg-gold text-black opacity-100'
              : 'bg-black/60 text-white/70 opacity-0 group-hover:opacity-100 hover:bg-gold hover:text-black'}`}
          title={saved ? 'Remove from roll' : 'Add to roll'}
        >
          {saved
            ? <span className="text-[13px] font-bold leading-none">✓</span>
            : <span className="text-[18px] font-light leading-none">+</span>}
        </button>

        {/* Condition badge */}
        {watch.condition && watch.condition !== 'GOOD' && watch.condition !== 'VERY_GOOD' && (
          <div className="absolute bottom-3 left-3 font-mono text-[8px] tracking-[0.1em] uppercase px-2 py-0.5 bg-black/75 text-white/75 rounded-sm">
            {CONDITION_LABEL[watch.condition]}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="pt-3 pb-1">
        <div className="font-mono text-[9px] font-medium tracking-[0.14em] uppercase text-muted mb-1">
          {watch.brand}
        </div>
        <div className="text-[14px] font-medium text-ink leading-snug mb-2 tracking-[-0.01em]">
          {watch.model || watch.sourceTitle}
        </div>

        <div className="flex items-baseline justify-between">
          <div className="text-[15px] font-normal text-ink tracking-[-0.01em]">
            {watch.sourcePrice ?? formatPrice(watch.price, watch.currency)}
          </div>
          {friendCount > 0 && (
            <span className="text-[10px] text-gold font-mono">
              {friendCount === 1 ? 'In your circle' : `${friendCount} in circle`}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
