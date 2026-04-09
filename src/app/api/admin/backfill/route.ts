// src/app/api/admin/backfill/route.ts
// One-shot data quality backfill for existing listings.
// Fixes brand inference and HTML entity decoding without re-scraping.
// Protected — admin only.
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { prisma } from '@/lib/db';
import { inferBrand } from '@/lib/scraper/brand-inference';
import { decodeHtmlEntities } from '@/lib/format';
import { isAdmin } from '@/lib/auth/is-admin';

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

  const { task } = await req.json().catch(() => ({}));

  if (task === 'brands') {
    return runBrandBackfill();
  }
  if (task === 'html-entities') {
    return runHtmlEntityBackfill();
  }
  if (task === 'fix-zero-prices') {
    return runZeroPriceBackfill();
  }
  if (task === 'fix-counts') {
    return runCountReconciliation();
  }

  return NextResponse.json(
    { error: 'task required: "brands" | "html-entities" | "fix-zero-prices" | "fix-counts"' },
    { status: 400 },
  );
}

/** Re-infer brand for every listing currently stored as "Unknown". */
async function runBrandBackfill() {
  const listings = await prisma.watchListing.findMany({
    where: { brand: 'Unknown' },
    select: { id: true, sourceTitle: true, description: true },
  });

  let fixed = 0;
  const CHUNK = 50;

  for (let i = 0; i < listings.length; i += CHUNK) {
    const chunk = listings.slice(i, i + CHUNK);
    await Promise.all(chunk.map(async (l) => {
      const result = inferBrand(l.sourceTitle, l.description ?? undefined);
      if (result?.brand) {
        await prisma.watchListing.update({
          where: { id: l.id },
          data: { brand: result.brand },
        });
        fixed++;
      }
    }));
  }

  return NextResponse.json({ task: 'brands', total: listings.length, fixed });
}

/** Decode HTML entities in sourceTitle and model for all existing listings. */
async function runHtmlEntityBackfill() {
  const CHUNK = 200;
  let cursor: string | undefined;
  let processed = 0;
  let fixed = 0;

  // Cursor-based iteration to avoid loading entire table into memory
  while (true) {
    const listings = await prisma.watchListing.findMany({
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      take: CHUNK,
      select: { id: true, sourceTitle: true, model: true },
    });

    if (listings.length === 0) break;
    cursor = listings[listings.length - 1].id;

    await Promise.all(listings.map(async (l) => {
      processed++;
      const newTitle = decodeHtmlEntities(l.sourceTitle);
      const newModel = l.model ? decodeHtmlEntities(l.model) : l.model;

      if (newTitle !== l.sourceTitle || newModel !== l.model) {
        await prisma.watchListing.update({
          where: { id: l.id },
          data: { sourceTitle: newTitle, model: newModel },
        });
        fixed++;
      }
    }));
  }

  return NextResponse.json({ task: 'html-entities', processed, fixed });
}

/**
 * Reconcile denormalized likeCount / saveCount against the actual Like and
 * WishlistItem rows. Corrects any drift that occurred before the gt:0 guards
 * were added. Safe to run at any time — only touches rows where counts differ.
 */
async function runCountReconciliation() {
  const fixed = await prisma.$executeRaw`
    UPDATE "WatchListing"
    SET
      "likeCount"  = (SELECT COUNT(*)::int FROM "Like"         WHERE "listingId" = "WatchListing".id),
      "saveCount"  = (SELECT COUNT(*)::int FROM "WishlistItem" WHERE "listingId" = "WatchListing".id)
    WHERE
      "likeCount"  != (SELECT COUNT(*)::int FROM "Like"         WHERE "listingId" = "WatchListing".id)
      OR "saveCount" != (SELECT COUNT(*)::int FROM "WishlistItem" WHERE "listingId" = "WatchListing".id)
  `;
  return NextResponse.json({ task: 'fix-counts', fixed });
}

/**
 * Normalize price: 0 → null for legacy listings.
 * price:0 was stored before parsePrice() returned null for zero values.
 * A zero price sorts before all priced listings in price-asc and is
 * indistinguishable from "Price on request" in the UI — null is correct.
 */
async function runZeroPriceBackfill() {
  const result = await prisma.watchListing.updateMany({
    where: { price: 0 },
    data: { price: null },
  });
  return NextResponse.json({ task: 'fix-zero-prices', fixed: result.count });
}
