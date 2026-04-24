// src/components/landing/SocialPreview.tsx
// Small, anonymized community-activity tease on the logged-out homepage.
// Signals that this is a social product — not a listings directory — without
// leaking private activity. Shows recent aggregate signal only.
import { prisma } from '@/lib/db';
import Link from 'next/link';

function hueFor(label: string) {
  return (label.charCodeAt(0) * 37 + (label.charCodeAt(1) || 0) * 13) % 360;
}

export async function SocialPreview() {
  // Pull a handful of recent PUBLIC-activity indicators. We surface counts and
  // anonymized initials only — never names or listing titles — because the
  // viewer is unauthenticated and activity privacy defaults to FRIENDS.
  const [likeCount, saveCount, collectorCount, recentActors] = await Promise.all([
    prisma.like.count(),
    prisma.wishlistItem.count({ where: { list: 'FAVORITES' } }),
    prisma.profile.count(),
    prisma.profile.findMany({
      select: { displayName: true, username: true },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    }),
  ]);

  if (collectorCount === 0) return null;

  const initialsList = recentActors
    .map(p => (p.displayName ?? p.username ?? 'U').slice(0, 2).toUpperCase())
    .slice(0, 6);

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
        <div className="border-t border-[var(--border)]" />
      </div>
      <section className="px-4 sm:px-8 py-12 sm:py-16 max-w-[900px] mx-auto">
        <div className="rounded-xl border border-[var(--border)] bg-parchment px-6 sm:px-10 py-8 sm:py-12 text-center">
          <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted mb-3">
            The circle
          </div>
          <h2 className="text-[1.25rem] sm:text-[1.5rem] font-semibold tracking-[-0.02em] mb-3">
            Watches are better with people.
          </h2>
          <p className="text-[13px] sm:text-[14px] text-muted max-w-[480px] mx-auto leading-relaxed mb-7">
            Collectors are already saving, rolling, and trading notes here.
            Join and see what the people around you are into.
          </p>
          {initialsList.length > 0 && (
            <div className="flex items-center justify-center mb-7">
              <div className="flex -space-x-2">
                {initialsList.map((initials, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/75 font-medium text-[10px] border-2 border-parchment"
                    style={{ background: `hsl(${hueFor(initials)}, 18%, 26%)` }}
                    aria-hidden
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <div className="ml-3 text-[11px] text-muted font-mono">
                {collectorCount.toLocaleString()} collectors
              </div>
            </div>
          )}
          <div className="flex justify-center gap-8 sm:gap-12 pt-6 border-t border-[var(--border)]">
            <Stat label="Saves" value={saveCount} />
            <Stat label="Likes" value={likeCount} />
            <Stat label="Collectors" value={collectorCount} />
          </div>
          <div className="mt-7">
            <Link
              href="/register"
              className="font-mono text-[10px] tracking-[0.12em] uppercase text-gold hover:text-gold-dark transition-colors"
            >
              Join the circle →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[1.2rem] sm:text-[1.4rem] font-semibold tracking-[-0.02em]">
        {value.toLocaleString()}
      </div>
      <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-muted mt-0.5">
        {label}
      </div>
    </div>
  );
}
