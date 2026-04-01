// src/lib/scraper/adapters/all-dealers.adapters.ts
// 
// All 20 dealer adapters for Chrono Consigliere.
// Each adapter extends either ShopifyBaseAdapter or WooCommerceBaseAdapter.
// 
// ┌─────────────────────────────────────────────────────────────┐
// │ DISCLAIMER                                                  │
// │ All watch listings link to the original dealer website.     │
// │ Chrono Consigliere is a discovery layer only — we are not   │
// │ a seller. Purchases are completed on the dealer's website.  │
// └─────────────────────────────────────────────────────────────┘
//
// Platform key:
//   [Shopify]       Uses /products.json API — fast, clean, no HTML parsing
//   [WooCommerce]   Uses WC Store API + Playwright fallback
//   [Custom]        Playwright-only, site-specific selectors

import { ShopifyBaseAdapter } from './_shopify-base.adapter';
import { WooCommerceBaseAdapter } from './_woocommerce-base.adapter';
import { SquarespaceBaseAdapter } from './_squarespace-base.adapter';
import { BaseAdapter } from '../base-adapter';
import { chromium } from 'playwright';
import type { ScrapeResult, ScrapedListing } from '../base-adapter';

// ─────────────────────────────────────────────────────────────
// 1. CRAFT & TAILORED [Shopify] — Los Angeles, CA
//    Focus: Vintage Rolex, Omega, Tudor, Heuer
//    Platform: Shopify — /collections/all/products.json
//
//    Filtering strategy (watch-only, defense-in-depth):
//    Layer 1 — product_type exclusion (catches standalone strap/accessory types)
//    Layer 2 — tag exclusion (catches items tagged strap/nato/leather/etc.)
//    Layer 3 — title keyword exclusion (catches mis-typed or untagged non-watches)
//    Layer 4 — positive indicator gate (product must look like a watch)
//
//    All C&T watches use product_type "Timepiece" (or "timepiece") and
//    carry a "timepiece" tag. Anything without these is excluded.
// ─────────────────────────────────────────────────────────────
export class CraftAndTailoredAdapter extends ShopifyBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Craft & Tailored',
      baseUrl: 'https://www.craftandtailored.com',
      // Use /collections/all to get full catalog (~250+ watches).
      // Root /products.json only returns ~16 items.
      watchCollectionHandle: 'all',

      // Layer 1 — product_type exclusion
      excludeProductTypes: [
        'strap', 'watch strap', 'nato strap', 'leather strap', 'band',
        'bracelet', 'book', 'accessory', 'accessories', 'lifestyle',
        'apparel', 'merch', 'tool', 'gift card',
      ],

      // Layer 2 — tag exclusion
      nonWatchTags: [
        'strap', 'nato', 'leather', 'leather-strap', 'zodiac-strap',
        'book', 'lifestyle', 'merch', 'apparel', 'accessories',
        'tools', 'spring-bar', 'pouch', 'winder', 'storage',
      ],

      // Layer 3 — title keyword exclusion (case-insensitive substring match)
      excludeTitleTerms: [
        'strap', ' band', 'nato', 'bracelet', 'leather strap',
        'watch strap', 'replacement strap', 'spring bar',
        'book', 'pouch', 'tool', 'merch', 'gift card',
      ],

      // Layer 4 — positive indicator: product must have at least one watch signal.
      // C&T's tag taxonomy: brand names + style tags + condition tags.
      // Many real watches have empty product_type and only brand/style tags — include all of them.
      // The indicator list is intentionally broad; non-watches are already caught by layers 1–3.
      watchIndicatorTags: [
        // Explicit watch tags
        'timepiece', 'watch',
        // Watch styles — appear on empty-type watches
        'dress', 'sport', 'diver', 'dive', 'vintage', 'chronograph', 'pilot',
        'field', 'military', 'casual', 'alarm', 'alarm watch',
        // Watch feature/condition tags C&T uses
        'date', 'tropical', 'faded', 'rare', 'unusual', 'gilt',
        'full set', 'Full Set', 'papers', 'Papers',
        // Brand names — any brand tag = it's a watch
        'rolex', 'omega', 'patek', 'patek-philippe', 'seiko', 'grand seiko',
        'tudor', 'heuer', 'tag heuer', 'iwc', 'zenith', 'longines',
        'universal', 'universal-geneve', 'breitling', 'audemars', 'audemars-piguet',
        'vacheron', 'cartier', 'hamilton', 'movado', 'panerai', 'blancpain',
        'jaeger', 'jaeger-lecoultre', 'elgin', 'bulova', 'wittnauer',
        'enicar', 'doxa', 'glycine', 'tissot', 'citizen', 'oris',
        'sinn', 'nomos', 'hublot', 'zodiac', 'rado', 'ebel',
        'girard', 'girard-perregaux', 'corum', 'piaget', 'a. lange',
        'ulysse', 'chopard', 'richard mille', 'fp journe', 'moser',
      ],
      watchIndicatorTypes: [
        'timepiece', 'watch',
        // C&T-specific product types seen in practice
        'diver', 'dress watch', 'sport watch', 'field watch', 'pilot watch',
        'dive watch', 'tool watch', 'vintage watch', 'chronograph',
      ],

      rateLimit: 1500,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 2. DAD & SON WATCHES [Squarespace / HTML] — Hong Kong
