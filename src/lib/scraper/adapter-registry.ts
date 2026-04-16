// src/lib/scraper/adapter-registry.ts
// Central registry mapping DealerSource.adapterName → adapter class.
// To add a new source:
//   1. Create or extend an adapter class
//   2. Register it here with a string key
//   3. Insert a DealerSource row in the DB with that adapterName

import type { BaseAdapter } from './base-adapter';

import {
  CraftAndTailoredAdapter,
  DadAndSonWatchesAdapter,
  WatchnetJapanAdapter,
  CyclopeWatchesAdapter,
  AnalogShiftAdapter,
  C4CJapanAdapter,
  DobleVintageAdapter,
  VintageWatchServicesAdapter,
  GoldfingersVintageAdapter,
  GoodEveningAdapter,
  CollectorsCornerNYAdapter,
  MentaWatchesAdapter,
  FrancoisePavisAdapter,
  GreyAndPatinaAdapter,
  TheArrowOfTimeAdapter,
  HighEndTimeAdapter,
  EmpireTimeNYAdapter,
  ThillierTimeAdapter,
  DannysVintageWatchesAdapter,
  KawaiiVintageWatchAdapter,
  BulangAndSonsAdapter,
  ACollectedManAdapter,
} from './adapters/all-dealers.adapters';

type AdapterConstructor = new () => BaseAdapter;

export const ADAPTER_REGISTRY: Record<string, AdapterConstructor> = {
  // ── Shopify (JSON API) ─────────────────────────────────────
  CraftAndTailoredAdapter,       // craftandtailored.com
  DadAndSonWatchesAdapter,       // dadandson-watches.com
  WatchnetJapanAdapter,          // watchnet.co.jp (custom CMS → Playwright)
  CyclopeWatchesAdapter,         // cyclopewatches.com (Wix SSR + embedded JSON)
  AnalogShiftAdapter,            // shop.analogshift.com
  C4CJapanAdapter,               // c4cjapan.com
  DobleVintageAdapter,           // doblevintagewatches.com
  GoldfingersVintageAdapter,     // goldfingersvintage.com
  GoodEveningAdapter,            // goodevening.co
  CollectorsCornerNYAdapter,     // collectorscornerny.com
  HighEndTimeAdapter,            // highendtime.com
  EmpireTimeNYAdapter,           // empiretimeny.com
  DannysVintageWatchesAdapter,   // dannysvintagewatches.com
  KawaiiVintageWatchAdapter,     // kawaiivintagewatch.com
  BulangAndSonsAdapter,          // bulangandsons.com
  ACollectedManAdapter,          // acollectedman.com

  // ── WooCommerce (Store API + Playwright fallback) ──────────
  VintageWatchServicesAdapter,   // vintagewatchservices.eu
  MentaWatchesAdapter,           // mentawatches.com
  FrancoisePavisAdapter,         // francoise.paris
  GreyAndPatinaAdapter,          // greyandpatina.com
  TheArrowOfTimeAdapter,         // thearrowoftime.fr
  ThillierTimeAdapter,           // thillier-time.com
};

export function getAdapter(adapterName: string): BaseAdapter | null {
  const Adapter = ADAPTER_REGISTRY[adapterName];
  if (!Adapter) {
    console.warn(`[AdapterRegistry] No adapter registered for: "${adapterName}"`);
    return null;
  }
  return new Adapter();
}

export function listRegisteredAdapters(): string[] {
  return Object.keys(ADAPTER_REGISTRY);
}
