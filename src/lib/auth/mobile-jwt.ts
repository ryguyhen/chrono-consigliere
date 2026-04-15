// src/lib/auth/mobile-jwt.ts
//
// JWT utilities for native mobile clients.
//
// Access tokens: short-lived JWTs (15 min) containing the user ID.
// Refresh tokens: opaque random strings stored as SHA-256 hashes in the DB.
//
// Secret precedence:
//   MOBILE_JWT_SECRET  (preferred — set this in Railway to decouple mobile
//                       token signing from the web session secret)
//   NEXTAUTH_SECRET    (fallback — works but means rotating the web secret
//                       also invalidates all mobile access tokens)
//   AUTH_SECRET        (legacy alias for NEXTAUTH_SECRET)
//
// Action: add MOBILE_JWT_SECRET as a separate Railway env var so that
// NEXTAUTH_SECRET can be rotated independently of mobile sessions.

import { createHmac, randomBytes, createHash } from 'crypto';

const SECRET =
  process.env.MOBILE_JWT_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  process.env.AUTH_SECRET ??
  '';

if (!SECRET) {
  console.warn('[mobile-jwt] No signing secret found — mobile auth will fail. ' +
    'Set MOBILE_JWT_SECRET (preferred) or NEXTAUTH_SECRET in your environment.');
}

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;          // 15 minutes
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const AUDIENCE = 'chrono:mobile';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function base64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function base64urlEncode(str: string): string {
  return Buffer.from(str).toString('base64url');
}

function hmacSign(data: string): string {
  return createHmac('sha256', SECRET).update(data).digest('base64url');
}

// ─── Access Token (JWT) ──────────────────────────────────────────────────────

export interface MobileAccessPayload {
  sub: string;   // userId
  aud: string;   // "chrono:mobile"
  iat: number;
  exp: number;
}

export function signAccessToken(userId: string): { token: string; expiresAt: number } {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ACCESS_TOKEN_TTL_SECONDS;

  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64urlEncode(JSON.stringify({
    sub: userId,
    aud: AUDIENCE,
    iat: now,
    exp,
  }));

  const signature = hmacSign(`${header}.${payload}`);
  return { token: `${header}.${payload}.${signature}`, expiresAt: exp };
}

export function verifyAccessToken(token: string): MobileAccessPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expected = hmacSign(`${header}.${payload}`);

  // Constant-time comparison
  if (signature.length !== expected.length) return null;
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (!sigBuf.equals(expBuf)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as MobileAccessPayload;
    if (decoded.aud !== AUDIENCE) return null;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    if (!decoded.sub) return null;
    return decoded;
  } catch {
    return null;
  }
}

// ─── Refresh Token (opaque) ──────────────────────────────────────────────────

export function generateRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = base64url(randomBytes(48));
  const hash = hashRefreshToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  return { raw, hash, expiresAt };
}

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

// ─── Re-exports for route handlers ──────────────────────────────────────────

export { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS };
