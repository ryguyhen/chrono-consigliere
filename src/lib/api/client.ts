// src/lib/api/client.ts
//
// Typed client for all user-action API calls.
// Centralises fetch logic so web components and any future native client
// share the same contract instead of scattering bare fetch() calls.
//
// All functions return { ok: boolean } so callers can handle failures
// without caring about status codes.

export type ApiResult = { ok: true } | { ok: false; error: string };

async function call(url: string, method: 'POST' | 'DELETE' | 'PATCH', body?: object): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { ok: false, error: text };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message ?? 'Network error' };
  }
}

// ─── Likes ────────────────────────────────────────────────────────────────────

export const likeListing   = (id: string) => call(`/api/likes/${id}`,   'POST');
export const unlikeListing = (id: string) => call(`/api/likes/${id}`,   'DELETE');

// ─── Saves / Favorites ────────────────────────────────────────────────────────

export const saveListing   = (id: string) => call(`/api/saves/${id}`,   'POST');
export const unsaveListing = (id: string) => call(`/api/saves/${id}`,   'DELETE');

// ─── Owned ────────────────────────────────────────────────────────────────────

/** Move a listing from Favorites to Owned (or directly mark as Owned). */
export const markOwned   = (id: string) => call(`/api/saves/${id}`,   'PATCH', { list: 'OWNED' });
export const unmarkOwned = (id: string) => call(`/api/saves/${id}`,   'DELETE');

// ─── Social ───────────────────────────────────────────────────────────────────

export const followUser   = (userId: string) => call(`/api/follow/${userId}`, 'POST');
export const unfollowUser = (userId: string) => call(`/api/follow/${userId}`, 'DELETE');
