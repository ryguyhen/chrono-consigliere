'use client';
// Unified Favorites / Owned action buttons for the watch detail page.
// A single piece of state prevents the two buttons from going out of sync.
import { useState } from 'react';

type ListState = 'none' | 'favorites' | 'owned';

interface Props {
  watchId: string;
  initialState: ListState;
}

export function WatchRollActions({ watchId, initialState }: Props) {
  const [state, setState] = useState<ListState>(initialState);
  const [loading, setLoading] = useState(false);

  async function setList(target: 'favorites' | 'owned') {
    setLoading(true);
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
    setLoading(false);
  }

  return (
    <div className="flex gap-2 flex-1">
      <button
        onClick={() => setList('favorites')}
        disabled={loading}
        className={`flex-1 px-4 py-3 rounded text-[11px] font-bold tracking-[0.1em] uppercase transition-colors disabled:opacity-50
          ${state === 'favorites'
            ? 'bg-gold text-black hover:bg-gold-dark'
            : 'border border-[var(--border)] text-muted hover:border-gold hover:text-gold'}`}
      >
        {state === 'favorites' ? '✓ Favorited' : '+ Favorites'}
      </button>
      <button
        onClick={() => setList('owned')}
        disabled={loading}
        className={`flex-1 px-4 py-3 rounded text-[11px] font-bold tracking-[0.1em] uppercase transition-colors disabled:opacity-50
          ${state === 'owned'
            ? 'bg-gold text-black hover:bg-gold-dark'
            : 'border border-[var(--border)] text-muted hover:border-gold hover:text-gold'}`}
      >
        {state === 'owned' ? '✓ Owned' : 'Mark Owned'}
      </button>
    </div>
  );
}
