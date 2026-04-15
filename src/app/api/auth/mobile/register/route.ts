// src/app/api/auth/mobile/register/route.ts
//
// POST /api/auth/mobile/register
//
// Credentials registration for native mobile clients.
//
// ── Request ──────────────────────────────────────────────────────────────────
//   { email: string, password: string, name?: string, deviceLabel?: string }
//
// ── Response (201) ───────────────────────────────────────────────────────────
//   Same shape as /api/auth/mobile/token:
//   { accessToken, refreshToken, expiresAt, user }
//
// ── Errors ───────────────────────────────────────────────────────────────────
//   400 — missing or invalid fields
//   409 — email already registered

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { signAccessToken, generateRefreshToken } from '@/lib/auth/mobile-jwt';
import { generateUsername } from '@/lib/auth/generate-username';
import { rateLimit, getClientIp, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';

const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(`register:${ip}`, RATE_LIMITS.register);
  if (!rl.success) return rateLimitResponse(rl);

  let body: { email?: string; password?: string; name?: string; deviceLabel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { email, password, name, deviceLabel } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  // Check for existing account
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const username = generateUsername(normalizedEmail);
  const displayName = name?.trim() || null;

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: displayName,
      passwordHash,
      profile: {
        create: {
          username,
          displayName,
        },
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      profile: {
        select: { username: true, displayName: true, avatarUrl: true },
      },
    },
  });

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

  return NextResponse.json(
    {
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
    },
    { status: 201 }
  );
}
