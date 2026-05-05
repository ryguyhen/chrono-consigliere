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

export async function GET(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await prisma.savedSearch.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, filters: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ savedSearches: rows.map(shape) });
}

export async function POST(req: Request) {
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const filters: SavedSearchFilters = fromJson(body.filters);
  if (!isMeaningful(filters)) {
    return NextResponse.json({ error: 'Cannot save an empty search' }, { status: 400 });
  }

  try {
    const row = await prisma.savedSearch.create({
      data: { userId: user.id, name, filters: filters as Prisma.InputJsonValue },
      select: { id: true, name: true, filters: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ savedSearch: shape(row) }, { status: 201 });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'A saved search with that name already exists' }, { status: 409 });
    }
    throw err;
  }
}
