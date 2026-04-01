// src/lib/scraper/adapters/_squarespace-base.adapter.ts
// Reusable base for Squarespace-powered dealer sites.
//
// Squarespace doesn't expose a public products REST API.
// Strategy:
//   1. Load the listing URL in Playwright
//   2. Extract from window.Static.SQUARESPACE_CONTEXT embedded JSON (fast, complete)
//   3. Fallback: DOM scrape of the rendered product grid
//
// Anti-detection: supports Firefox-first mode for sites behind Cloudflare.
// DISCLAIMER: All listings link to the original dealer site for purchase.

import { chromium, firefox } from 'playwright';
import { BaseAdapter, type ScrapeResult, type ScrapedListing } from '../base-adapter';
import { inferBrand } from '../brand-inference';

export interface SquarespaceAdapterConfig {
  sourceId: string;
  sourceName: string;
  baseUrl: string;
  /** URL of the page that lists products (may equal baseUrl for homepage shops) */
  listingUrl: string;
  /** ISO 4217 currency code; defaults to 'USD' */
  currency?: string;
  /**
   * Substring to match in href when doing DOM fallback link detection.
   * E.g. '/watches/' for dadandson-watches.com.
   * When omitted, falls back to any <a> within a Squarespace card element.
   */
  productLinkPattern?: string;
  /**
   * Try Firefox before Chromium. Firefox scores better on Cloudflare's bot
   * detection heuristics. Set true for sites protected by Cloudflare.
   */
  useFirefoxFirst?: boolean;
  rateLimit?: number;
}

/**
 * Returns true only for Squarespace CDN image URLs that are actually renderable.
 * Rejects:
 *  - null / empty
 *  - directory paths (no file extension, trailing slash, or timestamp-only segment)
 *  - data: URIs
 * Accepts:
 *  - images.squarespace-cdn.com URLs
 *  - static*.squarespace.com URLs that end with an image extension
 */
function isValidSquarespaceImageUrl(url: string | null | undefined): url is string {
  if (!url || url.startsWith('data:')) return false;
  // Must be https
  if (!url.startsWith('https://')) return false;
  // CDN hostname is always valid
  if (url.includes('images.squarespace-cdn.com')) return true;
  // static*.squarespace.com — must end with an image extension (not a directory path)
  if (url.includes('squarespace.com')) {
    return /\.(jpe?g|png|gif|webp|avif|svg)(\?.*)?$/i.test(url);
  }
  // Any other https URL with an image extension
  return /\.(jpe?g|png|gif|webp|avif|svg)(\?.*)?$/i.test(url);
}

// Squarespace product grid selectors — tried in order, first match wins
const CARD_SELECTORS = [
  '[data-item-id]',
  '.ProductList-item',
  '.products-flex-row .product',
  'article[class*="ProductList"]',
  'li[class*="ProductList"]',
];

const TITLE_SELECTORS = [
  '.ProductList-item-title',
  '[data-compound-title]',
  'h1[class*="title"]',
  'h2[class*="title"]',
  'h3[class*="title"]',
  '.product-title',
];

const PRICE_SELECTORS = [
  '.ProductList-price',
  '.sqs-money-native',
  '[class*="price"]:not([class*="compare"])',
];

export abstract class SquarespaceBaseAdapter extends BaseAdapter {
  protected sqConfig: SquarespaceAdapterConfig;

  constructor(config: SquarespaceAdapterConfig) {
    super({
      sourceId: config.sourceId,
      sourceName: config.sourceName,
      baseUrl: config.baseUrl,
      rateLimit: config.rateLimit ?? 2500,
      maxRetries: 2,
      maxPages: 20,
    });
    this.sqConfig = config;
  }

