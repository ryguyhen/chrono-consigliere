// src/app/api/auth/mobile/apple/route.ts
//
// POST /api/auth/mobile/apple
//
// Exchanges an Apple identity token (from expo-apple-authentication) for
// Chrono mobile auth tokens.
//
// ── Request ──────────────────────────────────────────────────────────────────
//   {
//     identityToken: string,           // JWT from Apple
//     fullName?: {                     // Only present on first sign-in
//       givenName?: string | null,
//       familyName?: string | null,
//     } | null,
//     deviceLabel?: string,
//   }
//
// ── Response (200) ───────────────────────────────────────────────────────────
//   Same shape as all mobile auth endpoints:
//   { accessToken, refreshToken, expiresAt, user }
//
// ── Flow ─────────────────────────────────────────────────────────────────────
//   1. Verify Apple identity token using Apple's public JWKS.
//   2. Find or create user by Apple account (provider: 'apple') or email.
//   3. Issue mobile access + refresh tokens.
//
// ── Notes on Apple Sign-In behaviour ─────────────────────────────────────────
//   - Apple only sends `email` and `fullName` on the VERY FIRST authorization.
//     Subsequent sign-ins send only the identity token — no email, no name.
//   - `sub` (Apple user ID) is stable per user per team, so it is the primary
//     lookup key. The linked Account row ensures we can find the user on
//     subsequent sign-ins even without an email in the token.
//   - `aud` in native iOS tokens is the app bundle ID, not a service ID.
//
// ── Errors ───────────────────────────────────────────────────────────────────
//   400 — missing identityToken
//   401 — Apple token is invalid or expired

import { NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { prisma } from '@/lib/db';
import { signAccessToken, generateRefreshToken } from '@/lib/auth/mobile-jwt';
import { generateUsername } from '@/lib/auth/generate-username';

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER   = 'https://appleid.apple.com';
const BUNDLE_ID      = 'com.chronoconsigliere.app';

interface AppleTokenPayload {
  sub: string;            // Apple user ID — stable per user per Team ID
  email?: string;         // Only on first auth; may be a relay address
  email_verified?: string | boolean;
  aud: string;
  iss: string;
}

// JWKS set is cached in module scope — re-used across requests,
// refreshed automatically by `jose` when keys rotate.
const appleJWKS = createRemoteJWKSet(new URL(APPLE_JWKS_URL));

async function verifyAppleIdentityToken(token: string): Promise<AppleTokenPayload | null> {
  try {
    const { payload } = await jwtVerify<AppleTokenPayload>(token, appleJWKS, {
      issuer:   APPLE_ISSUER,
      audience: BUNDLE_ID,
    });
    if (!payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: {
    identityToken?: string;
    fullName?: { givenName?: string | null; familyName?: string | null } | null;
    deviceLabel?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { identityToken, fullName, deviceLabel } = body;
  if (!identityToken) {
    return NextResponse.json({ error: 'identityToken is required.' }, { status: 400 });
  }

  const apple = await verifyAppleIdentityToken(identityToken);
  if (!apple) {
    return NextResponse.json({ error: 'Invalid or expired Apple identity token.' }, { status: 401 });
  }

  // Derive a display name from fullName (only available on first sign-in)
  const givenName  = fullName?.givenName?.trim()  ?? null;
  const familyName = fullName?.familyName?.trim() ?? null;
  const derivedName = [givenName, familyName].filter(Boolean).join(' ') || null;

  // ── Find or create user ────────────────────────────────────────────────────

  // 1. Check for existing linked Apple account (covers all subsequent sign-ins)
  const existingAccount = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: 'apple', providerAccountId: apple.sub } },
    select: { userId: true },
  });

  let userId: string;

  if (existingAccount) {
    userId = existingAccount.userId;
  } else if (apple.email) {
    // 2. First sign-in — Apple provided an email; check if we know this user
    const existingUser = await prisma.user.findUnique({
      where: { email: apple.email },
      select: { id: true },
    });

    if (existingUser) {
      // Link Apple to existing user
      userId = existingUser.id;
      await prisma.account.create({
        data: {
          userId,
          type: 'oauth',
          provider: 'apple',
          providerAccountId: apple.sub,
        },
      });
    } else {
      // 3. Brand-new user — create from scratch
      const username = generateUsername(apple.email);
      const newUser = await prisma.user.create({
        data: {
          email: apple.email,
          name: derivedName,
          emailVerified: new Date(), // Apple emails are verified
          accounts: {
            create: {
              type: 'oauth',
              provider: 'apple',
              providerAccountId: apple.sub,
            },
          },
          profile: {
            create: {
              username,
              displayName: derivedName,
            },
          },
        },
      });
      userId = newUser.id;
    }
  } else {
    // No existing account and no email — this should not happen on a valid
    // first-time Apple sign-in. Return 401 so the client can retry.
    return NextResponse.json(
      { error: 'Could not identify Apple account. Please try again.' },
      { status: 401 }
    );
  }

  // ── Issue tokens ───────────────────────────────────────────────────────────

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