//    URL: dadandson-watches.com
//    Platform: Squarespace — SquarespaceBaseAdapter
//    Listing page: /watches
//    Note: Cloudflare IUAM blocks Railway IPs — isActive: false until
//          a residential proxy is configured.
// ─────────────────────────────────────────────────────────────
export class DadAndSonWatchesAdapter extends SquarespaceBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Dad & Son Watches',
      baseUrl: 'https://www.dadandson-watches.com',
      listingUrl: 'https://www.dadandson-watches.com/watches',
      currency: 'USD',
      productLinkPattern: '/watches/',
      useFirefoxFirst: true,
      rateLimit: 2500,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 3. WATCHNET JAPAN [Custom CMS] — Tokyo, Japan
//    Site: watchnet.co.jp — "Private Eyes" vintage boutique
//    Custom static HTML site — uses Playwright with JP selectors
// ─────────────────────────────────────────────────────────────
export class WatchnetJapanAdapter extends ShopifyBaseAdapter {
  // Watchnet Japan runs a custom CMS, not Shopify, but they have
  // an English version at /en/ with clean product pages.
  // We override scrape() entirely with Playwright logic.
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Watchnet Japan (Private Eyes)',
      baseUrl: 'https://www.watchnet.co.jp',
      rateLimit: 3000, // be extra polite with Japanese servers
    });
  }

  async scrape(): Promise<ScrapeResult> {
    const listings: ScrapedListing[] = [];
    const errors: string[] = [];

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (compatible; ChronoConsigliere/1.0)',
      locale: 'en-US',
    });

    try {
      const page = await context.newPage();

      // Watchnet Japan lists watches on the English version
      // Their site structure: watchnet.co.jp/en/ with individual product pages
      await this.withRetry(() =>
        page.goto('https://www.watchnet.co.jp/en/', { waitUntil: 'domcontentloaded', timeout: 30000 })
      );

      // Extract all product links from the listing page
      const productLinks = await page.evaluate(() => {
        const links: string[] = [];
        // Product links on their site follow pattern /en/product/XXXXX
        document.querySelectorAll('a[href*="/en/product/"], a[href*="/en/watch/"]').forEach((a: any) => {
          if (a.href && !links.includes(a.href)) links.push(a.href);
        });
        return links;
      });

      this.log('info', `Found ${productLinks.length} product links`);

      for (const url of productLinks) {
        try {
          await this.delay();
          await this.withRetry(() =>
            page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
          );

          const listing = await page.evaluate((productUrl: string) => {
            const title = document.querySelector('h1, .product-title')?.textContent?.trim() ?? '';
            const priceEl = document.querySelector('.price, .product-price');
            const sourcePrice = priceEl?.textContent?.replace(/[^0-9,]/g, '').trim() ?? null;
            const desc = document.querySelector('.description, .product-description')?.textContent?.trim() ?? null;

            const isSold = !!(
              document.querySelector('.sold-out, .soldout') ||
              document.body.textContent?.toLowerCase().includes('sold')
            );

            const images = Array.from(
              document.querySelectorAll('.product-images img, .gallery img')
            ).map((img: any, i) => ({
              url: img.src ?? img.dataset.src ?? '',
              isPrimary: i === 0,
            })).filter(img => img.url);

            // Parse JPY price and convert hint (we store in JPY, flag currency)
            const jpyMatch = sourcePrice?.replace(',', '');
            const priceJpy = jpyMatch ? parseInt(jpyMatch) : null;

            return {
              sourceUrl: productUrl,
              sourceTitle: title,
              sourcePrice: priceJpy ? `¥${priceJpy.toLocaleString()}` : null,
              price: priceJpy ? Math.round(priceJpy * 0.0067 * 100) : null, // rough JPY→USD, cents
              currency: 'JPY',
              description: desc,
              images,
              isAvailable: !isSold,
              brand: null, model: null, reference: null, year: null,
              caseSizeMm: null, caseMaterial: null, dialColor: null,
              movementType: null, condition: null, style: null,
            };
          }, url);

          // Enrich parsed fields from title+description
          const parsed = this.parseFromTitleAndDescription(
            listing.sourceTitle,
            listing.description
          );

          listings.push({ ...listing, ...parsed });
        } catch (err: any) {
          errors.push(`${url}: ${err.message}`);
        }
      }
    } finally {
      await browser.close();
    }

    return { listings, totalFound: listings.length, errors };
  }
}

