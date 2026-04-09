// src/components/admin/AdminSourceTable.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Source {
  id: string;
  name: string;
  slug: string;
  baseUrl: string;
  adapterName: string;
  isActive: boolean;
  lastSyncAt: string | null;
  scrapeConfig: Record<string, string>;
  _count: { listings: number };
  scrapeJobs: {
    status: string;
    completedAt: string | null;
    listingsFound: number | null;
    errorMessage: string | null;
  }[];
}

interface Job {
  id: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  listingsFound: number | null;
  listingsNew: number | null;
  listingsRemoved: number | null;
  errorMessage: string | null;
  source: { name: string };
  logs: { level: string; message: string; createdAt: string }[];
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: 'bg-green-50 text-green-700',
  RUNNING: 'bg-blue-50 text-blue-700',
  FAILED: 'bg-red-50 text-red-700',
  PENDING: 'bg-amber-50 text-amber-700',
  CANCELLED: 'bg-gray-50 text-gray-600',
};

const LOG_COLORS: Record<string, string> = {
  INFO: 'text-green-400',
  WARN: 'text-amber-400',
  ERROR: 'text-red-400',
  DEBUG: 'text-cream/30',
};

export function AdminSourceTable({
  sources,
  recentJobs,
  registeredAdapters,
  unregisteredAdapters,
}: {
  sources: Source[];
  recentJobs: Job[];
  registeredAdapters: string[];
  unregisteredAdapters: string[];
}) {
  const router = useRouter();
  const [scraping, setScraping] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState('');
  const [noPlaywright, setNoPlaywright] = useState(false);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editSource, setEditSource] = useState<Source | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  async function triggerScrape(sourceId?: string) {
    const key = sourceId ?? 'all';
    setScraping(prev => ({ ...prev, [key]: true }));
    try {
      const body = sourceId
        ? { sourceId, ...(noPlaywright ? { noPlaywright: true } : {}) }
        : { all: true, ...(noPlaywright ? { noPlaywright: true } : {}) };
      const res = await fetch('/api/admin/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        const suffix = noPlaywright ? ' (API-only)' : '';
        showToast(sourceId ? `Scrape started${suffix}` : `All ${data.queued} scrapers started${suffix}`);
      } else {
        showToast(`Error: ${data.error}`);
      }
    } catch {
      showToast('Network error — scrape may still be running');
    } finally {
      setScraping(prev => ({ ...prev, [key]: false }));
    }
  }

  function formatTime(iso: string | null) {
    if (!iso) return '—';
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  }

  function openAdd() {
    setEditSource(null);
    setModal('add');
  }

  function openEdit(s: Source) {
    setEditSource(s);
    setModal('edit');
  }

  function handleSaved() {
    setModal(null);
    setEditSource(null);
    router.refresh();
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-ink text-cream text-[13px] px-4 py-3 rounded shadow-xl z-50 max-w-sm">
          {toast}
        </div>
      )}

      {/* Unregistered adapters notice */}
      {unregisteredAdapters.length > 0 && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-[12px] text-amber-800">
          <span className="font-semibold">
            {unregisteredAdapters.length} adapter{unregisteredAdapters.length !== 1 ? 's' : ''} in code with no DB record:{' '}
          </span>
          {unregisteredAdapters.join(', ')}
          <span className="text-amber-600">
            {' '}— these won&apos;t be scraped until added.
          </span>
        </div>
      )}

      {/* Actions bar */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-[12px] font-medium text-ink">Dealer Sources ({sources.length})</div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={noPlaywright}
              onChange={e => setNoPlaywright(e.target.checked)}
              className="w-3 h-3 accent-gold"
            />
            <span className="text-[10px] uppercase tracking-wide text-muted">
              Skip Playwright <span className="normal-case text-muted/60">(low memory)</span>
            </span>
          </label>
          <button
            onClick={() => triggerScrape()}
            disabled={scraping['all']}
            className="text-[11px] uppercase tracking-wide px-3 py-1.5 border border-[var(--border)] rounded hover:border-gold hover:text-gold text-muted transition-colors disabled:opacity-50"
          >
            {scraping['all'] ? 'Running…' : 'Run all scrapers'}
          </button>
          <button
            onClick={openAdd}
            className="text-[11px] uppercase tracking-wide px-3 py-1.5 bg-gold text-ink rounded hover:bg-gold-dark transition-colors"
          >
            + Add source
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-[var(--border)] rounded-lg overflow-hidden mb-8">
        <table className="w-full">
          <thead>
            <tr className="bg-parchment border-b border-[var(--border)]">
              {['Source', 'Adapter', 'Status', 'Listings', 'Last sync', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] uppercase tracking-[0.1em] text-muted font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.map(source => {
              const lastJob = source.scrapeJobs[0];

              return (
                <tr
                  key={source.id}
                  className={`border-b border-[var(--border-soft)] hover:bg-parchment/40 transition-colors ${!source.isActive ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[13px] text-ink">{source.name}</span>
                      {!source.isActive && (
                        <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                          disabled
                        </span>
                      )}
                    </div>
                    <a
                      href={source.baseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-muted hover:text-gold"
                    >
                      {source.baseUrl.replace('https://', '')}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <code className="font-mono text-[10px] bg-parchment px-1.5 py-0.5 rounded text-ink/70">
                      {source.adapterName}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    {lastJob ? (
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium ${STATUS_STYLES[lastJob.status] ?? ''}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {lastJob.status.toLowerCase()}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted">—</span>
                    )}
                    {lastJob?.errorMessage && (
                      <div className="text-[10px] text-red-500 mt-0.5 max-w-[160px] truncate" title={lastJob.errorMessage}>
                        {lastJob.errorMessage}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px]">
                    {source._count.listings.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-muted">
                    {formatTime(source.lastSyncAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => triggerScrape(source.id)}
                        disabled={scraping[source.id] || !source.isActive}
                        className="text-[10px] uppercase tracking-wide px-2 py-1 border border-[var(--border)] rounded hover:border-gold hover:text-gold text-muted transition-colors disabled:opacity-40"
                      >
                        {scraping[source.id] ? '…' : 'Scrape'}
                      </button>
                      <button
                        onClick={() => openEdit(source)}
                        className="text-[10px] uppercase tracking-wide px-2 py-1 border border-[var(--border)] rounded hover:border-ink text-muted transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Scrape log */}
      <div>
        <div className="text-[12px] font-medium text-ink mb-3">Recent scrape log</div>
        <div className="bg-ink rounded-lg p-4 font-mono text-[11px] leading-[1.9] overflow-x-auto max-h-[360px] overflow-y-auto">
          {recentJobs.length === 0 ? (
            <div className="text-cream/30">No scrape jobs yet. Run a scraper to see logs here.</div>
          ) : (
            recentJobs.flatMap(job => [
              <div key={`${job.id}-header`} className="text-cream/40">
                [{new Date(job.createdAt).toISOString().replace('T', ' ').slice(0, 19)}]{' '}
                <span className="text-cream/60">INFO</span>{' '}
                {job.source.name}: started scrape job #{job.id.slice(-6)}
              </div>,
              ...job.logs.map(log => (
                <div key={`${job.id}-${log.createdAt}`} className={LOG_COLORS[log.level] ?? 'text-cream/50'}>
                  [{new Date(log.createdAt).toISOString().replace('T', ' ').slice(0, 19)}]{' '}
                  <span>{log.level.padEnd(5)}</span> {job.source.name}: {log.message}
                </div>
              )),
              job.status === 'COMPLETED' ? (
                <div key={`${job.id}-done`} className="text-green-400">
                  [{new Date(job.completedAt ?? job.createdAt).toISOString().replace('T', ' ').slice(0, 19)}]{' '}
                  INFO  {job.source.name}: completed — {job.listingsFound} found, {job.listingsNew} new, {job.listingsRemoved} removed
                </div>
              ) : job.status === 'FAILED' ? (
                <div key={`${job.id}-fail`} className="text-red-400">
                  ERROR {job.source.name}: {job.errorMessage ?? 'unknown error'}
                </div>
              ) : null,
            ]).filter(Boolean)
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      {modal && (
        <SourceModal
          mode={modal}
          source={editSource}
          registeredAdapters={registeredAdapters}
          onClose={() => { setModal(null); setEditSource(null); }}
          onSaved={handleSaved}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ─── Source modal ─────────────────────────────────────────────

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function SourceModal({
  mode,
  source,
  registeredAdapters,
  onClose,
  onSaved,
  showToast,
}: {
  mode: 'add' | 'edit';
  source: Source | null;
  registeredAdapters: string[];
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string) => void;
}) {
  const [name, setName] = useState(source?.name ?? '');
  const [slug, setSlug] = useState(source?.slug ?? '');
  const [adapterName, setAdapterName] = useState(source?.adapterName ?? '');
  const [baseUrl, setBaseUrl] = useState(source?.baseUrl ?? '');
  const [isActive, setIsActive] = useState(source?.isActive ?? true);
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(toSlug(v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/admin/sources', {
      method: mode === 'add' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        mode === 'add'
          ? { name, slug, adapterName, baseUrl, isActive }
          : { id: source!.id, name, slug, adapterName, baseUrl, isActive }
      ),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong');
      return;
    }

    showToast(mode === 'add' ? `Source "${name}" created` : `"${name}" updated`);
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-[var(--border)] rounded-xl p-6 w-full max-w-[440px] shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-semibold text-[15px] tracking-[-0.01em]">
            {mode === 'add' ? 'Add source' : `Edit — ${source?.name}`}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-muted mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="A Collected Man"
              required
              className="w-full px-3 py-2 border border-[var(--border)] rounded bg-parchment text-[13px] outline-none focus:border-gold transition-colors"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-muted mb-1.5">
              Slug <span className="normal-case tracking-normal text-muted/60">(unique, URL-safe)</span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={e => { setSlugTouched(true); setSlug(e.target.value); }}
              placeholder="a-collected-man"
              required
              pattern="[a-z0-9-]+"
              title="Lowercase letters, numbers, and hyphens only"
              className="w-full px-3 py-2 border border-[var(--border)] rounded bg-parchment text-[13px] font-mono outline-none focus:border-gold transition-colors"
            />
          </div>

          {/* Adapter name */}
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-muted mb-1.5">
              Adapter
            </label>
            <select
              value={adapterName}
              onChange={e => setAdapterName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[var(--border)] rounded bg-parchment text-[13px] font-mono outline-none focus:border-gold transition-colors"
            >
              <option value="">— select adapter —</option>
              {registeredAdapters.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Base URL */}
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-muted mb-1.5">
              Base URL
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://www.example.com"
              required
              className="w-full px-3 py-2 border border-[var(--border)] rounded bg-parchment text-[13px] outline-none focus:border-gold transition-colors"
            />
          </div>

          {/* isActive */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-3.5 h-3.5 accent-gold"
            />
            <span className="text-[12px] text-ink">Active <span className="text-muted">(will be included in scrape runs)</span></span>
          </label>

          {/* Error */}
          {error && (
            <div className="text-[12px] text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gold text-black text-[11px] font-bold tracking-[0.08em] uppercase py-2.5 rounded hover:bg-gold-dark transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving…' : mode === 'add' ? 'Create source' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-[var(--border)] rounded text-[11px] uppercase tracking-wide text-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
