// src/app/api/admin/sources/route.ts
// Create and edit DealerSource records from the admin UI.
// GET  — returns list of registered adapter names (for the dropdown)
// POST — create a new source
// PATCH — update an existing source by id
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { prisma } from '@/lib/db';
import { isAdmin } from '@/lib/auth/is-admin';
import { ADAPTER_REGISTRY } from '@/lib/scraper/adapter-registry';

async function requireAdmin(req: Request): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return isAdmin(session?.user?.email);
}

/** Registered adapter names — used to populate the dropdown and validate input. */
const REGISTERED = new Set(Object.keys(ADAPTER_REGISTRY));

function validateFields(body: Record<string, unknown>, requireAll: boolean) {
  const { name, slug, adapterName, baseUrl } = body;

  if (requireAll && (!name || !slug || !adapterName || !baseUrl))
    return 'name, slug, adapterName, and baseUrl are all required';

  if (adapterName && !REGISTERED.has(String(adapterName)))
    return `Unknown adapter "${adapterName}". Registered: ${[...REGISTERED].join(', ')}`;

  if (baseUrl && !/^https?:\/\/.+/.test(String(baseUrl)))
    return 'baseUrl must start with https://';

  if (slug && !/^[a-z0-9-]+$/.test(String(slug)))
    return 'slug must be lowercase letters, numbers, and hyphens only';

  return null;
}

export async function GET(req: Request) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json({ registeredAdapters: [...REGISTERED].sort() });
}

export async function POST(req: Request) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const err = validateFields(body, true);
  if (err) return NextResponse.json({ error: err }, { status: 422 });

  const { name, slug, adapterName, baseUrl, isActive = true } = body;

  try {
    const source = await prisma.dealerSource.create({
      data: { name, slug, adapterName, baseUrl, isActive, scrapeConfig: {} },
    });
    return NextResponse.json(source, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2002')
      return NextResponse.json({ error: `Slug "${slug}" is already taken` }, { status: 409 });
    throw e;
  }
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const err = validateFields(rest, false);
  if (err) return NextResponse.json({ error: err }, { status: 422 });

  const data: Record<string, unknown> = {};
  for (const key of ['name', 'slug', 'adapterName', 'baseUrl', 'isActive'] as const) {
    if (rest[key] !== undefined) data[key] = rest[key];
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  try {
    const source = await prisma.dealerSource.update({ where: { id }, data });
    return NextResponse.json(source);
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    if (e.code === 'P2002') return NextResponse.json({ error: `Slug "${rest.slug}" is already taken` }, { status: 409 });
    throw e;
  }
}