// ─────────────────────────────────────────────────────────────
// 4. ANALOG/SHIFT [Shopify] — New York, NY
//    Part of Watches of Switzerland Group
//    Primary shop at shop.analogshift.com
// ─────────────────────────────────────────────────────────────
export class AnalogShiftAdapter extends ShopifyBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Analog/Shift',
      // Their Shopify store lives on shop.analogshift.com
      baseUrl: 'https://shop.analogshift.com',
      watchCollectionHandle: 'watches',
      nonWatchTags: ['strap', 'accessory', 'publication', 'archives'],
      rateLimit: 2000,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 5. C4C JAPAN [Shopify] — Japan
//    Neo-vintage specialist, 1960s–2000s
// ─────────────────────────────────────────────────────────────
export class C4CJapanAdapter extends ShopifyBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'C4C Japan',
      baseUrl: 'https://c4cjapan.com',
      watchCollectionHandle: 'all',
      rateLimit: 3000, // polite for Japanese server
    });
  }

  // Override to handle JPY pricing
  protected parseFromTitleAndDescription(title: string, description: string | null) {
    const parsed = super.parseFromTitleAndDescription(title, description);
    return parsed;
  }
}

// ─────────────────────────────────────────────────────────────
// 6. DOBLE VINTAGE [Squarespace / HTML] — London, UK
//    URL: doblevintagewatches.com
//    Platform: Squarespace — homepage is the product listing page
//    Currency: GBP
// ─────────────────────────────────────────────────────────────
export class DobleVintageAdapter extends SquarespaceBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Doble Vintage Watches',
      baseUrl: 'https://www.doblevintagewatches.com',
      listingUrl: 'https://www.doblevintagewatches.com',
      currency: 'GBP',
      useFirefoxFirst: false,
      rateLimit: 2000,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 7. VINTAGE WATCH SERVICES [BigCommerce] — EU-based
