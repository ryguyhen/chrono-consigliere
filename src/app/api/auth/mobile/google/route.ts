// src/app/api/auth/mobile/google/route.ts
//
// POST /api/auth/mobile/google
//
// Exchanges a Google ID token (from the native Google Sign-In SDK or
// expo-auth-session) for Chrono mobile auth tokens.
//
// ── Request ──────────────────────────────────────────────────────────────────
//   { idToken: string, deviceLabel?: string }
//
// ── Response (200) ───────────────────────────────────────────────────────────
//   Same shape as /api/auth/mobile/token:
//   { accessToken, refreshToken, expiresAt, user }
//
// ── Flow ─────────────────────────────────────────────────────────────────────
//   1. Verify the Google ID token with Google's public tokeninfo endpoint.
//   2. Find or create the user + profile (same logic as the web OAuth flow).
//   3. Link the Google account if user exists but Google isn't linked yet.
//   4. Issue mobile access + refresh tokens.
//
// ── Errors ───────────────────────────────────────────────────────────────────
//   400 — missing idToken
//   401 — Google token is invalid or expired

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signAccessToken, generateRefreshToken } from '@/lib/auth/mobile-jwt';
import { generateUsername } from '@/lib/auth/generate-username';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';

interface GoogleTokenPayload {
  sub: string;       // Google user ID
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  aud: string;
}

async function verifyGoogleIdToken(idToken: string): Promise<GoogleTokenPayload | null> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!res.ok) return null;
    const data = await res.json() as GoogleTokenPayload;

    // Verify audience matches our client ID
    if (GOOGLE_CLIENT_ID && data.aud !== GOOGLE_CLIENT_ID) return null;
    if (!data.email || !data.sub) return null;

    return data;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: { idToken?: string; deviceLabel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { idToken, deviceLabel } = body;
  if (!idToken) {
    return NextResponse.json({ error: 'idToken is required.' }, { status: 400 });
  }

  const google = await verifyGoogleIdToken(idToken);
  if (!google) {
    return NextResponse.json({ error: 'Invalid or expired Google ID token.' }, { status: 401 });
  }

  // ── Find or create user ────────────────────────────────────────────────────

  // First: check if we already have a linked Google account
  const existingAccount = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: 'google', providerAccountId: google.sub } },
    select: { userId: true },
  });

  let userId: string;

  if (existingAccount) {
    // User already has a linked Google account
    userId = existingAccount.userId;
  } else {
    // Check if user exists by email (credentials account, no Google link)
    const existingUser = await prisma.user.findUnique({
      where: { email: google.email },
      select: { id: true, image: true },
    });

    if (existingUser) {
      // Link Google to existing user
      userId = existingUser.id;
      await prisma.account.create({
        data: {
          userId,
          type: 'oauth',
          provider: 'google',
          providerAccountId: google.sub,
        },
      });
      // Backfill avatar if not set
      if (!existingUser.image && google.picture) {
        await prisma.user.update({
          where: { id: userId },
          data: { image: google.picture },
        });
      }
    } else {
      // Brand-new user
      const username = generateUsername(google.email);
      const newUser = await prisma.user.create({
        data: {
          email: google.email,
          name: google.name ?? null,
          image: google.picture ?? null,
          emailVerified: google.email_verified ? new Date() : null,
          accounts: {
            create: {
              type: 'oauth',
              provider: 'google',
              providerAccountId: google.sub,
            },
          },
          profile: {
            create: {
              username,
              displayName: google.name ?? null,
            },
          },
        },
      });
      userId = newUser.id;
    }
  }

  // ── Issue tokens ───────────────────────────────────────────────────────────

  // Fetch full user profile for the response
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
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

  const { token: accessToken, expiresAt } = signAccessToken(userId);
  const refresh = generateRefreshToken();

  await prisma.mobileRefreshToken.create({
    data: {
      userId,
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
