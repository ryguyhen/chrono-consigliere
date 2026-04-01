#!/usr/bin/env ts-node
// scripts/backfill-dadandson-images.ts
// One-off: fetch images from each Dadandson product page and write them to the DB.
// Run this after deploying the scraper fix to populate images for existing listings
// without waiting for a full re-scrape.
//
// Usage:
//   npm run ts-node scripts/backfill-dadandson-images.ts
//   # or from project root:
//   npx ts-node --project tsconfig.json scripts/backfill-dadandson-images.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function isValidSquarespaceImageUrl(url: string | null | undefined): url is string {
  if (!url || url.startsWith('data:')) return false;
  if (!url.startsWith('https://')) return false;
  if (url.includes('images.squarespace-cdn.com')) return true;
  if (url.includes('squarespace.com')) {
    return /\.(jpe?g|png|gif|webp|avif|svg)(\?.*)?$/i.test(url);
  }
  return /\.(jpe?g|png|gif|webp|avif|svg)(\?.*)?$/i.test(url);
}

async function fetchImages(
  sourceUrl: string,
): Promise<Array<{ url: string; isPrimary: boolean }>> {
  try {
    const res = await fetch(`${sourceUrl}?format=json`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return [];
    const data = await res.json() as any;

    const productItem = Array.isArray(data?.items)
      ? data.items.find((i: any) => i.recordType === 11 || i.recordType === 2)
      : data?.item ?? null;
    if (!productItem) return [];

    // structuredContent.images — standard Squarespace
    let imgs: Array<{ url: string; isPrimary: boolean }> = (
      productItem.structuredContent?.images ?? []
    )
      .filter((img: any) => isValidSquarespaceImageUrl(img?.assetUrl))
      .map((img: any, idx: number) => ({ url: img.assetUrl as string, isPrimary: idx === 0 }));

    // item.items[] — used by dadandson-watches.com
    if (imgs.length === 0) {
      imgs = (productItem.items ?? [])
        .filter((img: any) => isValidSquarespaceImageUrl(img?.assetUrl))
        .map((img: any, idx: number) => ({ url: img.assetUrl as string, isPrimary: idx === 0 }));
    }

    if (imgs.length === 0 && isValidSquarespaceImageUrl(productItem.assetUrl)) {
      imgs = [{ url: productItem.assetUrl as string, isPrimary: true }];
    }

    return imgs;
  } catch {
    return [];
  }
}

async function main() {
  const source = await prisma.dealerSource.findFirst({
    where: { slug: 'dad-and-son-watches' },
  });
  if (!source) {
    console.error('Dad & Son Watches source not found in DB');
    process.exit(1);
  }

  const listings = await prisma.watchListing.findMany({
    where: { sourceId: source.id },
    select: { id: true, sourceUrl: true, sourceTitle: true },
  });
  console.log(`Found ${listings.length} Dadandson listings`);

  const existingImages = await prisma.watchImage.groupBy({
    by: ['listingId'],
    where: { listingId: { in: listings.map(l => l.id) } },
  });
  const hasImages = new Set(existingImages.map(e => e.listingId));
  const toFetch = listings.filter(l => !hasImages.has(l.id));
  console.log(`${hasImages.size} already have images, ${toFetch.length} need backfill`);

  let ok = 0;
  let failed = 0;

  for (let i = 0; i < toFetch.length; i++) {
    const listing = toFetch[i];
    process.stdout.write(`[${i + 1}/${toFetch.length}] ${listing.sourceTitle.slice(0, 60)}... `);

    const imgs = await fetchImages(listing.sourceUrl);
    if (imgs.length > 0) {
      await prisma.watchImage.createMany({
        data: imgs.map(img => ({
          listingId: listing.id,
          url: img.url,
          isPrimary: img.isPrimary,
        })),
        skipDuplicates: true,
      });
      console.log(`✓ ${imgs.length} image(s)`);
      ok++;
    } else {
      console.log(`✗ no images found`);
      failed++;
    }

    // 400ms rate limit between requests
    if (i < toFetch.length - 1) await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\nDone: ${ok} listings got images, ${failed} failed`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