//    URL: vintagewatchservices.eu
//    Platform: BigCommerce — Playwright-based (site blocks non-browser HTTP)
//    Strategy: load /all-watches/ with Playwright → collect product hrefs →
//              load each product page → extract JSON-LD structured data
// ─────────────────────────────────────────────────────────────
export class VintageWatchServicesAdapter extends BaseAdapter {
  private readonly BASE = 'https://vintagewatchservices.eu';

  constructor() {
    super({
      sourceId: '',
      sourceName: 'Vintage Watch Services',
      baseUrl: 'https://vintagewatchservices.eu',
      rateLimit: 2000,
    });
  }

  async scrape(): Promise<ScrapeResult> {
    const listings: ScrapedListing[] = [];
    const errors: string[] = [];

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
    });

    try {
      const page = await context.newPage();
      const productUrls: string[] = [];

      // Step 1: paginate through /all-watches/ and collect product URLs
      for (let p = 1; p <= 20; p++) {
        const url = p === 1
          ? `${this.BASE}/all-watches/`
          : `${this.BASE}/all-watches/?page=${p}`;

        await this.withRetry(() =>
          page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        );

        // Wait for product cards to appear (BigCommerce Cornerstone theme)
        await page.waitForSelector(
          'article.card, li.product, [data-product-id], .productGrid li',
          { timeout: 8000 }
        ).catch(() => { /* may not exist on empty pages */ });

        const found = await page.evaluate((base: string) => {
          const urls: string[] = [];
          // BigCommerce: product cards link via card-figure__link or card-title a
          const selectors = [
            'a.card-figure__link',
            'h4.card-title a',
            '.card-title a',
            '[data-product-id] a',
            'article.card a[href]',
            'li.product a[href]',
          ];
          for (const sel of selectors) {
            document.querySelectorAll(sel).forEach((el: any) => {
              const href: string = el.href ?? '';
              if (href.startsWith(base) && !urls.includes(href)) urls.push(href);
            });
          }
          return urls;
        }, this.BASE);

        if (found.length === 0) break;
        let added = 0;
        for (const u of found) {
          if (!productUrls.includes(u)) { productUrls.push(u); added++; }
        }
        if (added === 0) break; // no new products — end of pagination

        await this.delay();
      }

      this.log('info', `Found ${productUrls.length} product URLs`);

      // Step 2: visit each product in a fresh page to prevent memory buildup
      for (const url of productUrls) {
        const productPage = await context.newPage();
        try {
          await this.delay();
          await this.withRetry(() =>
            productPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
          );

          const ld = await productPage.evaluate((): Record<string, any> | null => {
            for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
              try {
                const data = JSON.parse(el.textContent ?? '');
                if (data?.['@type'] === 'Product') return data;
                if (Array.isArray(data?.['@graph'])) {
                  const prod = data['@graph'].find((n: any) => n['@type'] === 'Product');
                  if (prod) return prod;
                }
              } catch { /* skip */ }
            }
            return null;
          });

          if (!ld) continue;

          const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
          const priceValue = offer?.price ?? null;
          const currency = offer?.priceCurrency ?? 'EUR';
          const available = offer?.availability !== 'https://schema.org/OutOfStock' &&
            offer?.availability !== 'http://schema.org/OutOfStock';
          const imgUrl = Array.isArray(ld.image) ? ld.image[0] : ld.image;

          listings.push({
            sourceUrl: url,
            sourceTitle: ld.name ?? url,
            sourcePrice: priceValue != null ? `${currency === 'EUR' ? '€' : currency}${priceValue}` : null,
            brand: ld.brand?.name ?? null,
            model: ld.name ?? null,
            reference: ld.mpn ?? ld.sku ?? null,
            year: null,
            caseSizeMm: null,
            caseMaterial: null,
            dialColor: null,
            movementType: null,
            condition: null,
            style: null,
            price: priceValue != null ? Math.round(Number(priceValue) * 100) : null,
            currency,
            description: typeof ld.description === 'string' ? ld.description.slice(0, 1000) : null,
            images: imgUrl ? [{ url: imgUrl, isPrimary: true }] : [],
            isAvailable: available,
          });
        } catch (err: any) {
          this.log('warn', `Failed ${url}: ${err.message}`);
          errors.push(url);
        } finally {
          await productPage.close();
        }
      }
    } finally {
      await browser.close();
    }

    this.log('info', `Done. ${listings.length} listings, ${errors.length} errors`);
    return { listings, totalFound: listings.length, errors };
  }
}

