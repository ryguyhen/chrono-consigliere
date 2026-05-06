// src/components/watches/SavedSearchControls.tsx
//
// Desktop + mobile UI affordances for saved Browse searches:
//   <SaveCurrentSearch />   — popover to name & save the active filter set
//   <SavedSearchesMenu />   — dropdown listing the user's saved searches
//
// The mobile bottom sheet renders both inline at the top of its scroll area;
// see BrowseFilters.tsx for the integration. Both components no-op for
// signed-out users (the parent decides whether to mount them based on session).

'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fromUrlSearchParams, toBrowseUrl, NAME_MAX_LEN } from '@/lib/watches/saved-search';

interface SavedSearch {
  id: string;
  name: string;
  url: string;
  filters: Record<string, unknown>;
}

// ─── Shared API client ────────────────────────────────────────────────────────

async function fetchSavedSearches(): Promise<SavedSearch[]> {
  const res = await fetch('/api/me/saved-searches', { cache: 'no-store' });
  if (res.status === 401) return [];
  if (!res.ok) throw new Error(`Failed to load saved searches (${res.status})`);
  const json = await res.json();
  return json.savedSearches ?? [];
}

async function createSavedSearch(name: string, filters: Record<string, unknown>): Promise<SavedSearch> {
  const res = await fetch('/api/me/saved-searches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, filters }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? `Save failed (${res.status})`);
  return json.savedSearch;
}

async function deleteSavedSearch(id: string): Promise<void> {
  const res = await fetch(`/api/me/saved-searches/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error ?? `Delete failed (${res.status})`);
  }
}

// ─── Save current filters ─────────────────────────────────────────────────────

interface SaveCurrentSearchProps {
  /** Whether the user has any active filters (parent computes from URL state) */
  /** True when there's something to save: at least one filter or a search query */
  canSave: boolean;
  /** Bumped after a successful save so other widgets can refresh their list */
  onSaved?: () => void;
  className?: string;
}

export function SaveCurrentSearch({ canSave, onSaved, className }: SaveCurrentSearchProps) {
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!canSave) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const filters = fromUrlSearchParams(new URLSearchParams(params.toString()));
      await createSavedSearch(name.trim(), filters as Record<string, unknown>);
      setOpen(false);
      setName('');
      onSaved?.();
    } catch (err: any) {
      setError(err.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-[var(--border)] rounded bg-parchment text-ink/75 hover:text-ink hover:border-ink/30 whitespace-nowrap transition-colors"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        Save
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-40 bg-surface border border-[var(--border)] rounded shadow-lg p-3 w-[280px]" role="dialog">
          <form onSubmit={submit}>
            <label className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted block mb-1.5">
              Name this search
            </label>
            <input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={NAME_MAX_LEN}
              placeholder="e.g. Rolex under $20k"
              className="w-full px-2 py-1.5 text-[12px] border border-[var(--border)] rounded bg-cream text-ink outline-none focus:border-gold mb-2"
            />
            {error && <div className="text-[11px] text-red-600 mb-2">{error}</div>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setOpen(false); setName(''); setError(null); }}
                className="px-3 py-1.5 text-[11px] text-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || saving}
                className="px-3 py-1.5 text-[11px] bg-gold text-black font-mono uppercase tracking-[0.08em] rounded disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Saved searches dropdown ──────────────────────────────────────────────────

interface SavedSearchesMenuProps {
  /** When this number changes, the menu refetches its list */
  refreshKey?: number;
  className?: string;
}

export function SavedSearchesMenu({ refreshKey = 0, className }: SavedSearchesMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SavedSearch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchSavedSearches());
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch when opened, or when parent signals a save happened.
  useEffect(() => {
    if (open) load();
  }, [open, refreshKey, load]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function apply(s: SavedSearch) {
    router.push(s.url);
    setOpen(false);
  }

  async function remove(s: SavedSearch) {
    if (!confirm(`Delete saved search "${s.name}"?`)) return;
    try {
      await deleteSavedSearch(s.id);
      setItems(curr => (curr ?? []).filter(x => x.id !== s.id));
    } catch (err: any) {
      alert(err.message ?? 'Delete failed');
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-[var(--border)] rounded bg-parchment text-ink/75 hover:text-ink hover:border-ink/30 whitespace-nowrap transition-colors"
      >
        Saved
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={`opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">
          <polyline points="3 4.5 6 7.5 9 4.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-40 bg-surface border border-[var(--border)] rounded shadow-lg w-[280px] max-h-[60vh] overflow-y-auto" role="dialog">
          {loading && items === null ? (
            <div className="px-3 py-3 text-[12px] text-muted">Loading…</div>
          ) : !items || items.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-muted">
              No saved searches yet. Apply some filters and click Save.
            </div>
          ) : (
            <ul className="py-1">
              {items.map(s => (
                <li key={s.id} className="flex items-center gap-1 px-1">
                  <button
                    onClick={() => apply(s)}
                    className="flex-1 text-left px-2 py-2 text-[12px] text-ink hover:bg-ink/5 rounded truncate"
                    title={s.name}
                  >
                    {s.name}
                  </button>
                  <button
                    onClick={() => remove(s)}
                    aria-label={`Delete ${s.name}`}
                    className="px-2 py-2 text-muted hover:text-red-600 text-[14px] leading-none"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Mobile inline list (used inside the bottom sheet) ────────────────────────
//
// Intentionally simpler than the dropdown: always-visible list, separator
// between sections, no popover. Parent shows it above the facet sections.

export function MobileSavedSearchList({
  canSave,
  onApplied,
  refreshKey = 0,
}: { canSave: boolean; onApplied: () => void; refreshKey?: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [items, setItems] = useState<SavedSearch[] | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setItems(await fetchSavedSearches());
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const filters = fromUrlSearchParams(new URLSearchParams(params.toString()));
      await createSavedSearch(name.trim(), filters as Record<string, unknown>);
      setName('');
      setShowSave(false);
      await load();
    } catch (err: any) {
      setError(err.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: SavedSearch) {
    if (!confirm(`Delete saved search "${s.name}"?`)) return;
    try {
      await deleteSavedSearch(s.id);
      setItems(curr => (curr ?? []).filter(x => x.id !== s.id));
    } catch (err: any) {
      alert(err.message ?? 'Delete failed');
    }
  }

  function apply(s: SavedSearch) {
    router.push(s.url);
    onApplied();
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-muted">Saved searches</span>
        {canSave && !showSave && (
          <button
            onClick={() => setShowSave(true)}
            className="font-mono text-[9px] tracking-[0.16em] uppercase text-gold"
          >
            + Save current
          </button>
        )}
      </div>

      {showSave && (
        <form onSubmit={save} className="mb-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={NAME_MAX_LEN}
            placeholder="Name this search"
            className="w-full px-2 py-2 text-[13px] border border-[var(--border)] rounded bg-cream text-ink outline-none focus:border-gold mb-2"
            autoFocus
          />
          {error && <div className="text-[11px] text-red-600 mb-2">{error}</div>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowSave(false); setName(''); setError(null); }}
              className="flex-1 py-2 text-[12px] border border-[var(--border)] rounded text-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="flex-1 py-2 text-[12px] bg-gold text-black font-mono uppercase tracking-[0.08em] rounded disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {items === null ? null : items.length === 0 ? (
        <div className="text-[12px] text-muted py-1">No saved searches yet.</div>
      ) : (
        <ul className="space-y-px">
          {items.map(s => (
            <li key={s.id} className="flex items-center gap-1">
              <button
                onClick={() => apply(s)}
                className="flex-1 text-left py-2 text-[13px] text-ink hover:text-gold truncate"
                title={s.name}
              >
                {s.name}
              </button>
              <button
                onClick={() => remove(s)}
                aria-label={`Delete ${s.name}`}
                className="px-2 py-2 text-muted text-[16px] leading-none"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
