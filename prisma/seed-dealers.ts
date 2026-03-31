// prisma/seed-dealers.ts
// Seeds all 20 DealerSource rows. Run after schema is set up.
// Run with: npx ts-node prisma/seed-dealers.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const ALL_DEALERS = [
  // ── Shopify dealers ──────────────────────────────────────────
  {
    name: 'Craft & Tailored',
    slug: 'craft-and-tailored',
    baseUrl: 'https://www.craftandtailored.com',
    adapterName: 'CraftAndTailoredAdapter',
    scrapeConfig: { platform: 'shopify', watchCollection: 'watches' },
    isActive: true,
  },
  {
    name: 'Dad & Son Watches',
    slug: 'dad-and-son-watches',
    baseUrl: 'https://www.dadandson-watches.com',
    adapterName: 'DadAndSonWatchesAdapter',
    scrapeConfig: { platform: 'shopify', watchCollection: 'watches' },
    isActive: false, // Cloudflare IUAM blocks Railway IPs — re-enable with residential proxy
  },
  {
    name: 'Watchnet Japan',
    slug: 'watchnet-japan',
    baseUrl: 'https://www.watchnet.co.jp',
    adapterName: 'WatchnetJapanAdapter',
    scrapeConfig: { platform: 'custom', note: 'Japanese custom CMS, Playwright-scraped' },
    isActive: true,
  },
  {
    name: 'Analog/Shift',
    slug: 'analog-shift',
    baseUrl: 'https://shop.analogshift.com',
    adapterName: 'AnalogShiftAdapter',
    scrapeConfig: { platform: 'shopify', watchCollection: 'watches', note: 'Part of WOS Group' },
    isActive: true,
  },
  {
    name: 'C4C Japan',
    slug: 'c4c-japan',
    baseUrl: 'https://c4cjapan.com',
    adapterName: 'C4CJapanAdapter',
    scrapeConfig: { platform: 'shopify', note: 'Neo-vintage specialist, JPY pricing' },
    isActive: true,
  },
  {
    name: 'Doble Vintage Watches',
    slug: 'doble-vintage',
    baseUrl: 'https://www.doblevintagewatches.com',
    adapterName: 'DobleVintageAdapter',
    scrapeConfig: { platform: 'shopify', watchCollection: 'watches' },
    isActive: true,
  },
  {
    name: "Goldfinger's Vintage",
    slug: 'goldfingers-vintage',
    baseUrl: 'https://www.goldfingersvintage.com',
    adapterName: 'GoldfingersVintageAdapter',
    scrapeConfig: { platform: 'shopify' },
    isActive: true,
  },
  {
    name: 'Good Evening',
    slug: 'good-evening',
    baseUrl: 'https://goodevening.co',
    adapterName: 'GoodEveningAdapter',
    scrapeConfig: { platform: 'shopify', watchCollection: 'watches' },
    isActive: true,
  },
  {
    name: 'Collectors Corner NY',
    slug: 'collectors-corner-ny',
    baseUrl: 'https://www.collectorscornerny.com',
    adapterName: 'CollectorsCornerNYAdapter',
    scrapeConfig: { platform: 'shopify' },
    isActive: true,
  },
  {
    name: 'HighEndTime',
    slug: 'highendtime',
    baseUrl: 'https://www.highendtime.com',
    adapterName: 'HighEndTimeAdapter',
    scrapeConfig: { platform: 'shopify', note: 'HK-based, USD pricing' },
    isActive: true,
  },
  {
    name: 'Empire Time NY',
    slug: 'empire-time-ny',
    baseUrl: 'https://www.empiretimeny.com',
    adapterName: 'EmpireTimeNYAdapter',
    scrapeConfig: { platform: 'shopify' },
    isActive: true,
  },
  {
    name: "Danny's Vintage Watches",
    slug: 'dannys-vintage-watches',
    baseUrl: 'https://dannysvintagewatches.com',
    adapterName: 'DannysVintageWatchesAdapter',
    scrapeConfig: { platform: 'shopify', watchCollection: 'wear-a-piece-of-history-shop-watches' },
    isActive: true,
  },
  {
    name: 'Kawaii Vintage Watch',
    slug: 'kawaii-vintage-watch',
    baseUrl: 'https://kawaiivintagewatch.com',
    adapterName: 'KawaiiVintageWatchAdapter',
    scrapeConfig: { platform: 'shopify', note: 'Bangkok-based' },
    isActive: true,
  },
  {
    name: 'Bulang and Sons',
    slug: 'bulang-and-sons',
    baseUrl: 'https://bulangandsons.com',
    adapterName: 'BulangAndSonsAdapter',
    scrapeConfig: { platform: 'shopify', watchCollection: 'watches-for-sale', note: 'Netherlands, EUR pricing, Certifiwatch certified' },
    isActive: true,
  },

  // ── WooCommerce dealers ─────────────────────────────────────
  {
    name: 'Vintage Watch Services',
    slug: 'vintage-watch-services',
    baseUrl: 'https://vintagewatchservices.eu',
    adapterName: 'VintageWatchServicesAdapter',
    scrapeConfig: { platform: 'woocommerce', shopPath: '/shop/', locale: 'en' },
    isActive: true,
  },
  {
    name: 'Menta Watches',
    slug: 'menta-watches',
    baseUrl: 'https://mentawatches.com',
    adapterName: 'MentaWatchesAdapter',
    scrapeConfig: { platform: 'woocommerce', shopPath: '/shop/', note: 'Miami, FL' },
    isActive: true,
  },
  {
    name: 'Françoise Paris',
    slug: 'francoise-paris',
    baseUrl: 'https://francoise.paris',
    adapterName: 'FrancoisePavisAdapter',
    scrapeConfig: { platform: 'woocommerce', shopPath: '/boutique/', locale: 'fr', note: 'French language site' },
    isActive: true,
  },
  {
    name: 'Grey and Patina',
    slug: 'grey-and-patina',
    baseUrl: 'https://greyandpatina.com',
    adapterName: 'GreyAndPatinaAdapter',
    scrapeConfig: { platform: 'woocommerce', shopPath: '/shop/', note: 'Southern California' },
    isActive: true,
  },
  {
    name: 'The Arrow of Time',
    slug: 'the-arrow-of-time',
    baseUrl: 'https://thearrowoftime.fr',
    adapterName: 'TheArrowOfTimeAdapter',
    scrapeConfig: { platform: 'woocommerce', shopPath: '/shop/', locale: 'fr' },
    isActive: true,
  },
  {
    name: 'Thillier Time',
    slug: 'thillier-time',
    baseUrl: 'https://thillier-time.com',
    adapterName: 'ThillierTimeAdapter',
    scrapeConfig: { platform: 'woocommerce', shopPath: '/shop/', locale: 'fr', note: 'France/Belgium' },
    isActive: true,
  },
];

async function main() {
  console.log('🌱 Seeding 20 dealer sources...');

  for (const dealer of ALL_DEALERS) {
    await prisma.dealerSource.upsert({
      where: { slug: dealer.slug },
      update: { ...dealer, scrapeConfig: dealer.scrapeConfig as any },
      create: { ...dealer, scrapeConfig: dealer.scrapeConfig as any },
    });
    console.log(`  ✓ ${dealer.name}`);
  }

  console.log(`\n✅ ${ALL_DEALERS.length} dealer sources seeded`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