  async scrape(): Promise<ScrapeResult> {
    const listings: ScrapedListing[] = [];
    const errors: string[] = [];
    const diagnostics: Record<string, any> = {
      strategy: 'html-listing/playwright',
      listingUrl: this.sqConfig.listingUrl,
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

    // ── Strategy 0: Squarespace ?format=json HTTP API (no Playwright) ──────
    // Most Squarespace stores expose ?format=json which returns full product
    // data without needing a browser. Try this first; fall back to Playwright
    // only if it returns non-JSON or an empty items array.
    try {
      const jsonListings = await this.scrapeViaFormatJson();
      if (jsonListings !== null) {
        diagnostics.strategy = 'format-json-api';
        diagnostics.jsonContextUsed = true;
        diagnostics.cardsFound = jsonListings.length;
        diagnostics.pagesProcessed = 1;
        for (const l of jsonListings) {
          if (l.isAvailable) diagnostics.inStock++;
          else diagnostics.outOfStock++;
        }
        if (jsonListings.length > 0) {
          diagnostics.sampleTitles = jsonListings.slice(0, 3).map(l => l.sourceTitle);
          diagnostics.sampleUrls = jsonListings.slice(0, 3).map(l => l.sourceUrl);
        }
        this.log('info', `Done. ${jsonListings.length} listings | ${diagnostics.inStock} in-stock | ${diagnostics.outOfStock} out-of-stock | via format=json API`);
        return { listings: jsonListings, totalFound: jsonListings.length, errors, diagnostics };
      }
    } catch (err: any) {
      this.log('info', `format=json API unavailable (${err.message}) — falling back to Playwright`);
    }

    if (process.env.SCRAPER_NO_PLAYWRIGHT === 'true') {
      const msg = `${this.config.sourceName}: format=json API returned nothing and Playwright is disabled (SCRAPER_NO_PLAYWRIGHT=true)`;
      this.log('warn', msg);
      return { listings: [], totalFound: 0, errors: [msg], diagnostics };
    }

    // Firefox scores better on Cloudflare; fall back to Chromium if binary absent.
    let browser: Awaited<ReturnType<typeof firefox.launch>> | Awaited<ReturnType<typeof chromium.launch>>;
    let usingFirefox = false;
    if (this.sqConfig.useFirefoxFirst !== false) {
      try {
        browser = await firefox.launch({ headless: true });
        usingFirefox = true;
        this.log('info', 'Launched Firefox');
      } catch {
        this.log('info', 'Firefox unavailable — falling back to Chromium');
      }
    }
    if (!browser!) {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
               '--disable-blink-features=AutomationControlled'],
      });
    }

    try {
      const context = await browser.newContext({
        userAgent: usingFirefox
          ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0'
          : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-US',
        acceptDownloads: false,
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Upgrade-Insecure-Requests': '1',
        },
      });

      if (!usingFirefox) {
        await context.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          (window as any).chrome = { runtime: {} };
        });
      }

      const page = await context.newPage();

      // Warm session: visit homepage so Cloudflare issues cookies before listing page.
      // If listingUrl IS the homepage this is a no-op second visit (cheap).
      if (this.sqConfig.listingUrl !== this.sqConfig.baseUrl) {
        this.log('info', `Warming session via homepage (${usingFirefox ? 'Firefox' : 'Chromium'})...`);
        try {
          const homeResp = await page.goto(this.sqConfig.baseUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 25000,
          });
          const homeStatus = homeResp?.status() ?? 0;
          this.log('info', `Homepage HTTP ${homeStatus}`);
          if (homeStatus === 200) {
            await this.delay(this.sqConfig.useFirefoxFirst ? 3000 + Math.random() * 2000 : 1000);
          } else {
            this.log('warn', `Homepage returned ${homeStatus} — Cloudflare may be blocking this IP`);
          }
        } catch (e: any) {
          this.log('warn', `Homepage warm failed: ${e.message}`);
        }
      }

      const listingBase = this.sqConfig.listingUrl;
      let pageNum = 1;
      let hasMore = true;

      while (hasMore && pageNum <= this.config.maxPages!) {
        const url = pageNum === 1 ? listingBase : `${listingBase}?page=${pageNum}`;
        this.log('info', `Fetching page ${pageNum}: ${url}`);

        try {
          const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
          const httpStatus = resp?.status() ?? 0;
          this.log('info', `Page ${pageNum} HTTP ${httpStatus}`);
          if (httpStatus === 503 || httpStatus === 403) {
            errors.push(`Page ${pageNum}: HTTP ${httpStatus} — bot protection active on ${url}`);
            hasMore = false;
            break;
          }
        } catch {
          this.log('warn', `Page ${pageNum} networkidle timeout — attempting extraction anyway`);
        }

        // ── Strategy 1: Squarespace embedded JSON context ──────────────
        const jsonItems = await page.evaluate(() => {
          const win = window as any;
          const ctxItems =
            win?.Static?.SQUARESPACE_CONTEXT?.collection?.items ||
            win?.Static?.SQUARESPACE_CONTEXT?.pageContext?.items;
          if (Array.isArray(ctxItems) && ctxItems.length > 0) return ctxItems;

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

          const pageInfo = await page.evaluate(() => {
            const win = window as any;
            const col = win?.Static?.SQUARESPACE_CONTEXT?.collection;
            return { itemCount: col?.itemCount ?? 0, pageSize: col?.pageSize ?? 12 };
          });
          hasMore = pageNum * (pageInfo.pageSize || 12) < (pageInfo.itemCount || 0);
          if (hasMore) diagnostics.paginationDetected = true;

        } else {
          // ── Strategy 2: DOM extraction ──────────────────────────────
          this.log('info', `Page ${pageNum}: JSON context empty — falling back to DOM extraction`);
          const linkPattern = this.sqConfig.productLinkPattern;

          const domResult = await page.evaluate(
            ({ cardSels, titleSels, priceSels, linkPat }:
              { cardSels: string[]; titleSels: string[]; priceSels: string[]; linkPat: string | undefined }) => {
              let cardEls: Element[] = [];
              let usedSelector = '';
              for (const sel of cardSels) {
                const found = Array.from(document.querySelectorAll(sel));
                if (found.length > 0) { cardEls = found; usedSelector = sel; break; }
              }

              if (cardEls.length === 0 && linkPat) {
                const productLinks = Array.from(
                  document.querySelectorAll(`a[href*="${linkPat}"]`)
                ) as HTMLAnchorElement[];
                const seen = new Set<string>();
                cardEls = productLinks.reduce((acc, a) => {
                  const ancestor = a.closest('article, li, [class*="item"], [class*="product"]') ?? a;
                  const key = ancestor.className + ancestor.getAttribute('data-item-id');
                  if (!seen.has(key)) { seen.add(key); acc.push(ancestor); }
                  return acc;
                }, [] as Element[]);
                usedSelector = `a[href*="${linkPat}"] ancestor`;
              }

              const extract = (el: Element, sels: string[]): string => {
                for (const s of sels) {
                  const t = el.querySelector(s)?.textContent?.trim();
                  if (t) return t;
                }
                return '';
              };

              const cards = cardEls.map(card => {
                const linkQuery = linkPat
                  ? `a[href*="${linkPat}"]`
                  : 'a';
                const linkEl = card.querySelector(linkQuery) as HTMLAnchorElement | null
                  ?? card.closest('a') as HTMLAnchorElement | null;
                const href = linkEl?.href ?? '';

                const title = extract(card, titleSels) || linkEl?.textContent?.trim() || '';
                const price = extract(card, priceSels);

                const imgEl = card.querySelector('img[data-src], img[src]') as HTMLImageElement | null;
                let imgSrc = imgEl?.dataset?.src ?? '';
                if (!imgSrc || imgSrc.startsWith('data:')) imgSrc = imgEl?.src ?? '';
                if (!imgSrc || imgSrc.startsWith('data:')) {
                  // Squarespace lazy-loads images; check noscript fallback
                  const noscript = card.querySelector('noscript');
                  const m = noscript?.innerHTML?.match(/src="([^"]+)"/);
                  imgSrc = m?.[1] ?? '';
                }
                if (imgSrc.startsWith('data:')) imgSrc = '';

                const cardText = (card.textContent ?? '').toLowerCase();
                const hasSoldOut =
                  !!card.querySelector('.sold-out, [class*="soldOut"], [class*="sold-out"]') ||
                  cardText.includes('sold out') ||
                  cardText.includes('out of stock');

                const stockMatch = (card.textContent ?? '').match(/only\s+(\d+)\s+left/i);
                const stockText = stockMatch ? stockMatch[0] : '';

                return { href, title, price, imgSrc, hasSoldOut, stockText };
              }).filter(c => c.href || c.title);

              return { cards, usedSelector, pageTitle: document.title };
            },
            { cardSels: CARD_SELECTORS, titleSels: TITLE_SELECTORS, priceSels: PRICE_SELECTORS, linkPat: linkPattern }
          );

          this.log('info', `Page ${pageNum}: ${domResult.cards.length} cards via DOM (selector: "${domResult.usedSelector}", page: "${domResult.pageTitle}")`);

          if (domResult.cards.length === 0) {
            this.log('warn', `No product cards found on page ${pageNum}`);
            errors.push(`Page ${pageNum}: 0 cards found (page title: "${domResult.pageTitle}")`);
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
                currency: this.sqConfig.currency ?? 'USD',
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
                images: isValidSquarespaceImageUrl(card.imgSrc) ? [{ url: card.imgSrc, isPrimary: true }] : [],
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

  /** Fetch all items via Squarespace ?format=json API (no Playwright required). */
  private async scrapeViaFormatJson(): Promise<ScrapedListing[] | null> {
    const listings: ScrapedListing[] = [];
    const base = this.sqConfig.listingUrl;
    let fetchUrl = `${base}${base.includes('?') ? '&' : '?'}format=json`;

    for (let page = 1; page <= (this.config.maxPages ?? 20); page++) {
      const res = await fetch(fetchUrl, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok) return null;

      const data = await res.json() as any;
      if (!Array.isArray(data?.items)) return null;
      if (page === 1 && data.items.length === 0) return null; // empty = API not useful

      for (const item of data.items) {
        // Skip non-product items (e.g., type 1 = blog, 11 = store-item)
        if (item.recordType != null && item.recordType !== 11) continue;
        const listing = this.extractFromSquarespaceItem(item);
        if (listing) listings.push(listing);
      }

      if (data.pagination?.nextPage && data.pagination?.nextPageUrl) {
        const nextRel = data.pagination.nextPageUrl as string; // e.g. "/?offset=200"
        const sep = nextRel.includes('?') ? '&' : '?';
        fetchUrl = `${this.sqConfig.baseUrl}${nextRel}${sep}format=json`;
        await this.delay(500);
      } else {
        break;
      }
    }

    // Image summary + product-page fallback for any listing still missing images.
    // The collection ?format=json API returns items with directory-style assetUrls;
    // the individual product page ?format=json returns the real CDN image URLs.
    const noImg = listings.filter(l => l.images.length === 0);
    this.log('info', `Image summary: ${listings.length - noImg.length}/${listings.length} with images, ${noImg.length} missing — fetching product pages for those`);
    for (const listing of noImg) {
      try {
        await this.delay(500);
        const res = await fetch(`${listing.sourceUrl}?format=json`, {
          headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
        });
        if (!res.ok) continue;
        const data = await res.json() as any;
        // Product page JSON: top-level item with structuredContent.images, OR
        // items array containing the product entry
        const productItem = Array.isArray(data?.items)
          ? data.items.find((i: any) => i.recordType === 11 || i.recordType === 2)
          : data?.item ?? null;

        if (productItem) {
          const imgs: Array<{ url: string; isPrimary: boolean }> = (
            productItem.structuredContent?.images ?? []
          )
            .filter((img: any) => isValidSquarespaceImageUrl(img?.assetUrl))
            .map((img: any, idx: number) => ({ url: img.assetUrl as string, isPrimary: idx === 0 }));

          if (imgs.length === 0 && isValidSquarespaceImageUrl(productItem.assetUrl)) {
            imgs.push({ url: productItem.assetUrl as string, isPrimary: true });
          }

          if (imgs.length > 0) {
            listing.images = imgs;
            this.log('info', `  ${listing.sourceTitle}: got ${imgs.length} image(s) from product page`);
          }
        }
      } catch {
        // ignore individual failures — best-effort
      }
    }

    return listings;
  }

  private extractFromSquarespaceItem(item: any): ScrapedListing | null {
    if (!item?.title) return null;

    const fullUrl = item.fullUrl
      ? (item.fullUrl.startsWith('http') ? item.fullUrl : `${this.sqConfig.baseUrl}${item.fullUrl}`)
      : null;
    if (!fullUrl) return null;

    const variants = item.variants ?? item.structuredContent?.variants ?? [];
    // Squarespace uses qtyInStock (format-json API) or stock (embedded context).
    // unlimited: true means no stock cap.
    // purchasable is a top-level flag but can be true even when all variant qtys are 0
    // (Squarespace doesn't always sync it). So check variant quantities first.
    let isAvailable: boolean;
    if (variants.length > 0) {
      // Variant-first: at least one variant must be unlimited or have positive qty.
      isAvailable = variants.some((v: any) => {
        if (v.unlimited === true) return true;
        const qty = v.qtyInStock ?? v.stock ?? null;
        return qty == null || qty > 0;
      });
    } else {
      // No variant data: fall back to purchasable flag or assume available.
      isAvailable = item.purchasable !== false;
    }

    // priceMoney.value is a decimal string (e.g. "27500.00") — convert to cents.
    // variants[].price from format-json API is already in cents (e.g. 2750000).
    // structuredContent.priceCents is already in cents.
    const priceMoneyVal = item.variants?.[0]?.priceMoney?.value;
    const priceCentsRaw = item.structuredContent?.priceCents ?? item.variants?.[0]?.price ?? null;
    const price = priceMoneyVal != null
      ? Math.round(Number(priceMoneyVal) * 100)   // decimal → cents
      : priceCentsRaw != null
        ? Number(priceCentsRaw)                    // already cents
        : null;

    const currencySymbol = ({ USD: '$', GBP: '£', EUR: '€', JPY: '¥' } as Record<string, string>)[this.sqConfig.currency ?? 'USD'] ?? '$';
    const sourcePrice = priceMoneyVal != null
      ? `${currencySymbol}${Number(priceMoneyVal).toFixed(2)}`
      : priceCentsRaw != null && Number(priceCentsRaw) > 0
        ? `${currencySymbol}${(Number(priceCentsRaw) / 100).toFixed(2)}`
        : null;

    // Build image list — prefer structuredContent.images (full gallery with CDN URLs).
    // item.assetUrl is often a Squarespace asset *directory* path (no filename),
    // not a renderable image URL, so validate before using it.
    const structuredImages: Array<{ url: string; isPrimary: boolean }> = (
      item.structuredContent?.images ?? []
    )
      .filter((img: any) => isValidSquarespaceImageUrl(img?.assetUrl))
      .map((img: any, i: number) => ({ url: img.assetUrl as string, isPrimary: i === 0 }));

    const images: Array<{ url: string; isPrimary: boolean }> =
      structuredImages.length > 0
        ? structuredImages
        : isValidSquarespaceImageUrl(item.assetUrl)
          ? [{ url: item.assetUrl as string, isPrimary: true }]
          : isValidSquarespaceImageUrl(item.mainImage?.assetUrl)
            ? [{ url: item.mainImage.assetUrl as string, isPrimary: true }]
            : [];

    const description = item.body
      ? item.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)
      : null;

    const parsed = this.parseFromTitleAndDescription(item.title, description);

    return {
      sourceUrl: fullUrl,
      sourceTitle: item.title,
      sourcePrice,
      price,
      currency: this.sqConfig.currency ?? 'USD',
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
      images,
      isAvailable,
    };
  }

  protected parseFromTitleAndDescription(
    title: string,
    description: string | null
  ): Partial<ScrapedListing> {
    const text = `${title} ${description ?? ''}`;
    const refMatch = text.match(/[Rr]ef\.?\s*#?\s*([A-Z0-9]{3,12}(?:[\/\-][A-Z0-9]{1,6})?)/);
    const yearMatch = text.match(/\b(19[0-9]{2}|20[01][0-9]|202[0-4])\b/);
    const caseMatch = text.match(/\b(\d{2}(?:\.\d)?)\s*mm\b/i);

    const brandMatch = inferBrand(title, description ?? undefined);
    const brand = brandMatch?.brand ?? null;
    const brandMatched = brandMatch?.matched ?? null;

    const model = brandMatched
      ? (title.slice(title.toLowerCase().indexOf(brandMatched.toLowerCase()) + brandMatched.length).trim().replace(/^[-–—\s]+/, '').slice(0, 100) || null)
      : title.slice(0, 100);

    return {
      brand,
      model,
      reference: refMatch?.[1] ?? null,
      year: yearMatch ? parseInt(yearMatch[1]) : null,
      caseSizeMm: caseMatch ? parseFloat(caseMatch[1]) : null,
      movementType: this.normalizeMovement(text),
      condition: this.normalizeCondition(text),
    };
  }
}
