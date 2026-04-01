// src/lib/scraper/scrape-runner.ts
// Orchestrates a scrape job: runs the adapter, deduplicates, persists to DB,
// marks stale listings as unavailable.
// DISCLAIMER: Listings link to original dealer sites. Chrono Consigliere is not a seller.

import { prisma } from '@/lib/db';
import { getAdapter } from './adapter-registry';
import type { ScrapedListing } from './base-adapter';
import { inferBrand } from './brand-inference';
import { decodeHtmlEntities } from '@/lib/format';

export interface ScrapeJobSummary {
  sourceId: string;
  status: 'COMPLETED' | 'FAILED';
  listingsFound: number;
  listingsNew: number;
  listingsRemoved: number;
  errors: string[];
  diagnostics?: Record<string, any>;
}

export async function runScrapeJob(sourceId: string): Promise<ScrapeJobSummary> {
  // Create job record
  const job = await prisma.scrapeJob.create({
    data: { sourceId, status: 'RUNNING', startedAt: new Date() },
  });

  const source = await prisma.dealerSource.findUniqueOrThrow({
    where: { id: sourceId },
  });

  const adapter = getAdapter(source.adapterName);
  if (!adapter) {
    await failJob(job.id, `No adapter registered for: ${source.adapterName}`);
    return { sourceId, status: 'FAILED', listingsFound: 0, listingsNew: 0, listingsRemoved: 0, errors: [`No adapter registered for: ${source.adapterName}`] };
  }

  try {
    const result = await adapter.scrape();

    // --- Batch DB write ---
    // 1. One query to load all existing URLs for this source
    const existing = await prisma.watchListing.findMany({
      where: { sourceId },
      select: { id: true, sourceUrl: true },
    });
    const existingMap = new Map(existing.map(e => [e.sourceUrl, e.id]));

    const scrapedUrls = new Set(result.listings.map(l => l.sourceUrl));
    let newCount = 0;
    let updatedCount = 0;

    // 2. Process in chunks of 50 to cap memory and let GC run between batches
    const CHUNK = 50;
    for (let i = 0; i < result.listings.length; i += CHUNK) {
      const chunk = result.listings.slice(i, i + CHUNK);

      await Promise.all(chunk.map(async (listing) => {
        const data = buildListingData(listing, sourceId);
        const existingId = existingMap.get(listing.sourceUrl);

        if (existingId) {
          await prisma.watchListing.update({ where: { id: existingId }, data });
          updatedCount++;
        } else {
          const created = await prisma.watchListing.create({
            data: { ...data, sourceUrl: listing.sourceUrl },
            select: { id: true },
          });
          // Batch image inserts inline (still per-listing, but no extra select query)
          if (listing.images?.length) {
            await prisma.watchImage.createMany({
              data: listing.images.map(img => ({
                listingId: created.id,
                url: img.url,
                isPrimary: img.isPrimary,
              })),
              skipDuplicates: true,
            });
          }
          newCount++;
        }
      }));
    }

    // Mark any previously-active listings that didn't appear in this scrape as unavailable
    const removed = await prisma.watchListing.updateMany({
      where: {
        sourceId,
        isAvailable: true,
        sourceUrl: { notIn: Array.from(scrapedUrls) },
      },
      data: { isAvailable: false },
    });

    // Build error message — include diagnostics summary for visibility
    const diagSummary = result.diagnostics
      ? ` [endpoint:${result.diagnostics.endpointUsed ?? '?'} raw:${result.diagnostics.rawTotal ?? '?'} filtered:${result.diagnostics.nonWatchFiltered ?? 0}+${result.diagnostics.unavailableFiltered ?? 0}]`
      : '';
    const errorMessage = result.errors.length > 0
      ? result.errors.slice(0, 3).join(' | ') + diagSummary
      : (diagSummary || null);

    // Update job as complete
    await prisma.scrapeJob.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        listingsFound: result.listings.length,
        listingsNew: newCount,
        listingsRemoved: removed.count,
        errorMessage,
      },
    });

    // Update source lastSyncAt
    await prisma.dealerSource.update({
      where: { id: sourceId },
      data: { lastSyncAt: new Date() },
    });

    return {
      sourceId,
      status: 'COMPLETED',
      listingsFound: result.listings.length,
      listingsNew: newCount,
      listingsRemoved: removed.count,
      errors: result.errors,
      diagnostics: result.diagnostics,
    };

  } catch (err: any) {
    await failJob(job.id, err.message);
    return { sourceId, status: 'FAILED', listingsFound: 0, listingsNew: 0, listingsRemoved: 0, errors: [err.message] };
  }
}

function buildListingData(listing: ScrapedListing, sourceId: string) {
  const sourceTitle = decodeHtmlEntities(listing.sourceTitle);
  const model = listing.model ? decodeHtmlEntities(listing.model) : null;
  return {
    sourceId,
    isAvailable: listing.isAvailable,
    lastCheckedAt: new Date(),
    brand: listing.brand
      || inferBrand(sourceTitle, listing.description ?? undefined)?.brand
      || 'Unknown',
    model: model || sourceTitle,
    reference: listing.reference,
    year: listing.year,
    caseSizeMm: listing.caseSizeMm,
    caseMaterial: listing.caseMaterial,
    dialColor: listing.dialColor,
    movementType: listing.movementType,
    condition: listing.condition,
    price: listing.price,
    currency: listing.currency,
    description: listing.description,
    sourceTitle,
    sourcePrice: listing.sourcePrice,
  };
}

async function failJob(jobId: string, message: string): Promise<void> {
  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      completedAt: new Date(),
      errorMessage: message,
    },
  });
}
