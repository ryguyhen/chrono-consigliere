// src/lib/rate-limit.ts
//
// Lightweight in-process sliding-window rate limiter.
// Suitable for a single Railway instance at hundreds–low thousands of users.
//
// When you need cross-instance consistency (multiple Railway replicas), swap
// the store for Upstash Redis with @upstash/ratelimit. The call-site API is
// identical — only this file changes.
//
// Usage:
//   const result = rateLimit(`token:${ip}`, RATE_LIMITS.token);
//   if (!result.success) return rateLimitResponse(result);

interface Window {
  count: number;
  resetAt: number; // Unix ms
}

// Module-level store — persists for the lifetime of the Node process.
const store = new Map<string, Window>();

// Sweep expired windows every 2 minutes to prevent unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, win] of store.entries()) {
    if (win.resetAt < now) store.delete(key);
  }
}, 2 * 60 * 1000).unref(); // .unref() so this doesn't keep the process alive in tests

export interface RateLimitConfig {
  limit: number;    // max requests in window
  windowMs: number; // window duration in milliseconds
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;  // Unix ms timestamp when the window resets
}

// Sliding window counter — O(1) per call.
export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const win = store.get(key);

  if (!win || win.resetAt < now) {
    // Start a new window.
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return { success: true, remaining: config.limit - 1, resetAt };
  }

  if (win.count >= config.limit) {
    return { success: false, remaining: 0, resetAt: win.resetAt };
  }

  win.count++;
  return { success: true, remaining: config.limit - win.count, resetAt: win.resetAt };
}

// Extract best-effort client IP from Next.js request headers.
// Railway sets x-forwarded-for on inbound requests.
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? '0.0.0.0';
}

// Named limits used across routes — change here to apply everywhere.
export const RATE_LIMITS = {
  // Auth endpoints — tight windows to block credential stuffing and registration spam.
  token:    { limit: 10, windowMs: 15 * 60 * 1000 } satisfies RateLimitConfig,
  register: { limit: 5,  windowMs: 15 * 60 * 1000 } satisfies RateLimitConfig,
  refresh:  { limit: 30, windowMs: 15 * 60 * 1000 } satisfies RateLimitConfig,
  // Browse — generous enough for real use, blocks automated scraping.
  browse:   { limit: 60, windowMs:      60 * 1000 } satisfies RateLimitConfig,
} as const;

// Standard 429 response body + Retry-After header.
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfterSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.max(retryAfterSeconds, 1)),
      },
    }
  );
}