// ─────────────────────────────────────────────────────────────
// 8. GOLDFINGER'S VINTAGE [Squarespace] — Vintage dealer
//    URL: goldfingersvintage.com
//    Platform: Squarespace — ?format=json API, listing page: /watches
// ─────────────────────────────────────────────────────────────
export class GoldfingersVintageAdapter extends SquarespaceBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: "Goldfinger's Vintage",
      baseUrl: 'https://www.goldfingersvintage.com',
      listingUrl: 'https://www.goldfingersvintage.com/watches',
      currency: 'USD',
      rateLimit: 2000,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 9. GOOD EVENING [Squarespace] — Vintage watches
//    URL: goodevening.co
//    Platform: Squarespace — ?format=json API, listing page: /shop
// ─────────────────────────────────────────────────────────────
export class GoodEveningAdapter extends SquarespaceBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Good Evening',
      baseUrl: 'https://goodevening.co',
      listingUrl: 'https://goodevening.co/shop',
      currency: 'USD',
      rateLimit: 2000,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 10. COLLECTORS CORNER NY [Shopify] — New York
//     URL: collectorscornerny.com
// ─────────────────────────────────────────────────────────────
export class CollectorsCornerNYAdapter extends ShopifyBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Collectors Corner NY',
      baseUrl: 'https://www.collectorscornerny.com',
      watchCollectionHandle: 'all',
      nonWatchTags: ['strap', 'accessory', 'parts', 'book'],
      rateLimit: 2000,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 11. MENTA WATCHES [WooCommerce] — Miami, FL
//     URL: mentawatches.com
// ─────────────────────────────────────────────────────────────
export class MentaWatchesAdapter extends WooCommerceBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Menta Watches',
      baseUrl: 'https://mentawatches.com',
      shopPath: '/shop/',
      rateLimit: 2500,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 12. FRANÇOISE PARIS [Shopify] — Paris, France
//     URL: francoise.paris
//     Platform: Shopify (Dawn 5.0.0 theme) — was misidentified as WooCommerce
//     Note: Sells watches + jewellery; filter to watches only
// ─────────────────────────────────────────────────────────────
export class FrancoisePavisAdapter extends ShopifyBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Françoise Paris',
      baseUrl: 'https://francoise.paris',
      watchCollectionHandle: undefined, // use root products.json — no watch-only collection
      excludeProductTypes: ['bracelet', 'ring', 'necklace', 'jewellery', 'jewelry', 'bague', 'collier', 'bijou'],
      nonWatchTags: ['bijoux', 'jewelry', 'jewellery', 'ring', 'bague', 'bracelet-bijou', 'necklace'],
      rateLimit: 2500,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 13. GREY AND PATINA [WooCommerce] — Southern California
//     URL: greyandpatina.com
// ─────────────────────────────────────────────────────────────
export class GreyAndPatinaAdapter extends WooCommerceBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Grey and Patina',
      baseUrl: 'https://greyandpatina.com',
      shopPath: '/shop/',
      rateLimit: 2500,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 14. THE ARROW OF TIME [WooCommerce] — France
