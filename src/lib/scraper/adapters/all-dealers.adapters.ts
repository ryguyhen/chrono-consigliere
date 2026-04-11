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

  // Title terms that identify non-watch accessories on this site.
  // Applied after title extraction — any match skips the listing.
  // Keep conservative: only terms that cannot appear in a real watch product title.
  private static readonly TITLE_EXCLUSIONS = [
    'bracelet',
    'bracelets',
    'watch strap',
    'nato strap',
    'rubber strap',
    'leather strap',
    'nylon strap',
    'watch band',
    'watch bands',
    'buckle',
    'clasp',
    'watch winder',
    'winder',
    'parts',
    'spare parts',
  ] as const;

  async scrape(): Promise<ScrapeResult> {
    // Watchnet Japan runs a custom CMS with SSR HTML — no Playwright needed.
    // Site structure:
    //   Homepage  /en/              → links to category pages (/en/item/index/N)
    //   Category  /en/item/index/N → links to product pages  (/en/item/view/N)
    //   Product   /en/item/view/N  → title, price, og:image
    //   category 24 = "ARCHIVES (SOLD ITEMS)" — skipped

    const listings: ScrapedListing[] = [];
    const errors: string[] = [];
    const headers = { 'User-Agent': 'Mozilla/5.0 (compatible)', Accept: 'text/html' };

    // Step 1: Discover active category IDs from homepage
    const homeRes = await fetch(`${this.config.baseUrl}/en/`, { headers });
    const homeHtml = await homeRes.text();
    const catMatches = [...homeHtml.matchAll(/href="[^"]*\/en\/item\/index\/(\d+)"/g)];
    const categoryIds = [...new Set(catMatches.map(m => m[1]).filter(id => id !== '24'))];
    this.log('info', `Found ${categoryIds.length} active categories`);

    // Step 2: Collect unique product view URLs from each category listing
    const productUrls = new Set<string>();
    for (const catId of categoryIds) {
      await this.delay();
      try {
        const catRes = await fetch(`${this.config.baseUrl}/en/item/index/${catId}`, { headers });
        const catHtml = await catRes.text();
        const viewMatches = [...catHtml.matchAll(/href="(https:\/\/www\.watchnet\.co\.jp\/en\/item\/view\/\d+)"/g)];
        viewMatches.forEach(m => productUrls.add(m[1]));
      } catch { /* skip failed category */ }
    }
    this.log('info', `Found ${productUrls.size} product URLs`);

    // Step 3: Scrape each product detail page
    for (const url of productUrls) {
      try {
        await this.delay();
        const res = await fetch(url, { headers });
        if (!res.ok) continue;
        const html = await res.text();

        // Title from h1 or og:title
        const h1Match = html.match(/class="content-itemdetail__ttl"[^>]*>\s*([^<]+)/);
        const title = h1Match
          ? h1Match[1].trim()
          : (html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ?? '');
        if (!title) continue;

        // Title-keyword exclusion — skip obvious non-watch accessories
        const titleLower = title.toLowerCase();
        const blockedTerm = WatchnetJapanAdapter.TITLE_EXCLUSIONS.find(term => titleLower.includes(term));
        if (blockedTerm) {
          this.log('debug', `Dropped non-watch (title:"${blockedTerm}"): ${url}`);
          continue;
        }

        // Primary image from og:image
        const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ?? null;
        const images = ogImage ? [{ url: ogImage, isPrimary: true }] : [];

        // Price in JPY (stored as-is; UI can format/convert)
        const priceMatch = html.match(/<p class="price">&yen;([\d,]+)/);
        const priceJpy = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : null;

        listings.push({
          sourceUrl: url,
          sourceTitle: title,
          sourcePrice: priceJpy ? `¥${priceJpy.toLocaleString()}` : null,
          brand: null, // inferred by scrape-runner via inferBrand
          model: title,
          reference: null,
          year: null,
          caseSizeMm: null,
          caseMaterial: null,
          dialColor: null,
          movementType: null,
          condition: null,
          style: null,
          price: priceJpy,
          currency: 'JPY',
          description: null,
          images,
          isAvailable: true, // only non-archive categories scraped
        });
      } catch (err: any) {
        errors.push(`${url}: ${err.message}`);
      }
    }

    this.log('info', `Done. ${listings.length} listings, ${errors.length} errors`);
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
//
//     CCNY is a mixed-inventory NY vintage dealer — carries watches,
//     jewelry, accessories, and collectibles. No watch-specific collection
//     exists, so we must exclude non-watch categories by type/tag/title.
//     Layers 1–3 only (no positive gate — watches lack a consistent type).
// ─────────────────────────────────────────────────────────────
export class CollectorsCornerNYAdapter extends ShopifyBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Collectors Corner NY',
      baseUrl: 'https://www.collectorscornerny.com',
      watchCollectionHandle: 'all',

      // Layer 1 — product_type exclusion
      excludeProductTypes: [
        'jewelry', 'jewellery', 'fine jewelry', 'fashion jewelry',
        'watch strap', 'strap', 'watch winder', 'winder',
        'ring', 'rings', 'brooch', 'pin',
        'earring', 'earrings',
        'cufflinks', 'cuff links',
        'lapel pin', 'tie bar', 'tie clip',
      ],

      // Layer 2 — tag exclusion
      nonWatchTags: [
        'parts',
        'jewelry', 'jewellery', 'fine jewelry',
        'necklace', 'cufflinks', 'pendant', 'locket',
        'glasses', 'sunglasses', 'eyewear',
        'brooch', 'earring', 'earrings',
        'ring', 'rings',
        'tie bar', 'tie clip', 'lapel pin',
      ],

      // Layer 3 — title keyword exclusion (last-resort for untagged/untyped items)
      // Note: 'signage', 'silk scarf', 'key pouch', 'watch winder' are also
      // covered by DEFAULT_TITLE_EXCLUSIONS in the base adapter.
      excludeTitleTerms: [
        // Straps & accessories
        'watch strap', 'nato strap', 'rubber strap', 'leather strap', 'nylon strap',
        'watch winder', 'winder',
        // Jewelry (English)
        'jewelry', 'jewellery',
        'necklace', 'cufflinks', 'cuff link',
        'sunglasses', 'glasses',
        // Additional jewelry categories not covered by tags
        'brooch', 'earring', 'locket', 'pendant',
        'lapel pin', 'tie bar', 'tie clip',
        // Rolex branded merchandise — confirmed leaking from CCNY catalog
        'scarf',       // e.g. "Rolex Silk Scarf" (safe at CCNY; globally 'silk scarf' is in DEFAULT)
        'pouch',       // e.g. "Rolex Italian Leather Key Pouch" (catches any "* pouch" variant)
        'wallet',      // branded wallets
        'coronet',     // e.g. "Rolex Yellow Gold Coronet Pin" (coronet = Rolex logo pin)
        'key ring',    // branded key accessories
        'umbrella',    // branded merchandise
      ],

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
//     Platform: Shopify (Dawn 5.0.0 theme)
//     Note: Mixed jewelry + watch dealer — filter to watches only.
//     Uses French product_type/tag taxonomy — French terms required.
// ─────────────────────────────────────────────────────────────
export class FrancoisePavisAdapter extends ShopifyBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Françoise Paris',
      baseUrl: 'https://francoise.paris',
      watchCollectionHandle: undefined, // use root products.json — no watch-only collection

      // Layer 1 — product_type exclusion (English + French)
      excludeProductTypes: [
        'bracelet', 'ring', 'necklace', 'jewellery', 'jewelry',
        'bague', 'collier', 'bijou',
        // French jewelry types not previously covered
        'pendentif', 'broche', 'boucle',
      ],

      // Layer 2 — tag exclusion (English + French)
      nonWatchTags: [
        'bijoux', 'jewelry', 'jewellery',
        'ring', 'bague', 'bracelet-bijou', 'necklace',
        // French jewelry categories not previously covered
        'pendentif', 'broche', 'boucle',
      ],

      // Layer 3 — title keyword exclusion (French terms that slip through tags)
      excludeTitleTerms: [
        'pendentif', 'broche', 'boucle', 'collier', 'bague',
        'bijou', 'bijoux',
      ],

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
  // The Arrow of Time runs on Wix (not WooCommerce).
  // The WooCommerce Store API call will always fail; we override scrape()
  // entirely with a fetch-based approach using Wix's SSR HTML + JSON-LD.
  //
  // Site structure:
  //   Shop listing  https://www.thearrowoftime.fr/shop?page=N
  //   Product page  https://www.thearrowoftime.fr/product-page/[slug]
  //   Each product page embeds a schema.org Product JSON-LD block with
  //   name, image array, and Offers (price, currency, availability).

  constructor() {
    super({
      sourceId: '',
      sourceName: 'The Arrow of Time',
      baseUrl: 'https://www.thearrowoftime.fr',
      shopPath: '/shop',
      locale: 'fr',
      rateLimit: 2500,
    });
  }

  async scrape(): Promise<ScrapeResult> {
    const listings: ScrapedListing[] = [];
    const errors: string[] = [];
    const seenUrls = new Set<string>();
    const productUrls: string[] = [];
    const baseUrl = 'https://www.thearrowoftime.fr';
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml',
    };

    // Step 1: Paginate through shop listing pages to collect product URLs
    let page = 1;
    while (page <= (this.config.maxPages ?? 20)) {
      const listUrl = `${baseUrl}/shop?page=${page}`;
      const res = await fetch(listUrl, { headers });
      if (!res.ok) break;
      const html = await res.text();

      // Each product appears twice (thumbnail + title link) — dedupe with Set
      const matches = [...html.matchAll(/href="(https:\/\/www\.thearrowoftime\.fr\/product-page\/[^"]+)"/g)];
      const pageUrls = [...new Set(matches.map(m => m[1]))];
      if (pageUrls.length === 0) break;

      let newOnPage = 0;
      for (const u of pageUrls) {
        if (!seenUrls.has(u)) { seenUrls.add(u); productUrls.push(u); newOnPage++; }
      }
      if (newOnPage === 0) break;

      // Wix renders a "?page=N+1" link when a next page exists
      if (!html.includes(`?page=${page + 1}`)) break;
      page++;
      await this.delay();
    }

    this.log('info', `Found ${productUrls.length} product URLs across ${page} page(s)`);

    // Step 2: Fetch each product page and parse JSON-LD
    for (const productUrl of productUrls) {
      try {
        await this.delay();
        const res = await fetch(productUrl, { headers });
        if (!res.ok) { errors.push(`HTTP ${res.status}: ${productUrl}`); continue; }
        const html = await res.text();

        // Wix embeds a schema.org Product block in every product page
        const ldMatch = html.match(/<script type="application\/ld\+json">(\{[^<]*"Product"[^<]*\})<\/script>/);
        if (!ldMatch) continue;

        let ld: any;
        try { ld = JSON.parse(ldMatch[1]); } catch { continue; }
        if (ld['@type'] !== 'Product') continue;

        const name = (ld.name as string | undefined) ?? '';
        if (!name) continue;

        const offer = (ld.Offers ?? ld.offers ?? {}) as Record<string, any>;
        const rawPrice = parseFloat(offer.price ?? '0');
        const price = rawPrice > 0 ? rawPrice : null;
        const currency = (offer.priceCurrency as string | undefined) ?? 'EUR';
        const availability = (offer.Availability ?? offer.availability ?? '') as string;
        const isAvailable = availability.toLowerCase().includes('instock');

        const images = ((ld.image ?? []) as any[]).map((img: any, i: number) => ({
          url: (img.contentUrl ?? img) as string,
          isPrimary: i === 0,
        }));

        listings.push({
          sourceUrl: productUrl,
          sourceTitle: name,
          sourcePrice: price ? `€${price.toFixed(0)}` : null,
          brand: null, // inferred by scrape-runner via inferBrand
          model: name,
          reference: null,
          year: null,
          caseSizeMm: null,
          caseMaterial: null,
          dialColor: null,
          movementType: null,
          condition: null,
          style: null,
          price,
          currency,
          description: null,
          images,
          isAvailable,
        });
      } catch (err: any) {
        errors.push(`${productUrl}: ${err.message}`);
      }
    }

    this.log('info', `Done. ${listings.length} listings, ${errors.length} errors`);
    return { listings, totalFound: listings.length, errors };
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
//     Focus: Pre-owned watches, primarily Rolex and luxury brands
//     Uses 'all' collection — add exclusions defensively since some
//     NY dealers carry straps, boxes, and accessories alongside watches.
// ─────────────────────────────────────────────────────────────
export class EmpireTimeNYAdapter extends ShopifyBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Empire Time NY',
      baseUrl: 'https://www.empiretimeny.com',
      watchCollectionHandle: 'all',
      nonWatchTags: ['strap', 'accessory', 'box', 'watchbox', 'watch-box', 'paper', 'parts'],
      excludeProductTypes: ['strap', 'accessory', 'box', 'watchbox'],
      excludeTitleTerms: [
        'watch strap', 'nato strap', 'rubber strap',
        'watch box', 'watch winder', 'winder',
      ],
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
//
//     Note: This source has been logging "fetch failed" on Railway —
//     likely DNS_FAILURE or SSL_ERROR (site may be down / domain changed).
//     With improved error handling the next run will log the exact cause.
//     If DNS_FAILURE persists across multiple runs, disable the DB record
//     until the domain is confirmed live.
//
//     Collection handle was verified at time of adapter creation; if the
//     collection returns 404 the adapter automatically falls back to
//     /products.json — so a stale handle is not the root cause here.
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

// ─────────────────────────────────────────────────────────────
// 21. A COLLECTED MAN [Shopify] — London, UK
//     URL: acollectedman.com
//     Focus: Independent watchmakers — F.P. Journe, Roger W. Smith,
//            MB&F, Greubel Forsey, De Bethune, and more.
//     Platform: Shopify on watchxchange-2.myshopify.com
//     Collection: /collections/all-watches — watch-only, no accessories.
//
//     Key quirks:
//     • Titles are model-only, e.g. "Series 2 | White Gold" — the brand
//       is absent from the title and must be taken from the `vendor` field
//       (Shopify's canonical brand/maker field). inferBrand() cannot help.
//     • All prices are 0.00 — ACM is Price on Request (POR) only.
//       price will be null after parsePrice(); sourcePrice likewise null.
//     • product_type is consistently "Watch" across the catalog.
//
//     Availability note:
//     ACM maintains an extensive sold archive on their site. Archived/sold
//     watches typically carry a 'sold' or 'sold-archive' tag. When present,
//     the tag exclusion below catches them at scrape time, preventing sold
//     archive watches from appearing in Browse as "Price on request."
//     If ACM changes their tagging convention, re-verify with debug mode.
// ─────────────────────────────────────────────────────────────
export class ACollectedManAdapter extends ShopifyBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'A Collected Man',
      baseUrl: 'https://www.acollectedman.com',
      watchCollectionHandle: 'all-watches',
      // Positive gate: product_type must be "Watch" (consistent across ACM catalog)
      watchIndicatorTypes: ['watch'],
      // Exclude sold/archive watches — ACM tags these to distinguish from current inventory.
      // 'sold' alone is intentionally included: a for-sale watch would never be tagged 'sold'.
      nonWatchTags: ['sold', 'sold-archive', 'archive'],
      rateLimit: 1500,
    });
  }

  /**
   * Use Shopify's `vendor` field as the authoritative brand source.
   * ACM product titles omit the brand entirely (e.g. "Series 2 | White Gold"
   * for a Roger W. Smith), so inferBrand() on the title always returns null.
   * The vendor field contains the canonical maker name.
   */
  protected override extractBrand(vendor: string | undefined, parsed: Partial<ScrapedListing>): string | null {
    return vendor ?? parsed.brand ?? null;
  }
}
