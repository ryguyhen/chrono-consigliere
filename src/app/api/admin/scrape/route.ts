// src/app/api/admin/scrape/route.ts
// Triggers a scrape job for one or all active sources.
// Protected — admin only in production.
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { prisma } from '@/lib/db';
import { runScrapeJob } from '@/lib/scraper/scrape-runner';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);

function isAdmin(email: string | null | undefined) {
  if (!email) return false;
  if (process.env.NODE_ENV === 'development') return true; // allow all in dev
  return ADMIN_EMAILS.includes(email);
}

function hasCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

async function requireAdmin(req: Request): Promise<boolean> {
  if (hasCronAuth(req)) return true;
  const session = await getServerSession(authOptions);
  return isAdmin(session?.user?.email);
}

export async function POST(req: Request) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { sourceId, all, debug, noPlaywright, maxPages } = await req.json().catch(() => ({}));

  // Apply request-level overrides so adapters pick them up via process.env
  if (noPlaywright) process.env.SCRAPER_NO_PLAYWRIGHT = 'true';
  if (maxPages) process.env.SCRAPER_MAX_PAGES = String(maxPages);
  if (debug) process.env.SCRAPER_DEBUG = 'true';

  if (all) {
    const sources = await prisma.dealerSource.findMany({ where: { isActive: true } });
    // Run sequentially in background to avoid spawning multiple Playwright instances simultaneously
    ;(async () => {
      for (const source of sources) {
        try {
          await runScrapeJob(source.id);
        } catch (err) {
          console.error(`Scrape job failed for ${source.id}:`, err);
        }
      }
    })();
    return NextResponse.json({ queued: sources.length, sourceIds: sources.map(s => s.id) });
  }

  if (!sourceId)
    return NextResponse.json({ error: 'sourceId or all:true required' }, { status: 400 });

  if (debug) {
    // Await and return full result for debugging
    const result = await runScrapeJob(sourceId);
    return NextResponse.json({ sourceId, result });
  }

  // Fire in background
  runScrapeJob(sourceId).catch(console.error);
  return NextResponse.json({ queued: 1, sourceId });
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { slug, isActive } = await req.json().catch(() => ({}));
  if (!slug || typeof isActive !== 'boolean')
    return NextResponse.json({ error: 'slug and isActive (boolean) required' }, { status: 400 });

  const source = await prisma.dealerSource.findUnique({ where: { slug } });
  if (!source) return NextResponse.json({ error: `No source with slug: ${slug}` }, { status: 404 });

  await prisma.dealerSource.update({ where: { slug }, data: { isActive } });
  return NextResponse.json({ slug, isActive });
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { slug } = await req.json().catch(() => ({}));
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

  const source = await prisma.dealerSource.findUnique({ where: { slug } });
  if (!source) return NextResponse.json({ error: `No source with slug: ${slug}` }, { status: 404 });

  const listings = await prisma.watchListing.findMany({
    where: { sourceId: source.id },
    select: { id: true },
  });
  const listingIds = listings.map(l => l.id);

  // ActivityFeedEvent.listingId is optional — null it out (no cascade)
  await prisma.activityFeedEvent.updateMany({
    where: { listingId: { in: listingIds } },
    data: { listingId: null },
  });

  // PurchaseEvent.listingId is required with no cascade — delete first
  await prisma.purchaseEvent.deleteMany({ where: { listingId: { in: listingIds } } });

  // Listings (cascades WatchImage, WatchTag, Like, SavedListing, CollectionItem)
  const deletedListings = await prisma.watchListing.deleteMany({ where: { sourceId: source.id } });

  // Scrape jobs (cascades ScrapeJobLog)
  const deletedJobs = await prisma.scrapeJob.deleteMany({ where: { sourceId: source.id } });

  await prisma.dealerSource.delete({ where: { id: source.id } });

  return NextResponse.json({
    deleted: slug,
    listingsRemoved: deletedListings.count,
    jobsRemoved: deletedJobs.count,
  });
}

export async function GET(req: Request) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const recentJobs = await prisma.scrapeJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      source: { select: { name: true, slug: true } },
      logs: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });

  return NextResponse.json({ jobs: recentJobs });
}
