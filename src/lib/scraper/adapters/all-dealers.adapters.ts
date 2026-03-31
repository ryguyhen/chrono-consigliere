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
import { BaseAdapter } from '../base-adapter';
import { chromium } from 'playwright';
import type { ScrapeResult, ScrapedListing } from '../base-adapter';

// ─────────────────────────────────────────────────────────────
// 1. CRAFT & TAILORED [Shopify] — Los Angeles, CA
//    Focus: Vintage Rolex, Omega, Tudor, Heuer
//    Watch collection: /collections/watches
// ─────────────────────────────────────────────────────────────
export class CraftAndTailoredAdapter extends ShopifyBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Craft & Tailored',
      baseUrl: 'https://www.craftandtailored.com',
      watchCollectionHandle: undefined,
      // Exclude straps, books, lifestyle items common on this site
      nonWatchTags: ['strap', 'nato', 'leather', 'book', 'lifestyle', 'merch', 'apparel', 'accessories', 'zodiac-strap'],
      excludeProductTypes: ['strap', 'book', 'accessory', 'lifestyle', 'apparel'],
      rateLimit: 1500,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 2. DAD & SON WATCHES [Squarespace / HTML] — Hong Kong
//    URL: dadandson-watches.com
//    Platform: Squarespace (not Shopify — products.json does not exist)
//    Strategy: html-listing via Playwright
//      Primary:  window.Static.SQUARESPACE_CONTEXT embedded JSON
//      Fallback: DOM selectors on rendered product grid
//    Listing page: /watches
//    Stock signals: "Only X left in stock" text, "Sold Out" overlay
// ─────────────────────────────────────────────────────────────
export class DadAndSonWatchesAdapter extends BaseAdapter {
  // ── source config ──────────────────────────────────────────
  private readonly listingUrl = 'https://www.dadandson-watches.com/watches';

  // Squarespace product grid selectors — tried in order, first match wins
  private readonly CARD_SELECTORS = [
    '[data-item-id]',                  // Squarespace 7.1 data attribute
    '.ProductList-item',               // Squarespace product grid item
    '.products-flex-row .product',     // alternate grid class
    'article[class*="ProductList"]',   // article variant
    'li[class*="ProductList"]',        // list variant
  ];

  private readonly TITLE_SELECTORS = [
    '.ProductList-item-title',
    '[data-compound-title]',
    'h1[class*="title"]',
    'h2[class*="title"]',
    'h3[class*="title"]',
    '.product-title',
  ];

  private readonly PRICE_SELECTORS = [
    '.ProductList-price',
    '.sqs-money-native',
    '[class*="price"]:not([class*="compare"])',
  ];

  constructor() {
    super({
      sourceId: '',
      sourceName: 'Dad & Son Watches',
      baseUrl: 'https://www.dadandson-watches.com',
      rateLimit: 2500,
      maxRetries: 2,
      maxPages: 20,
    });
  }

