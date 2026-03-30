// src/lib/scraper/adapters/_shopify-base.adapter.ts
// Reusable base for any Shopify-powered dealer site.
// Shopify exposes a public JSON API at /products.json — no auth required.
// This gives us clean structured data without needing to parse HTML.
// DISCLAIMER: All listings link to the original dealer site for purchase.

import { BaseAdapter, type ScrapeResult, type ScrapedListing } from '../base-adapter';

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
  rateLimit?: number;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  product_type: string;
  tags: string;
  published_at: string | null;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  available: boolean;
  inventory_quantity: number;
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

  async scrape(): Promise<ScrapeResult> {
    const listings: ScrapedListing[] = [];
    const errors: string[] = [];
    let page = 1;
    let hasMore = true;

    const nonWatchTags = [
      ...DEFAULT_NON_WATCH_TAGS,
      ...(this.shopifyConfig.nonWatchTags ?? []),
    ].map(t => t.toLowerCase());

    const nonWatchTypes = [
      ...DEFAULT_NON_WATCH_TYPES,
      ...(this.shopifyConfig.excludeProductTypes ?? []),
    ].map(t => t.toLowerCase());

    // Use collection-scoped endpoint if provided, otherwise all products
    const baseEndpoint = this.shopifyConfig.watchCollectionHandle
      ? `${this.shopifyConfig.baseUrl}/collections/${this.shopifyConfig.watchCollectionHandle}/products.json`
      : `${this.shopifyConfig.baseUrl}/products.json`;

    this.log('info', `Starting Shopify scrape via ${baseEndpoint}`);

    while (hasMore) {
      const url = `${baseEndpoint}?limit=250&page=${page}`;

      try {
        const products = await this.withRetry(async () => {
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; ChronoConsigliere/1.0)',
              'Accept': 'application/json',
            },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
          const json = await res.json() as { products: ShopifyProduct[] };
          return json.products;
        });

        if (!products || products.length === 0) {
          hasMore = false;
          break;
        }

        for (const product of products) {
          try {
            // Filter out non-watch products
            const tagsLower = (product.tags || '').toLowerCase();
            const typeLower = (product.product_type || '').toLowerCase();

            const isNonWatch =
              nonWatchTypes.some(t => typeLower.includes(t)) ||
              nonWatchTags.some(t => tagsLower.includes(t));

            if (isNonWatch) continue;

            // Only include products with at least one available variant
            const availableVariants = product.variants.filter(
              v => v.available || v.inventory_quantity === null || v.inventory_quantity > 0
            );

            // For watches that are individual unique pieces, "sold out" = unavailable
            const isAvailable = availableVariants.length > 0;

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
              sourcePrice: primaryVariant?.price ? `$${primaryVariant.price}` : null,
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
              price,
              currency: 'USD',
              description,
              images: images as any,
              isAvailable,
            });
          } catch (err: any) {
            errors.push(`Product ${product.handle}: ${err.message}`);
          }
        }

        // Shopify pages: if we got fewer than 250, we're done
        if (products.length < 250) {
          hasMore = false;
        } else {
          page++;
          await this.delay();
        }
      } catch (err: any) {
        this.log('error', `Page ${page} failed: ${err.message}`);
        errors.push(err.message);
        hasMore = false;
      }
    }

    this.log('info', `Done. ${listings.length} watch listings, ${errors.length} errors`);
    return { listings, totalFound: listings.length, errors };
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

    // Brand extraction from beginning of title
    const knownBrands = [
      'Rolex', 'Omega', 'Patek Philippe', 'Audemars Piguet', 'A. Lange & Söhne',
      'IWC', 'Jaeger-LeCoultre', 'Vacheron Constantin', 'Breguet', 'Tudor',
      'Heuer', 'TAG Heuer', 'Breitling', 'Cartier', 'Piaget', 'Zenith',
      'Longines', 'Universal Genève', 'Movado', 'Hamilton', 'Seiko',
      'Grand Seiko', 'Citizen', 'Tissot', 'Eterna', 'Enicar', 'Doxa',
      'Glycine', 'Vulcain', 'Wittnauer', 'Bulova', 'Elgin', 'Waltham',
      'Panerai', 'Hublot', 'Richard Mille', 'FP Journe', 'H. Moser',
      'MB&F', 'De Bethune', 'Roger Dubuis', 'Ulysse Nardin', 'Chopard',
      'Bvlgari', 'Montblanc', 'Rado', 'Oris', 'Bell & Ross', 'Sinn',
      'Glashütte Original', 'Nomos', 'Junghans', 'Laco', 'Stowa',
      'Hanhart', 'Tutima', 'Dubey & Schaldenbrand', 'Corum', 'Ebel',
      'Girard-Perregaux', 'Blancpain', 'Frederique Constant', 'Ball',
    ];

    let brand: string | null = null;
    const titleUpper = title.toUpperCase();
    for (const b of knownBrands) {
      if (titleUpper.includes(b.toUpperCase())) {
        brand = b;
        break;
      }
    }

    // Model: everything after the brand in the title
    let model: string | null = null;
    if (brand) {
      const idx = title.toUpperCase().indexOf(brand.toUpperCase());
      model = title.slice(idx + brand.length).trim().replace(/^[-–—\s]+/, '').slice(0, 100) || null;
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
