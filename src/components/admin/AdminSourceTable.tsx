// src/components/admin/AdminSourceTable.tsx
'use client';
import { useState } from 'react';

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

export function AdminSourceTable({ sources, recentJobs }: { sources: Source[]; recentJobs: Job[] }) {
  const [scraping, setScraping] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState('');
  const [noPlaywright, setNoPlaywright] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
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
        showToast(sourceId ? `Scrape started for ${key}${suffix}` : `All ${data.queued} scrapers started${suffix}`);
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

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-ink text-cream text-[13px] px-4 py-3 rounded shadow-xl z-50 max-w-sm">
          {toast}
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
            onClick={() => showToast('Add source UI coming soon — use seed-dealers.ts for now')}
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
              {['Source', 'Platform', 'Status', 'Listings', 'Last sync', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] uppercase tracking-[0.1em] text-muted font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.map(source => {
              const lastJob = source.scrapeJobs[0];
              const status = lastJob?.status ?? (source.isActive ? 'NEVER_RUN' : 'DISABLED');
              const platform = (source.scrapeConfig?.platform as string) ?? 'shopify';

              return (
                <tr key={source.id} className="border-b border-[var(--border-soft)] hover:bg-parchment/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[13px] text-ink">{source.name}</div>
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
                      {platform}
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
                        disabled={scraping[source.id]}
                        className="text-[10px] uppercase tracking-wide px-2 py-1 border border-[var(--border)] rounded hover:border-gold hover:text-gold text-muted transition-colors disabled:opacity-50"
                      >
                        {scraping[source.id] ? '…' : 'Scrape'}
                      </button>
                      <button
                        onClick={() => showToast(`Edit ${source.name} — use DB or config file`)}
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
    </div>
  );
}
