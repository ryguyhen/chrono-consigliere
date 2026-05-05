// src/app/api/me/saved-searches/[id]/route.ts
//
// PATCH  /api/me/saved-searches/:id  → rename or replace filters
// DELETE /api/me/saved-searches/:id  → remove

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAuthUser } from '@/lib/auth/get-auth-user';
import { prisma } from '@/lib/db';
import {
  fromJson,
  isMeaningful,
  toBrowseUrl,
  validateName,
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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { name?: unknown; filters?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const data: Prisma.SavedSearchUpdateInput = {};

  if (body.name !== undefined) {
    try {
      data.name = validateName(body.name);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  if (body.filters !== undefined) {
    const filters = fromJson(body.filters);
    if (!isMeaningful(filters)) {
      return NextResponse.json({ error: 'Cannot save an empty search' }, { status: 400 });
    }
    data.filters = filters as Prisma.InputJsonValue;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // Scope by userId to prevent cross-user mutation; updateMany returns count.
  try {
    const result = await prisma.savedSearch.updateMany({
      where: { id: params.id, userId: user.id },
      data,
    });
    if (result.count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'A saved search with that name already exists' }, { status: 409 });
    }
    throw err;
  }

  const row = await prisma.savedSearch.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, filters: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ savedSearch: row ? shape(row) : null });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await prisma.savedSearch.deleteMany({
    where: { id: params.id, userId: user.id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
