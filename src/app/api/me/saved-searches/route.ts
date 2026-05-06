// src/app/api/me/saved-searches/route.ts
//
// GET    /api/me/saved-searches  → list the authenticated user's saved searches
// POST   /api/me/saved-searches  → create  { name, filters }

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAuthUser } from '@/lib/auth/get-auth-user';
import { prisma } from '@/lib/db';
import {
  fromJson,
  isMeaningful,
  toBrowseUrl,
  validateName,
  type SavedSearchFilters,
} from '@/lib/watches/saved-search';

function shape(row: { id: string; name: string; filters: unknown; createdAt: Date; updatedAt: Date }) {
  const filters = fromJson(row.filters);
  return {
    id: row.id,
    name: row.name,
    filters,
    url: toBrowseUrl(filters),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Translate a thrown error into a JSON response. Keeps the underlying error
 * in server logs (with route + Prisma code) and prevents Next.js from
 * rendering its default HTML 500 page — which the client parses as JSON and
 * can't surface a useful message from.
 */
function errorResponse(route: string, err: unknown): NextResponse {
  const code = (err as any)?.code;
  console.error(`[${route}] error code=${code ?? 'n/a'}:`, err);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (code === 'P2002') {
      return NextResponse.json({ error: 'A saved search with that name already exists', code }, { status: 409 });
    }
    if (code === 'P2025') {
      return NextResponse.json({ error: 'Not found', code }, { status: 404 });
    }
    if (code === 'P2003') {
      return NextResponse.json({ error: 'Invalid user reference', code }, { status: 400 });
    }
    if (code === 'P2021' || code === 'P2022') {
      // Schema not in sync: missing table (P2021) or column (P2022).
      // Indicates `prisma db push` hasn't run against this database.
      return NextResponse.json(
        { error: 'Saved searches storage is not provisioned. Run prisma db push.', code },
        { status: 503 },
      );
    }
  }

  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await prisma.savedSearch.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, filters: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({ savedSearches: rows.map(shape) });
  } catch (err) {
    return errorResponse('GET /api/me/saved-searches', err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: { name?: unknown; filters?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let name: string;
    try {
      name = validateName(body.name);
    } catch (validationErr: any) {
      return NextResponse.json({ error: validationErr.message }, { status: 400 });
    }

    const filters: SavedSearchFilters = fromJson(body.filters);
    if (!isMeaningful(filters)) {
      return NextResponse.json({ error: 'Cannot save an empty search' }, { status: 400 });
    }

    const row = await prisma.savedSearch.create({
      data: { userId: user.id, name, filters: filters as Prisma.InputJsonValue },
      select: { id: true, name: true, filters: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ savedSearch: shape(row) }, { status: 201 });
  } catch (err) {
    return errorResponse('POST /api/me/saved-searches', err);
  }
}