  async scrape(): Promise<ScrapeResult> {
    const listings: ScrapedListing[] = [];
    const errors: string[] = [];
    const diagnostics: Record<string, any> = {
      strategy: 'html-listing/playwright',
      listingUrl: this.listingUrl,
      cardsFound: 0,
      inStock: 0,
      outOfStock: 0,
      pagesProcessed: 0,
      paginationDetected: false,
      selectorUsed: null as string | null,
      jsonContextUsed: false,
      sampleTitles: [] as string[],
      sampleUrls: [] as string[],
    };

    if (process.env.SCRAPER_NO_PLAYWRIGHT === 'true') {
      const msg = 'Dad & Son Watches: Playwright disabled (SCRAPER_NO_PLAYWRIGHT=true) — this source requires Playwright';
      this.log('warn', msg);
      return { listings: [], totalFound: 0, errors: [msg], diagnostics };
    }

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        // Suppress the most obvious headless-mode fingerprints
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-US',
        acceptDownloads: false,
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"macOS"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
      });

      // Remove navigator.webdriver — the #1 headless fingerprint
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        // Also patch common automation detection probes
        (window as any).chrome = { runtime: {} };
      });

      const page = await context.newPage();

      // Warm the session: visit homepage first to pick up cookies/challenge tokens
      // before hitting the collection page
      this.log('info', 'Warming session via homepage...');
      try {
        const homeResp = await page.goto(this.config.baseUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });
        if (homeResp?.status() === 200) {
          this.log('info', 'Homepage OK — cookies set, proceeding to /watches');
          await this.delay(1500 + Math.random() * 1000); // human-like pause
        } else {
          this.log('warn', `Homepage returned ${homeResp?.status()} — proceeding anyway`);
        }
      } catch (e: any) {
        this.log('warn', `Homepage warm failed: ${e.message} — proceeding anyway`);
      }

      let pageNum = 1;
      let hasMore = true;

      while (hasMore && pageNum <= this.config.maxPages!) {
        const url = pageNum === 1 ? this.listingUrl : `${this.listingUrl}?page=${pageNum}`;
        this.log('info', `Fetching page ${pageNum}: ${url}`);

        let httpStatus = 0;
        try {
          const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
          httpStatus = resp?.status() ?? 0;
          this.log('info', `Page ${pageNum} HTTP ${httpStatus}`);
          if (httpStatus === 503 || httpStatus === 403) {
            errors.push(`Page ${pageNum}: HTTP ${httpStatus} — bot protection active on ${url}`);
            hasMore = false;
            break;
          }
        } catch {
          this.log('warn', `Page ${pageNum} networkidle timeout — attempting extraction anyway`);
        }

        // ── Strategy 1: Squarespace embedded JSON context ──────
        const jsonItems = await page.evaluate(() => {
          // Squarespace embeds product data in window.Static.SQUARESPACE_CONTEXT
          // or in <script type="application/json" data-name="product-*"> tags
          const win = window as any;

          // 7.1: context.collection.items
          const ctxItems =
            win?.Static?.SQUARESPACE_CONTEXT?.collection?.items ||
            win?.Static?.SQUARESPACE_CONTEXT?.pageContext?.items;
          if (Array.isArray(ctxItems) && ctxItems.length > 0) return ctxItems;

          // Embedded JSON scripts — Squarespace sometimes embeds per-product JSON
          for (const script of Array.from(document.querySelectorAll('script[type="application/json"]'))) {
            try {
              const d = JSON.parse((script as HTMLElement).textContent || '');
              if (Array.isArray(d?.items) && d.items.length > 0) return d.items;
              if (Array.isArray(d?.products) && d.products.length > 0) return d.products;
            } catch { /* skip */ }
          }

          return null;
        });

        if (jsonItems && jsonItems.length > 0) {
          diagnostics.jsonContextUsed = true;
          this.log('info', `Page ${pageNum}: ${jsonItems.length} items from Squarespace JSON context`);
          diagnostics.cardsFound += jsonItems.length;
          diagnostics.pagesProcessed++;

          for (const item of jsonItems) {
            try {
              const extracted = this.extractFromSquarespaceItem(item);
              if (extracted) {
                listings.push(extracted);
                if (extracted.isAvailable) diagnostics.inStock++;
                else diagnostics.outOfStock++;
                if (diagnostics.sampleTitles.length < 3) diagnostics.sampleTitles.push(extracted.sourceTitle);
                if (diagnostics.sampleUrls.length < 3) diagnostics.sampleUrls.push(extracted.sourceUrl);
              }
            } catch (err: any) {
              errors.push(`JSON item "${item.title ?? '?'}": ${err.message}`);
            }
          }

          // Check if there's a next page via JSON context
          const pageInfo = await page.evaluate(() => {
            const win = window as any;
            const col = win?.Static?.SQUARESPACE_CONTEXT?.collection;
            return { itemCount: col?.itemCount ?? 0, pageSize: col?.pageSize ?? 12 };
          });
          hasMore = pageNum * (pageInfo.pageSize || 12) < (pageInfo.itemCount || 0);
          if (hasMore) diagnostics.paginationDetected = true;

        } else {
          // ── Strategy 2: DOM extraction ─────────────────────────
          this.log('info', `Page ${pageNum}: JSON context empty — falling back to DOM extraction`);

          const domResult = await page.evaluate(({ cardSels, titleSels, priceSels }: { cardSels: string[], titleSels: string[], priceSels: string[] }) => {
            // Try card selectors until one finds elements
            let cardEls: Element[] = [];
            let usedSelector = '';
            for (const sel of cardSels) {
              const found = Array.from(document.querySelectorAll(sel));
              if (found.length > 0) { cardEls = found; usedSelector = sel; break; }
            }

            if (cardEls.length === 0) {
              // Last resort: any element with a product link pattern
              const productLinks = Array.from(
                document.querySelectorAll('a[href*="/watches/"]')
              ) as HTMLAnchorElement[];
              // Group by closest article/li/div.item ancestor
              const seen = new Set<string>();
              cardEls = productLinks.reduce((acc, a) => {
                const ancestor = a.closest('article, li, [class*="item"], [class*="product"]') ?? a;
                const key = ancestor.className + ancestor.getAttribute('data-item-id');
                if (!seen.has(key)) { seen.add(key); acc.push(ancestor); }
                return acc;
              }, [] as Element[]);
              usedSelector = 'a[href*="/watches/"] ancestor';
            }

            const extract = (el: Element, sels: string[]): string => {
              for (const s of sels) {
                const t = el.querySelector(s)?.textContent?.trim();
                if (t) return t;
              }
              return '';
            };

            const cards = cardEls.map(card => {
              const linkEl = card.querySelector('a[href*="/watches/"]') as HTMLAnchorElement | null
                ?? card.closest('a') as HTMLAnchorElement | null;
              const href = linkEl?.href ?? '';

              const title = extract(card, titleSels) || linkEl?.textContent?.trim() || '';
              const price = extract(card, priceSels);

              const imgEl = card.querySelector('img[data-src], img[src]') as HTMLImageElement | null;
              const imgSrc = imgEl?.dataset?.src ?? imgEl?.src ?? '';

              const cardText = (card.textContent ?? '').toLowerCase();
              const hasSoldOut =
                !!card.querySelector('.sold-out, [class*="soldOut"], [class*="sold-out"]') ||
                cardText.includes('sold out') ||
                cardText.includes('out of stock');

              const stockMatch = (card.textContent ?? '').match(/only\s+(\d+)\s+left/i);
              const stockText = stockMatch ? stockMatch[0] : '';

              return { href, title, price, imgSrc, hasSoldOut, stockText };
            }).filter(c => c.href || c.title); // discard empty extractions

            return { cards, usedSelector, pageTitle: document.title };
          }, { cardSels: this.CARD_SELECTORS, titleSels: this.TITLE_SELECTORS, priceSels: this.PRICE_SELECTORS });

          this.log('info', `Page ${pageNum}: ${domResult.cards.length} cards via DOM (selector: "${domResult.usedSelector}", page: "${domResult.pageTitle}")`);

          if (domResult.cards.length === 0) {
            this.log('warn', `No product cards found on page ${pageNum} — page may require JS or bot-protection is active`);
            errors.push(`Page ${pageNum}: 0 cards found (selector attempts exhausted; page title: "${domResult.pageTitle}")`);
            hasMore = false;
            break;
          }

          diagnostics.cardsFound += domResult.cards.length;
          diagnostics.selectorUsed = domResult.usedSelector;
          diagnostics.pagesProcessed++;

          for (const card of domResult.cards) {
            try {
              const isAvailable = !card.hasSoldOut;
              const parsed = this.parseFromTitleAndDescription(card.title, null);

              listings.push({
                sourceUrl: card.href,
                sourceTitle: card.title,
                sourcePrice: card.price || null,
                price: this.parsePrice(card.price),
                currency: 'USD',
                brand: parsed.brand ?? null,
                model: parsed.model ?? null,
                reference: parsed.reference ?? null,
                year: parsed.year ?? null,
                caseSizeMm: parsed.caseSizeMm ?? null,
                caseMaterial: parsed.caseMaterial ?? null,
                dialColor: parsed.dialColor ?? null,
                movementType: parsed.movementType ?? null,
                condition: parsed.condition ?? null,
                style: null,
                description: card.stockText || null,
                images: card.imgSrc ? [{ url: card.imgSrc, isPrimary: true }] : [],
                isAvailable,
              });

              if (isAvailable) diagnostics.inStock++;
              else diagnostics.outOfStock++;
              if (diagnostics.sampleTitles.length < 3) diagnostics.sampleTitles.push(card.title);
              if (diagnostics.sampleUrls.length < 3) diagnostics.sampleUrls.push(card.href);
            } catch (err: any) {
              errors.push(`Card "${card.title}": ${err.message}`);
            }
          }

          // Squarespace pagination: check for "Next" link
          const hasNextPage = await page.evaluate(() => {
            const next = document.querySelector(
              '.squarespace-native-pagination a[aria-label*="ext"], ' +
              '.ProductList-pagination a[aria-label*="ext"], ' +
              '[class*="pagination"] a[rel="next"], ' +
              'a.next-page, a[class*="next"]'
            );
            return !!next;
          });

          if (hasNextPage) {
            diagnostics.paginationDetected = true;
            pageNum++;
            await this.delay();
          } else {
            hasMore = false;
          }
        }

        if (hasMore) await this.delay();
      }

    } finally {
      await browser.close();
    }

    this.log('info', `Done. ${listings.length} listings | ${diagnostics.inStock} in-stock | ${diagnostics.outOfStock} out-of-stock | ${diagnostics.pagesProcessed} page(s) | selector: ${diagnostics.selectorUsed ?? 'json-context'}`);

    return { listings, totalFound: listings.length, errors, diagnostics };
  }

  /** Parse a Squarespace commerce item from the JSON context */
  private extractFromSquarespaceItem(item: any): ScrapedListing | null {
    if (!item?.title) return null;

    const fullUrl = item.fullUrl
      ? (item.fullUrl.startsWith('http') ? item.fullUrl : `${this.config.baseUrl}${item.fullUrl}`)
      : null;
    if (!fullUrl) return null;

    // Stock: Squarespace uses item.purchasable, item.isOnSale, item.variants[].stock
    const variants = item.variants ?? item.structuredContent?.variants ?? [];
    const isAvailable = item.purchasable === true ||
      variants.some((v: any) => v.stock == null || v.stock > 0);

    // Price: in cents on Squarespace, or as a number with decimalCharacter
    const priceRaw = item.structuredContent?.priceCents
      ?? item.variants?.[0]?.priceMoney?.value
      ?? item.variants?.[0]?.price
      ?? null;
    const price = priceRaw != null
      ? (Number(priceRaw) > 10000 ? Math.round(Number(priceRaw)) : Math.round(Number(priceRaw) * 100))
      : null;

    const sourcePrice = item.variants?.[0]?.price
      ? `$${(Number(item.variants[0].price) / 100).toFixed(2)}`
      : null;

    // Image
    const imgUrl: string | null =
      item.assetUrl ??
      item.mainImageId ??
      item.structuredContent?.images?.[0]?.assetUrl ??
      null;

    const description = item.body
      ? item.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)
      : null;

    const parsed = this.parseFromTitleAndDescription(item.title, description);

    return {
      sourceUrl: fullUrl,
      sourceTitle: item.title,
      sourcePrice,
      price,
      currency: 'USD',
      brand: parsed.brand ?? null,
      model: parsed.model ?? null,
      reference: parsed.reference ?? null,
      year: parsed.year ?? null,
      caseSizeMm: parsed.caseSizeMm ?? null,
      caseMaterial: parsed.caseMaterial ?? null,
      dialColor: parsed.dialColor ?? null,
      movementType: parsed.movementType ?? null,
      condition: parsed.condition ?? null,
      style: null,
      description,
      images: imgUrl ? [{ url: imgUrl, isPrimary: true }] : [],
      isAvailable,
    };
  }

  /** Shared title/description parser (mirrors ShopifyBaseAdapter logic) */
  protected parseFromTitleAndDescription(
    title: string,
    description: string | null
  ): Partial<ScrapedListing> {
    const text = `${title} ${description ?? ''}`;
    const refMatch = text.match(/[Rr]ef\.?\s*#?\s*([A-Z0-9]{3,12}(?:[\/\-][A-Z0-9]{1,6})?)/);
    const yearMatch = text.match(/\b(19[0-9]{2}|20[01][0-9]|202[0-4])\b/);
    const caseMatch = text.match(/\b(\d{2}(?:\.\d)?)\s*mm\b/i);

    const knownBrands = [
      'Rolex', 'Omega', 'Patek Philippe', 'Audemars Piguet', 'IWC',
      'Jaeger-LeCoultre', 'Vacheron Constantin', 'Tudor', 'Heuer', 'TAG Heuer',
      'Breitling', 'Cartier', 'Piaget', 'Zenith', 'Longines', 'Universal Genève',
      'Seiko', 'Grand Seiko', 'Panerai', 'Hublot', 'Ulysse Nardin',
      'Oris', 'Bell & Ross', 'Sinn', 'Nomos', 'Girard-Perregaux', 'Blancpain',
    ];
    let brand: string | null = null;
    for (const b of knownBrands) {
      if (text.toUpperCase().includes(b.toUpperCase())) { brand = b; break; }
    }
    const model = brand
      ? (title.slice(title.toUpperCase().indexOf(brand.toUpperCase()) + brand.length).trim().replace(/^[-–—\s]+/, '').slice(0, 100) || null)
      : title.slice(0, 100);

    return {
      brand, model,
      reference: refMatch?.[1] ?? null,
      year: yearMatch ? parseInt(yearMatch[1]) : null,
      caseSizeMm: caseMatch ? parseFloat(caseMatch[1]) : null,
      movementType: this.normalizeMovement(text),
      condition: this.normalizeCondition(text),
    };
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
// 6. DOBLE VINTAGE [Shopify] — Vintage dealer
//    URL: doblevintagewatches.com
// ─────────────────────────────────────────────────────────────
export class DobleVintageAdapter extends ShopifyBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Doble Vintage Watches',
      baseUrl: 'https://www.doblevintagewatches.com',
      watchCollectionHandle: 'watches',
      nonWatchTags: ['strap', 'accessory'],
      rateLimit: 2000,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 7. VINTAGE WATCH SERVICES [WooCommerce] — EU-based
//    URL: vintagewatchservices.eu
// ─────────────────────────────────────────────────────────────
export class VintageWatchServicesAdapter extends WooCommerceBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Vintage Watch Services',
      baseUrl: 'https://vintagewatchservices.eu',
      shopPath: '/shop/',
      locale: 'en',
      rateLimit: 2500,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 8. GOLDFINGER'S VINTAGE [Shopify] — Vintage dealer
//    URL: goldfingersvintage.com
// ─────────────────────────────────────────────────────────────
export class GoldfingersVintageAdapter extends ShopifyBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: "Goldfinger's Vintage",
      baseUrl: 'https://www.goldfingersvintage.com',
      watchCollectionHandle: 'all',
      nonWatchTags: ['strap', 'accessory', 'gift-card'],
      rateLimit: 2000,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 9. GOOD EVENING [Shopify] — Vintage watches
//    URL: goodevening.co
// ─────────────────────────────────────────────────────────────
export class GoodEveningAdapter extends ShopifyBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Good Evening',
      baseUrl: 'https://goodevening.co',
      watchCollectionHandle: 'watches',
      nonWatchTags: ['strap', 'accessory', 'book', 'film'],
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
// 12. FRANÇOISE PARIS [WooCommerce] — Paris, France
//     URL: francoise.paris
//     Note: French-language site; titles may be in French
// ─────────────────────────────────────────────────────────────
export class FrancoisePavisAdapter extends WooCommerceBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Françoise Paris',
      baseUrl: 'https://francoise.paris',
      shopPath: '/boutique/',  // French WooCommerce sites often use /boutique/
      locale: 'fr',
      rateLimit: 2500,
    });
  }

  // Override to try both /boutique/ and /shop/ paths
  async scrape(): Promise<ScrapeResult> {
    // Try /en/ version first for English titles
    const originalBase = this.wooConfig.baseUrl;
    const enUrl = `${originalBase}/en/shop/`;

    try {
      const res = await fetch(enUrl);
      if (res.ok) {
        this.wooConfig.shopPath = '/en/shop/';
      }
    } catch {
      // Keep default
    }

    return super.scrape();
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
// 17. THILLIER TIME [WooCommerce] — France/Belgium
//     URL: thillier-time.com
//     Note: European vintage dealer
// ─────────────────────────────────────────────────────────────
export class ThillierTimeAdapter extends WooCommerceBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Thillier Time',
      baseUrl: 'https://thillier-time.com',
      shopPath: '/shop/',
      locale: 'fr',
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
export class KawaiiVintageWatchAdapter extends ShopifyBaseAdapter {
  constructor() {
    super({
      sourceId: '',
      sourceName: 'Kawaii Vintage Watch',
      baseUrl: 'https://kawaiivintagewatch.com',
      watchCollectionHandle: 'all',
      nonWatchTags: ['strap', 'accessory'],
      rateLimit: 2500,
    });
  }

  // Kawaii is Thailand-based; prices may be in THB or USD
  // Their Shopify store likely shows USD for international buyers
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
