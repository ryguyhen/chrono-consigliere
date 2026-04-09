// src/app/admin/page.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { prisma } from '@/lib/db';
import { AdminSourceTable } from '@/components/admin/AdminSourceTable';
import { listRegisteredAdapters } from '@/lib/scraper/adapter-registry';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map(s => s.trim()).filter(Boolean);

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/login');
  const isAdmin = process.env.NODE_ENV === 'development' || ADMIN_EMAILS.includes(session.user.email);
  if (!isAdmin) redirect('/');

  const [sources, recentJobs, listingStats] = await Promise.all([
    prisma.dealerSource.findMany({
      include: {
        _count: { select: { listings: { where: { isAvailable: true } } } },
        scrapeJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, completedAt: true, listingsFound: true, errorMessage: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.scrapeJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        source: { select: { name: true } },
        logs: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
    }),
    prisma.watchListing.aggregate({
      where: { isAvailable: true },
      _count: { id: true },
    }),
  ]);

  const totalListings = listingStats._count.id;
  const activeSources = sources.filter(s => s.isActive).length;

  const registeredAdapters = listRegisteredAdapters().sort();
  const sourceAdapterNames = new Set(sources.map(s => s.adapterName));
  const unregisteredAdapters = registeredAdapters.filter(a => !sourceAdapterNames.has(a));
  const lastSync = sources
    .map(s => s.lastSyncAt)
    .filter(Boolean)
    .sort()
    .pop();

  const dupes = await prisma.watchListing.count({ where: { duplicateOf: { not: null } } });

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-[1.6rem] font-light mb-1">Source Management</h1>
        <p className="text-[13px] text-muted">Manage dealer sources, scraping jobs, and inventory sync status.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          ['Total listings', totalListings.toLocaleString()],
          ['Active sources', activeSources],
          ['Last sync', lastSync ? new Date(lastSync).toLocaleTimeString() : 'Never'],
          ['Dupes found', dupes],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface border border-[var(--border)] rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.1em] text-muted mb-2">{label}</div>
            <div className="font-serif text-[1.6rem] font-light">{value}</div>
          </div>
        ))}
      </div>

      <AdminSourceTable
        sources={sources as any}
        recentJobs={recentJobs as any}
        registeredAdapters={registeredAdapters}
        unregisteredAdapters={unregisteredAdapters}
      />
    </div>
  );
}
