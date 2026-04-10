'use client';
// Unified Save / Owned action buttons for the watch detail page.
// Single state prevents the two actions going out of sync.
// "Save" is the primary action (~90% of use); "Owned" is a secondary record.
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';

type ListState = 'none' | 'favorites' | 'owned';
type LoadingTarget = 'favorites' | 'owned' | null;

interface Props {
  watchId: string;
  initialState: ListState;
}

export function WatchRollActions({ watchId, initialState }: Props) {
  const [state, setState] = useState<ListState>(initialState);
  const [loadingTarget, setLoadingTarget] = useState<LoadingTarget>(null);
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  async function setList(target: 'favorites' | 'owned') {
    if (status === 'unauthenticated') {
      router.push(`/login?from=${encodeURIComponent(pathname)}&action=${target === 'owned' ? 'owned' : 'save'}`);
      return;
    }
    setLoadingTarget(target);
    const isRemoving = state === target;
    if (isRemoving) {
      const res = await fetch(`/api/saves/${watchId}`, { method: 'DELETE' });
      if (res.ok) setState('none');
    } else {
      const res = await fetch(`/api/saves/${watchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list: target === 'owned' ? 'OWNED' : 'FAVORITES' }),
      });
      if (res.ok) setState(target);
    }
    setLoadingTarget(null);
  }

  const savingFavorites = loadingTarget === 'favorites';
  const savingOwned = loadingTarget === 'owned';

  return (
    <div className="flex gap-2 flex-1">
      {/* Primary: Save to Roll */}
      <button
        onClick={() => setList('favorites')}
        disabled={loadingTarget !== null}
        aria-pressed={state === 'favorites'}
        className={`flex-1 px-4 py-3 rounded text-[11px] font-bold tracking-[0.1em] uppercase transition-colors disabled:opacity-60
          ${state === 'favorites'
            ? 'bg-gold text-black hover:bg-gold-dark'
            : 'border border-[var(--border)] text-muted hover:border-gold hover:text-gold'}`}
      >
        {savingFavorites ? '…' : state === 'favorites' ? '✓ Saved' : 'Save'}
      </button>

      {/* Secondary: Mark as owned — narrower, visually de-emphasized when unsaved */}
      <button
        onClick={() => setList('owned')}
        disabled={loadingTarget !== null}
        aria-pressed={state === 'owned'}
        className={`px-4 py-3 rounded text-[11px] font-bold tracking-[0.1em] uppercase transition-colors disabled:opacity-60
          ${state === 'owned'
            ? 'bg-gold text-black hover:bg-gold-dark'
            : 'border border-[var(--border)] text-muted/70 hover:border-gold/60 hover:text-gold'}`}
      >
        {savingOwned ? '…' : state === 'owned' ? '✓ Owned' : 'Owned'}
      </button>
    </div>
  );
}
