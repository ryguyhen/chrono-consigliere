// src/app/api/browse/route.ts
//
// GET /api/browse
//
// JSON browse endpoint for the collector-facing product.
// Accepts the same filter params as the web browse page and returns structured
// JSON suitable for direct consumption by a native mobile client.
//
// ── Inputs ────────────────────────────────────────────────────────────────────
//
//   q          string              Full-text search across brand, model, reference, description
//   brand      string | string[]   Filter by brand name (case-insensitive, multi-value)
//   style      string | string[]   Filter by watch style enum (SPORT, DRESS, DIVE, …)
//   movement   string | string[]   Filter by movement type (AUTOMATIC, MANUAL, QUARTZ, …)
//   condition  string | string[]   Filter by condition (UNWORN, MINT, EXCELLENT, …)
//   dealer     string | string[]   Filter by dealer slug (multi-value)
//   minPrice   number              Minimum price in whole currency units (not cents)
//   maxPrice   number              Maximum price in whole currency units
//   sort       string              One of: newest (default) | price-asc | price-desc | most-liked
//   page       number              1-based page number (default 1)
//   facets     boolean             Pass facets=false to skip the facet queries (default true)
//                                  Useful when paginating and facets are already cached client-side.
//
// ── Response ──────────────────────────────────────────────────────────────────
//
//   {
//     listings:   Listing[]        Current page of watch listings
//     pagination: {
//       page:       number         Current page (1-based)
//       pageSize:   number         Listings per page (fixed at 24)
//       total:      number         Total listings matching the active filters
//       totalPages: number         Total pages (ceil(total / pageSize))
//       hasMore:    boolean        Convenience flag — true when page < totalPages
//     }
//     filters: {                   Echo of the parsed, normalised filter inputs
//       q, brand, style, movement, condition, dealer, minPrice, maxPrice, sort
//     }
//     facets?: {                   Omitted when facets=false is passed
//       brands:     { value, count }[]
//       styles:     { value, count }[]
//       movements:  { value, count }[]
//       conditions: { value, count }[]
//       dealers:    { value, label, count }[]
//     }
//   }
//
// ── Notes ─────────────────────────────────────────────────────────────────────
//
//   • listing.price is in cents (integer) or null. listing.currency is ISO 4217.
//   • listing.isLiked / isSaved / isOwned are boolean when authenticated, null otherwise.
//   • Only active sources and available, non-duplicate listings are returned.
//     These rules are enforced in getWatches() via PUBLIC_WHERE and cannot be bypassed.
//   • Authentication is optional. Unauthenticated requests receive listings with
//     isLiked/isSaved/isOwned set to null.
//
// ── Example ───────────────────────────────────────────────────────────────────
//
//   GET /api/browse?brand=Rolex&style=SPORT&sort=newest&page=2&facets=false

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth/get-auth-user';
import { getWatches, getFilterOptions } from '@/lib/watches/queries';
import { parseBrowseFilters } from '@/lib/watches/filters';
import { rateLimit, getClientIp, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`browse:${ip}`, RATE_LIMITS.browse);
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const appVersion = req.headers.get('x-app-version');
    if (appVersion) console.log(`[browse] app-version=${appVersion}`);

    const userId = await getAuthUserId(req);

    // Parse URL params — supports multi-value keys (brand=Rolex&brand=Omega)
    const sp = req.nextUrl.searchParams;
    const rawParams: Record<string, string | string[]> = {};
    for (const [key, value] of sp.entries()) {
      const existing = rawParams[key];
      if (existing) {
        rawParams[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
      } else {
        rawParams[key] = value;
      }
    }

    const filters = parseBrowseFilters(rawParams);
    const includeFacets = sp.get('facets') !== 'false';

    const [{ watches, total, page, pageSize, hasMore }, facets] = await Promise.all([
      getWatches(filters, userId ?? undefined),
      includeFacets ? getFilterOptions() : Promise.resolve(null),
    ]);

    const response: Record<string, unknown> = {
      listings: watches,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasMore,
      },
      filters: {
        q:         filters.q ?? null,
        brand:     filters.brand ?? [],
        style:     filters.style ?? [],
        movement:  filters.movement ?? [],
        condition: filters.condition ?? [],
        dealer:    filters.dealer ?? [],
        minPrice:  filters.minPrice ?? null,
        maxPrice:  filters.maxPrice ?? null,
        sort:      filters.sort ?? 'newest',
      },
    };

    if (facets !== null) {
      response.facets = facets;
    }

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('[GET /api/browse]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
