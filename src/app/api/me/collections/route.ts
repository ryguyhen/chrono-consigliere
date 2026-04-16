// src/app/api/me/collections/route.ts
//
// GET /api/me/collections
//
// Returns the authenticated user's collections with item counts.
// Used by the native Roll screen to populate collection filter pills.

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/get-auth-user';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const collections = await prisma.collection.findMany({
    where: { userId: user.id },
    include: { _count: { select: { items: true } } },
    orderBy: { sortOrder: 'asc' },
  });

  return NextResponse.json({
    collections: collections.map((c) => ({
      id: c.id,
      name: c.name,
      count: c._count.items,
    })),
  });
}
