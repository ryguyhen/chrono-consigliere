// src/app/api/auth/mobile/token/route.ts
//
// POST /api/auth/mobile/token
//
// Credentials login for native mobile clients.
//
// ── Request ──────────────────────────────────────────────────────────────────
//   { email: string, password: string, deviceLabel?: string }
//
// ── Response (200) ───────────────────────────────────────────────────────────
//   {
//     accessToken:  string,   // short-lived JWT (15 min)
//     refreshToken: string,   // opaque, long-lived (30 days)
//     expiresAt:    number,   // Unix timestamp when accessToken expires
//     user: {
//       id:          string,
//       email:       string,
//       name:        string | null,
//       username:    string,
//       displayName: string | null,
//       avatarUrl:   string | null,
//     }
//   }
//
// ── Errors ───────────────────────────────────────────────────────────────────
//   400 — missing email or password
//   401 — invalid credentials

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { signAccessToken, generateRefreshToken } from '@/lib/auth/mobile-jwt';
import { rateLimit, getClientIp, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(`token:${ip}`, RATE_LIMITS.token);
  if (!rl.success) return rateLimitResponse(rl);

  let body: { email?: string; password?: string; deviceLabel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { email, password, deviceLabel } = body;
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  // Look up user + profile in one query
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      image: true,
      profile: {
        select: {
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  // Issue tokens
  const { token: accessToken, expiresAt } = signAccessToken(user.id);
  const refresh = generateRefreshToken();

  await prisma.mobileRefreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refresh.hash,
      deviceLabel: deviceLabel ?? null,
      expiresAt: refresh.expiresAt,
    },
  });

  return NextResponse.json({
    accessToken,
    refreshToken: refresh.raw,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.profile?.username ?? null,
      displayName: user.profile?.displayName ?? null,
      avatarUrl: user.profile?.avatarUrl ?? user.image ?? null,
    },
  });
}
