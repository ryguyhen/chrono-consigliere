// src/lib/scraper/adapters/_shopify-base.adapter.ts
// Reusable base for any Shopify-powered dealer site.
// Shopify exposes a public JSON API at /products.json — no auth required.
// This gives us clean structured data without needing to parse HTML.
// DISCLAIMER: All listings link to the original dealer site for purchase.

import { BaseAdapter, type ScrapeResult, type ScrapedListing } from '../base-adapter';
import { inferBrand } from '../brand-inference';

export interface ShopifyAdapterConfig {
  sourceId: string;
  sourceName: string;
  baseUrl: string;
  /** Override if watches live under a specific collection, e.g. /collections/watches */
  watchCollectionHandle?: string;
  /** Tags that indicate a listing is NOT a watch (straps, accessories, books…) */
  nonWatchTags?: string[];
  /** Product types to exclude */
  excludeProductTypes?: string[];
  /**
   * Title keyword exclusion list — substring match, case-insensitive.
   * If any term appears in the product title the product is dropped.
   * Source-specific only; defaults to [].
   */
  excludeTitleTerms?: string[];
  /**
   * Positive allowlist. When set, a product must have at least one tag from
   * this list OR its product_type must match one of watchIndicatorTypes.
   * Products that satisfy no positive indicator are dropped even if they
   * pass the exclusion filters. Leave undefined to skip this gate.
   */
  watchIndicatorTags?: string[];
  /** See watchIndicatorTags — product_type values that confirm "this is a watch" */
  watchIndicatorTypes?: string[];
  rateLimit?: number;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  product_type: string;
  /** Shopify returns tags as string[] on /products.json and /collections/.../products.json */
  tags: string | string[];
  published_at: string | null;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  /** Brand/maker name — reliably set on some stores (e.g. A Collected Man). May be absent. */
  vendor?: string;
}

interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  available: boolean;
  /** May be absent (undefined) when inventory is not tracked */
  inventory_quantity: number | null | undefined;
  inventory_management: string | null;
}

interface ShopifyImage {
  src: string;
  position: number;
  alt: string | null;
  width: number;
  height: number;
}

// Known non-watch keywords to filter out straps, books, accessories, etc.
const DEFAULT_NON_WATCH_TAGS = [
  'strap', 'bracelet', 'nato', 'book', 'accessory', 'accessories',
  'tool', 'pouch', 'gift card', 'lifestyle', 'apparel', 'merch',
  'storage', 'winder', 'watchbox', 'watch box', 'cleaning',
];

const DEFAULT_NON_WATCH_TYPES = [
  'strap', 'book', 'accessory', 'gift card', 'apparel', 'lifestyle',
  'watch strap', 'nato strap', 'leather strap',
];

/**
 * Global title-keyword exclusions applied to ALL Shopify sources.
 * Only terms that are 0% likely to appear in a legitimate watch product title.
 * Source-specific terms go in excludeTitleTerms on the adapter config.
 *
 * Kept deliberately narrow — overcorrection here hides real watches across
 * every source. When in doubt, add the term source-specifically instead.
 */
const DEFAULT_TITLE_EXCLUSIONS = [
  'signage',        // dealer/brand display signs
  'silk scarf',     // branded textile merchandise
  'key pouch',      // branded leather key accessories
  'key chain',      // branded key accessories
  'display stand',  // retail display hardware
  'watch winder',   // winder units (tag layer catches most; this is title fallback)
];

export abstract class ShopifyBaseAdapter extends BaseAdapter {
  protected shopifyConfig: ShopifyAdapterConfig;

  constructor(config: ShopifyAdapterConfig) {
    super({
      sourceId: config.sourceId,
      sourceName: config.sourceName,
      baseUrl: config.baseUrl,
      rateLimit: config.rateLimit ?? 1500,
      maxRetries: 3,
    });
    this.shopifyConfig = config;
  }

