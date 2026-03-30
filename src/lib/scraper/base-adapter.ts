// src/lib/scraper/base-adapter.ts
// Base class for all dealer scraper adapters.
// To add a new source: extend BaseAdapter, implement scrape(), then register in adapter-registry.ts

import type { Page, Browser } from 'playwright';

export interface ScrapedListing {
  sourceUrl: string;
  sourceTitle: string;
  sourcePrice: string | null;

  // Normalized fields — populate as many as possible
  brand: string | null;
  model: string | null;
  reference: string | null;
  year: number | null;
  caseSizeMm: number | null;
  caseMaterial: string | null;
  dialColor: string | null;
  movementType: 'AUTOMATIC' | 'MANUAL' | 'QUARTZ' | 'SPRINGDRIVE' | null;
  condition: 'UNWORN' | 'MINT' | 'EXCELLENT' | 'VERY_GOOD' | 'GOOD' | 'FAIR' | null;
  style: string | null;
  price: number | null; // in cents
  currency: string;
  description: string | null;
  images: { url: string; isPrimary: boolean }[];
  isAvailable: boolean;
}

export interface ScrapeResult {
  listings: ScrapedListing[];
  totalFound: number;
  errors: string[];
}

export interface AdapterConfig {
  sourceId: string;
  sourceName: string;
  baseUrl: string;
  rateLimit?: number;  // ms between requests
  maxRetries?: number;
  maxPages?: number;
}

export abstract class BaseAdapter {
  protected config: AdapterConfig;
  protected browser?: Browser;
  protected errors: string[] = [];

  constructor(config: AdapterConfig) {
    this.config = {
      rateLimit: 2000,
      maxRetries: 3,
      maxPages: 50,
      ...config,
    };
  }

  abstract scrape(): Promise<ScrapeResult>;

  protected async delay(ms?: number): Promise<void> {
    const wait = ms ?? (this.config.rateLimit! + Math.random() * 1000);
    return new Promise(resolve => setTimeout(resolve, wait));
  }

  protected async withRetry<T>(
    fn: () => Promise<T>,
    retries = this.config.maxRetries!
  ): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === retries) throw err;
        const backoff = attempt * 2000 + Math.random() * 1000;
        await this.delay(backoff);
      }
    }
    throw new Error('Max retries exceeded');
  }

  protected log(level: 'info' | 'warn' | 'error', message: string) {
    const ts = new Date().toISOString();
    console[level === 'info' ? 'log' : level](
      `[${ts}] ${level.toUpperCase()} ${this.constructor.name}: ${message}`
    );
  }

  protected parsePrice(raw: string | null): number | null {
    if (!raw) return null;
    const cleaned = raw.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) return null;
    const cents = Math.round(parsed * 100);
    // Guard against INT4 overflow (max ~$21M) — null out absurd values
    return cents > 2_147_483_647 ? null : cents;
  }

  protected parseCaseMm(raw: string | null): number | null {
    if (!raw) return null;
    const match = raw.match(/(\d+(?:\.\d+)?)\s*mm/i);
    return match ? parseFloat(match[1]) : null;
  }

  protected normalizeCondition(raw: string | null): ScrapedListing['condition'] {
    if (!raw) return null;
    const lower = raw.toLowerCase();
    if (lower.includes('unworn') || lower.includes('new')) return 'UNWORN';
    if (lower.includes('mint')) return 'MINT';
    if (lower.includes('excellent')) return 'EXCELLENT';
    if (lower.includes('very good')) return 'VERY_GOOD';
    if (lower.includes('good')) return 'GOOD';
    if (lower.includes('fair')) return 'FAIR';
    return null;
  }

  protected normalizeMovement(raw: string | null): ScrapedListing['movementType'] {
    if (!raw) return null;
    const lower = raw.toLowerCase();
    if (lower.includes('automatic') || lower.includes('self-wind')) return 'AUTOMATIC';
    if (lower.includes('manual') || lower.includes('hand-wind') || lower.includes('hand wind')) return 'MANUAL';
    if (lower.includes('quartz')) return 'QUARTZ';
    if (lower.includes('spring drive')) return 'SPRINGDRIVE';
    return null;
  }
}
