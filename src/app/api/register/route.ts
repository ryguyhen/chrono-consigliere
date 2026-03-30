// src/app/api/register/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  const { name, email } = await req.json().catch(() => ({}));

  if (!email || !name) {
    return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
  }

  const username = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase();
  const uniqueUsername = `${username}${Math.floor(Math.random() * 9999)}`;

  await prisma.user.create({
    data: {
      email,
      name,
      profile: {
        create: {
          username: uniqueUsername,
          displayName: name,
        },
      },
    },
  });

  return NextResponse.json({ success: true });
}
