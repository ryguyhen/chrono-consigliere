import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, RATE_LIMITS, rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { getPublicLandingStats } from '@/lib/landing/public-stats';

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`landing-stats:${ip}`, RATE_LIMITS.browse);
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const stats = await getPublicLandingStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error('[GET /api/public/landing-stats]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