  /**
   * Fetch a single page of products, retrying on 429/5xx and transient network errors.
   * Returns:
   *   ShopifyProduct[] — success
   *   'skip'           — non-retryable failure (404/403/HTML); caller tries fallback endpoint
   *   null             — hard failure after all retries; caller stops this source
   *
   * Guarantees: never throws. All network exceptions are caught here and logged
   * with the exact URL and error category so Railway logs show the real cause.
   */
  private async fetchProductsPage(url: string): Promise<ShopifyProduct[] | null | 'skip'> {
    const RETRY_HTTP  = new Set([429, 500, 502, 503, 504]);
    const MAX_ATTEMPTS = 3;
    const TIMEOUT_MS   = 30_000; // 30s — prevents a hanging source from blocking the whole run

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort('timeout'), TIMEOUT_MS);

      let res: Response;
      try {
        res = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
          },
        });
        clearTimeout(timeoutId);
      } catch (err: any) {
        clearTimeout(timeoutId);

        // Classify the underlying network error so logs are actionable
        const cause   = err.cause ?? {};
        const code    = cause.code ?? err.code ?? '';
        const isAbort = err.name === 'AbortError' || String(code).includes('ABORT');
        let category: string;
        if (isAbort)                           category = `TIMEOUT(${TIMEOUT_MS / 1000}s)`;
        else if (code === 'ENOTFOUND')         category = 'DNS_FAILURE';
        else if (code === 'ECONNREFUSED')      category = 'CONN_REFUSED';
        else if (code === 'ECONNRESET')        category = 'CONN_RESET';
        else if (code === 'ETIMEDOUT')         category = 'CONN_TIMEOUT';
        else if (String(code).startsWith('ERR_SSL') ||
                 String(code).startsWith('UND_ERR_TLS')) category = `SSL_ERROR(${code})`;
        else                                   category = `NETWORK_ERROR(${code || (err.message ?? 'unknown')})`;

        if (attempt < MAX_ATTEMPTS) {
          const backoff = attempt * 3000;
          this.log('warn', `${category} on attempt ${attempt}/${MAX_ATTEMPTS} for ${url} — retrying in ${backoff}ms`);
          await this.delay(backoff);
          continue;
        }
        this.log('error', `${category} for ${url} — giving up after ${MAX_ATTEMPTS} attempts`);
        return null;
      }

      // ── HTTP-level handling ───────────────────────────────────────

      // Non-retryable: caller tries the fallback endpoint (root /products.json)
      if (res.status === 404 || res.status === 403) {
        this.log('warn', `HTTP ${res.status} from ${url} — skipping endpoint`);
        return 'skip';
      }

      if (RETRY_HTTP.has(res.status)) {
        if (attempt === MAX_ATTEMPTS) {
          this.log('error', `HTTP ${res.status} from ${url} after ${MAX_ATTEMPTS} attempts — giving up`);
          return null;
        }
        const backoff = attempt * 2000 + Math.random() * 1000;
        this.log('warn', `HTTP ${res.status} from ${url} — retrying in ${Math.round(backoff)}ms (attempt ${attempt}/${MAX_ATTEMPTS})`);
        await this.delay(backoff);
        continue;
      }

      if (!res.ok) {
        this.log('error', `HTTP ${res.status} from ${url} — non-retryable, skipping`);
        return 'skip';
      }

      // Detect HTML bot-protection pages before attempting JSON.parse
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('text/html')) {
        this.log('warn', `HTML response (bot protection / login wall?) from ${url}`);
        return 'skip';
      }

      const text = await res.text();
      try {
        const json = JSON.parse(text) as { products: ShopifyProduct[] };
        return json.products ?? [];
      } catch {
        if (text.trimStart().startsWith('<')) {
          this.log('warn', `HTML body (no JSON content-type) from ${url} — likely bot protection`);
          return 'skip';
        }
        this.log('error', `JSON parse failed for ${url}: ${text.slice(0, 200)}`);
        return null;
      }
    }

    return null;
  }

  async scrape(): Promise<ScrapeResult> {
    const listings: ScrapedListing[] = [];
    let pagesScraped = 0;
    let rawTotal = 0;
    let unavailableFiltered = 0;
    let inventoryZeroFiltered = 0;

    // Debug mode: set SCRAPER_DEBUG=true or SCRAPER_DEBUG_SOURCE=<AdapterClassName>
    const debugAll = process.env.SCRAPER_DEBUG === 'true';
    const debugSource = process.env.SCRAPER_DEBUG_SOURCE;
    const debug = debugAll || (!!debugSource && this.constructor.name === debugSource);

    // Optional pagination cap for low-memory / debug runs
    const maxPages = process.env.SCRAPER_MAX_PAGES
      ? parseInt(process.env.SCRAPER_MAX_PAGES)
      : (this.config.maxPages ?? 50);

    // Drop tracking: reason → [handle, …] (capped at 5 samples each)
    const dropped: Record<string, string[]> = {};
    const addDrop = (reason: string, handle: string) => {
      if (!dropped[reason]) dropped[reason] = [];
      if (dropped[reason].length < 5) dropped[reason].push(handle);
    };

    // Grouped errors: message → [handle, …]
    const errorBuckets: Record<string, string[]> = {};
    const addError = (handle: string, msg: string) => {
      const key = msg.replace(/\b[a-f0-9-]{20,}\b/g, '<id>').slice(0, 80); // strip unique ids
      if (!errorBuckets[key]) errorBuckets[key] = [];
      if (errorBuckets[key].length < 5) errorBuckets[key].push(handle);
    };

    const nonWatchTags = [
      ...DEFAULT_NON_WATCH_TAGS,
      ...(this.shopifyConfig.nonWatchTags ?? []),
    ].map(t => t.toLowerCase());

    const nonWatchTypes = [
      ...DEFAULT_NON_WATCH_TYPES,
      ...(this.shopifyConfig.excludeProductTypes ?? []),
    ].map(t => t.toLowerCase());

    // Title exclusion: global defaults merged with any source-specific terms.
    // Substring match, case-insensitive. Applied as Layer 3 when non-empty.
    const excludeTitleTerms = [
      ...DEFAULT_TITLE_EXCLUSIONS,
      ...(this.shopifyConfig.excludeTitleTerms ?? []),
    ].map(t => t.toLowerCase());

    // Positive watch indicator — if set, product must match at least one
    const watchIndicatorTags = (this.shopifyConfig.watchIndicatorTags ?? [])
      .map(t => t.toLowerCase());
    const watchIndicatorTypes = (this.shopifyConfig.watchIndicatorTypes ?? [])
      .map(t => t.toLowerCase());
    const hasPositiveFilter = watchIndicatorTags.length > 0 || watchIndicatorTypes.length > 0;

    // Build ordered list of endpoints to try — collection first (if configured), root fallback always
    const collectionEndpoint = this.shopifyConfig.watchCollectionHandle
      ? `${this.shopifyConfig.baseUrl}/collections/${this.shopifyConfig.watchCollectionHandle}/products.json`
      : null;
    const rootEndpoint = `${this.shopifyConfig.baseUrl}/products.json`;

    let baseEndpoint = collectionEndpoint ?? rootEndpoint;
    let endpointUsed = baseEndpoint;
    this.log('info', `Starting Shopify scrape via ${baseEndpoint}${debug ? ' [DEBUG]' : ''}`);

    let page = 1;
    let hasMore = true;
    let firstPageProducts: ShopifyProduct[] | null = null;

    while (hasMore && page <= maxPages) {
      const url = `${baseEndpoint}?limit=250&page=${page}`;
      const result = await this.fetchProductsPage(url);

      if (result === 'skip') {
        if (baseEndpoint !== rootEndpoint) {
          this.log('info', `Collection endpoint unavailable, falling back to ${rootEndpoint}`);
          baseEndpoint = rootEndpoint;
          endpointUsed = rootEndpoint;
          page = 1;
          continue;
        }
        addError('(fetch)', `Both collection and root endpoints unavailable for ${this.shopifyConfig.baseUrl}`);
        break;
      }

      if (result === null) {
        addError('(fetch)', `Failed to fetch page ${page} from ${baseEndpoint}`);
        hasMore = false;
        break;
      }

      const products = result;

      if (products.length === 0) {
        this.log('info', `Page ${page} returned 0 products — stopping`);
        hasMore = false;
        break;
      }

      pagesScraped++;
      rawTotal += products.length;
      this.log('info', `Page ${page}: ${products.length} raw products (running total: ${rawTotal})`);

      // Debug: inspect first 3 products on page 1
      if (debug && page === 1) {
        firstPageProducts = products;
        this.log('info', `--- First 3 raw products ---`);
        products.slice(0, 3).forEach((p, i) => {
          const tagsPreview = JSON.stringify(p.tags).slice(0, 120);
          const avail = p.variants?.[0]?.available;
          const invQty = p.variants?.[0]?.inventory_quantity;
          this.log('info', `  [${i}] "${p.title.slice(0, 60)}" | type:"${p.product_type}" | tags:${tagsPreview} | available:${avail} inventory_quantity:${invQty}`);
        });
      }

      for (const product of products) {
        try {
          // Normalize tags — Shopify /products.json returns tags as string[] not string
          const tagsArr: string[] = Array.isArray(product.tags)
            ? product.tags.map(t => t.toLowerCase())
            : (product.tags || '').toLowerCase().split(/,\s*/).filter(Boolean);

          const typeLower = (product.product_type || '').toLowerCase();

          // 1. Product-type exclusion
          const matchedType = nonWatchTypes.find(t => typeLower.includes(t));
          if (matchedType) {
            addDrop(`type:"${product.product_type || '(empty)'}"`, product.handle);
            continue;
          }

          // 2. Tag exclusion
          const matchedTag = nonWatchTags.find(nwt => tagsArr.some(tag => tag.includes(nwt)));
          if (matchedTag) {
            const culpritTag = tagsArr.find(tag => tag.includes(matchedTag)) ?? matchedTag;
            addDrop(`tag:"${culpritTag}"`, product.handle);
            continue;
          }

          // 3. Title keyword exclusion — global defaults + source-specific terms
          {
            const titleLower = product.title.toLowerCase();
            const matchedTerm = excludeTitleTerms.find(term => titleLower.includes(term));
            if (matchedTerm) {
              addDrop(`title-keyword:"${matchedTerm}"`, product.handle);
              continue;
            }
          }

          // 4. Positive watch indicator gate (source-specific, only fires when configured)
          if (hasPositiveFilter) {
            const hasWatchType = watchIndicatorTypes.some(t => typeLower.includes(t));
            const hasWatchTag = watchIndicatorTags.length > 0 &&
              tagsArr.some(tag => watchIndicatorTags.some(wt => tag.includes(wt)));
            if (!hasWatchType && !hasWatchTag) {
              addDrop(`no-watch-indicator(type:"${product.product_type}",tags:[${tagsArr.slice(0, 3).join(',')}])`, product.handle);
              continue;
            }
          }

          // Determine availability per variant:
          // - If the store tracks inventory (inventory_management != null) and
          //   inventory_quantity is explicitly 0, treat that variant as OOS regardless
          //   of the available flag (handles available=true + qty=0 misconfiguration).
          // - Otherwise, trust Shopify's available boolean or a positive inventory_quantity.
          // - Stores that don't track inventory (inventory_management=null, e.g. C4C Japan)
          //   are unaffected by the quantity guard.
          let variantInventoryZero = false;
          const isAvailable = product.variants.some(v => {
            if (v.inventory_management != null && v.inventory_quantity != null && v.inventory_quantity === 0) {
              variantInventoryZero = true;
              return false;
            }
            return v.available === true || (v.inventory_quantity != null && v.inventory_quantity > 0);
          });
          if (!isAvailable) {
            if (variantInventoryZero) inventoryZeroFiltered++;
            else unavailableFiltered++;
            // Don't drop — still persist with isAvailable=false so stale-marking works correctly
          }

          const primaryVariant = product.variants[0];
          const price = this.parsePrice(primaryVariant?.price ?? null);

          const images = (product.images ?? []).map(img => ({
            url: img.src,
            isPrimary: img.position === 1,
            width: img.width,
            height: img.height,
            altText: img.alt ?? undefined,
          }));

          const description = this.stripHtml(product.body_html);
          const parsed = this.parseFromTitleAndDescription(product.title, description);

          listings.push({
            sourceUrl: `${this.shopifyConfig.baseUrl}/products/${product.handle}`,
            sourceTitle: product.title,
            sourcePrice: primaryVariant?.price && parseFloat(primaryVariant.price) > 0 ? `$${primaryVariant.price}` : null,
            brand: this.extractBrand(product.vendor, parsed),
            model: parsed.model ?? null,
            reference: parsed.reference ?? null,
            year: parsed.year ?? null,
            caseSizeMm: parsed.caseSizeMm ?? null,
            caseMaterial: parsed.caseMaterial ?? null,
            dialColor: parsed.dialColor ?? null,
            movementType: parsed.movementType ?? null,
            condition: parsed.condition ?? null,
            style: null,
            price,
            currency: 'USD',
            description,
            images: images as any,
            isAvailable,
          });
        } catch (err: any) {
          addError(product.handle, err.message);
        }
      }

      if (products.length < 250) {
        hasMore = false;
      } else {
        page++;
        await this.delay();
      }
    }

    // Flatten grouped errors back to string array for ScrapeResult
    const errors: string[] = Object.entries(errorBuckets).map(([msg, handles]) =>
      `[${handles.length} products] ${msg} (e.g. ${handles.slice(0, 2).join(', ')})`
    );

    // Drop summary counts
    const totalDropped = Object.values(dropped).reduce((sum, arr) => sum + arr.length, 0);
    const nonWatchFiltered = totalDropped; // kept for diagnostics compat

    // Always log a compact funnel summary
    this.log('info', `Funnel: ${rawTotal} raw → ${totalDropped} dropped (${Object.keys(dropped).map(k => `${k}:${dropped[k].length}`).join(', ') || 'none'}) → ${listings.length} listings (${unavailableFiltered} unavailable, ${inventoryZeroFiltered} qty=0) → ${errors.length} errors`);

    // Debug: full funnel breakdown
    if (debug) {
      this.log('info', `--- Funnel breakdown ---`);
      this.log('info', `  raw fetched:          ${rawTotal}`);
      this.log('info', `  dropped (type/tag):   ${totalDropped}`);
      for (const [reason, handles] of Object.entries(dropped)) {
        this.log('info', `    ${reason}: ${handles.length} (e.g. ${handles.join(', ')})`);
      }
      this.log('info', `  reached normalization: ${rawTotal - totalDropped}`);
      this.log('info', `  isAvailable=false:     ${unavailableFiltered} (+ ${inventoryZeroFiltered} qty=0)`);
      this.log('info', `  isAvailable=true:      ${listings.filter(l => l.isAvailable).length}`);
      this.log('info', `  normalization errors:  ${Object.values(errorBuckets).reduce((s, a) => s + a.length, 0)}`);
      if (Object.keys(errorBuckets).length > 0) {
        this.log('info', `  --- Error groups ---`);
        for (const [msg, handles] of Object.entries(errorBuckets)) {
          this.log('info', `    "${msg}" — ${handles.length} products (e.g. ${handles.join(', ')})`);
        }
      }
      this.log('info', `  total to persist:      ${listings.length}`);
    }

    return {
      listings,
      totalFound: listings.length,
      errors,
      diagnostics: {
        endpointUsed,
        strategy: 'shopify-json',
        pagesScraped,
        rawTotal,
        nonWatchFiltered,
        unavailableFiltered,
        inventoryZeroFiltered,
        dropReasons: Object.fromEntries(Object.entries(dropped).map(([k, v]) => [k, v.length])),
      },
    };
  }

  /**
   * Hook for subclasses to override brand extraction.
   * Default: use whatever inferBrand resolved from title + description.
   * Override when the Shopify store's `vendor` field is more reliable than title inference
   * (e.g. A Collected Man, where titles like "Series 2 | White Gold" omit the brand).
   */
  protected extractBrand(vendor: string | undefined, parsed: Partial<ScrapedListing>): string | null {
    return parsed.brand ?? null;
  }

  protected stripHtml(html: string | null): string | null {
    if (!html) return null;
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000);
  }

  // Parse brand, model, ref, year, case size from title + description.
  // Override this in subclasses for site-specific parsing.
  protected parseFromTitleAndDescription(
    title: string,
    description: string | null
  ): Partial<ScrapedListing> {
    const text = `${title} ${description ?? ''}`;

    // Reference number patterns: "Ref. 5711" or "Ref 16610" or "ref. 1675"
    const refMatch = text.match(/[Rr]ef\.?\s*#?\s*([A-Z0-9]{3,12}(?:[\/\-][A-Z0-9]{1,6})?)/);
    const reference = refMatch?.[1] ?? null;

    // Year: 4-digit year in 1900-2020 range
    const yearMatch = text.match(/\b(19[0-9]{2}|20[01][0-9]|202[0-4])\b/);
    const year = yearMatch ? parseInt(yearMatch[1]) : null;

    // Case size: "38mm" or "38.5mm" or "38 mm"
    const caseMatch = text.match(/\b(\d{2}(?:\.\d)?)\s*mm\b/i);
    const caseSizeMm = caseMatch ? parseFloat(caseMatch[1]) : null;

    // Brand extraction using centralized inference
    const brandMatch = inferBrand(title, description ?? undefined);
    const brand = brandMatch?.brand ?? null;
    const brandMatched = brandMatch?.matched ?? null;

    // Model: everything after the matched brand text in the title
    let model: string | null = null;
    if (brandMatched) {
      const idx = title.toLowerCase().indexOf(brandMatched.toLowerCase());
      model = title.slice(idx + brandMatched.length).trim().replace(/^[-–—\s]+/, '').slice(0, 100) || null;
    } else {
      model = title.slice(0, 100);
    }

    // Case material
    const caseMaterialPatterns: [RegExp, string][] = [
      [/stainless\s*steel|s\.?\s*steel|ss\b/i, 'Stainless Steel'],
      [/yellow\s*gold|18k\s*yg|18kt?\s*yellow/i, 'Yellow Gold'],
      [/white\s*gold|18k\s*wg/i, 'White Gold'],
      [/rose\s*gold|pink\s*gold|18k\s*rg/i, 'Rose Gold'],
      [/platinum|plat\b/i, 'Platinum'],
      [/titanium/i, 'Titanium'],
      [/two.tone|gold.*steel|steel.*gold/i, 'Two-Tone'],
    ];
    let caseMaterial: string | null = null;
    for (const [pattern, mat] of caseMaterialPatterns) {
      if (pattern.test(text)) { caseMaterial = mat; break; }
    }

    // Dial color
    const dialPatterns: [RegExp, string][] = [
      [/black\s*dial/i, 'Black'],
      [/white\s*dial|silver\s*dial/i, 'Silver/White'],
      [/blue\s*dial/i, 'Blue'],
      [/champagne\s*dial/i, 'Champagne'],
      [/green\s*dial/i, 'Green'],
      [/salmon\s*dial|pink\s*dial/i, 'Salmon/Pink'],
      [/cream\s*dial|ivory\s*dial/i, 'Cream'],
      [/grey\s*dial|gray\s*dial/i, 'Grey'],
      [/red\s*dial/i, 'Red'],
    ];
    let dialColor: string | null = null;
    for (const [pattern, color] of dialPatterns) {
      if (pattern.test(text)) { dialColor = color; break; }
    }

    return {
      brand,
      model,
      reference,
      year,
      caseSizeMm,
      caseMaterial,
      dialColor,
      movementType: this.normalizeMovement(text),
      condition: this.normalizeCondition(text),
    };
  }
}
