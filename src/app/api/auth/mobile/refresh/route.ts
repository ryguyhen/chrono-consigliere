// src/app/api/auth/mobile/refresh/route.ts
//
// POST /api/auth/mobile/refresh
//
// Rotates a mobile refresh token and issues a new access token.
// The old refresh token is revoked and a new one is issued (rotation).
//
// ── Request ──────────────────────────────────────────────────────────────────
//   { refreshToken: string }
//
// ── Response (200) ───────────────────────────────────────────────────────────
//   {
//     accessToken:  string,
//     refreshToken: string,   // new refresh token (old one is now revoked)
//     expiresAt:    number,
//   }
//
// ── Errors ───────────────────────────────────────────────────────────────────
//   400 — missing refreshToken
//   401 — token not found, expired, or already revoked

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '@/lib/auth/mobile-jwt';
import { rateLimit, getClientIp, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(`refresh:${ip}`, RATE_LIMITS.refresh);
  if (!rl.success) return rateLimitResponse(rl);

  let body: { refreshToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { refreshToken } = body;
  if (!refreshToken) {
    return NextResponse.json({ error: 'refreshToken is required.' }, { status: 400 });
  }

  const tokenHash = hashRefreshToken(refreshToken);

  // Find the refresh token record
  const record = await prisma.mobileRefreshToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
      deviceLabel: true,
    },
  });

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    // If the token was already revoked, this may be a replay attack.
    // Revoke ALL tokens for this user as a safety measure.
    if (record?.revokedAt) {
      await prisma.mobileRefreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return NextResponse.json({ error: 'Invalid or expired refresh token.' }, { status: 401 });
  }

  // Rotate: revoke old, issue new
  const newRefresh = generateRefreshToken();

  await prisma.$transaction([
    prisma.mobileRefreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    }),
    prisma.mobileRefreshToken.create({
      data: {
        userId: record.userId,
        tokenHash: newRefresh.hash,
        deviceLabel: record.deviceLabel,
        expiresAt: newRefresh.expiresAt,
      },
    }),
  ]);

  const { token: accessToken, expiresAt } = signAccessToken(record.userId);

  return NextResponse.json({
    accessToken,
    refreshToken: newRefresh.raw,
    expiresAt,
  });
}