//     URL: thearrowoftime.fr
//     Note: French vintage dealer, possibly French-language site
// ─────────────────────────────────────────────────────────────
export class TheArrowOfTimeAdapter extends WooCommerceBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'The Arrow of Time',
      baseUrl: 'https://thearrowoftime.fr',
      shopPath: '/shop/',
      locale: 'fr',
      rateLimit: 2500,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 15. HIGHENDTIME [Shopify] — Hong Kong
//     URL: highendtime.com
//     Focus: Rare pre-owned and vintage from HK
// ─────────────────────────────────────────────────────────────
export class HighEndTimeAdapter extends ShopifyBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'HighEndTime',
      baseUrl: 'https://www.highendtime.com',
      watchCollectionHandle: 'watches',
      nonWatchTags: ['collectable', 'accessory', 'strap', 'book'],
      rateLimit: 2000,
    });
  }

  // HighEndTime is HK-based; prices are in USD or HKD
  // Their /products.json exposes USD pricing for international
}

// ─────────────────────────────────────────────────────────────
// 16. EMPIRE TIME NY [Shopify] — New York
//     URL: empiretimeny.com
// ─────────────────────────────────────────────────────────────
export class EmpireTimeNYAdapter extends ShopifyBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Empire Time NY',
      baseUrl: 'https://www.empiretimeny.com',
      watchCollectionHandle: 'all',
      nonWatchTags: ['strap', 'accessory'],
      rateLimit: 2000,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 17. THILLIER TIME [Squarespace] — France/Belgium
//     URL: thillier-time.com
//     Platform: Squarespace — ?format=json on /heritage/all-watches (178 items)
//     Note: European vintage dealer; thillier-time collection has 3 additional items
// ─────────────────────────────────────────────────────────────
export class ThillierTimeAdapter extends SquarespaceBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Thillier Time',
      baseUrl: 'https://thillier-time.com',
      listingUrl: 'https://thillier-time.com/heritage/all-watches',
      currency: 'USD',
      rateLimit: 2500,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 18. DANNY'S VINTAGE WATCHES [Shopify] — New York
//     URL: dannysvintagewatches.com
// ─────────────────────────────────────────────────────────────
export class DannysVintageWatchesAdapter extends ShopifyBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: "Danny's Vintage Watches",
      baseUrl: 'https://dannysvintagewatches.com',
      watchCollectionHandle: 'wear-a-piece-of-history-shop-watches',
      nonWatchTags: ['strap', 'accessory'],
      rateLimit: 2000,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 19. KAWAII VINTAGE WATCH [Shopify] — Bangkok, Thailand
//     URL: kawaiivintagewatch.com
// ─────────────────────────────────────────────────────────────
export class KawaiiVintageWatchAdapter extends WooCommerceBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Kawaii Vintage Watch',
      baseUrl: 'https://kawaiivintagewatch.com',
      shopPath: '/shop/',
      rateLimit: 2500,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 20. BULANG AND SONS [Shopify] — Netherlands
//     URL: bulangandsons.com
//     Focus: Vintage Rolex, Patek, AP — certified by Certifiwatch
// ─────────────────────────────────────────────────────────────
export class BulangAndSonsAdapter extends ShopifyBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Bulang and Sons',
      baseUrl: 'https://bulangandsons.com',
      // Their watch collection is specifically "watches-for-sale"
      watchCollectionHandle: 'watches-for-sale',
      nonWatchTags: [
        'strap', 'nato', 'leather', 'alligator', 'rubber', 'nylon',
        'bracelet', 'textile', 'watchbox', 'watch-box', 'accessory',
        'book', 'lifestyle',
      ],
      excludeProductTypes: ['strap', 'watchbox', 'accessory'],
      rateLimit: 2000,
    });
  }

  // Bulang is Dutch, sells in EUR. Prices on their Shopify store
  // come through in EUR. We store as-is and flag currency.
  protected parseFromTitleAndDescription(title: string, description: string | null) {
    const parsed = super.parseFromTitleAndDescription(title, description);
    return parsed;
  }
}
