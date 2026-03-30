// src/components/layout/Nav.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { Session } from 'next-auth';

interface NavProps {
  session: Session | null;
}

const NAV_LINKS = [
  { href: '/', label: 'Discover' },
  { href: '/browse', label: 'Browse' },
  { href: '/feed', label: 'Friends' },
  { href: '/people', label: 'People' },
  { href: '/wishlist', label: 'Roll' },
];

export function Nav({ session }: NavProps) {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 h-[52px] bg-ink border-b border-white/[0.06] flex items-center px-6 gap-10">
      {/* Logo */}
      <Link href="/" className="font-serif text-[1.15rem] font-light text-cream/90 tracking-wide whitespace-nowrap flex-shrink-0">
        Chrono <em className="italic text-gold" style={{ fontStyle: 'italic' }}>Consigliere</em>
      </Link>

      {/* Links */}
      <div className="flex gap-7 flex-1">
        {NAV_LINKS.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`text-[11px] tracking-[0.1em] uppercase transition-colors
              ${pathname === link.href
                ? 'text-cream'
                : 'text-cream/40 hover:text-cream/75'
              }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4 ml-auto">
        {session?.user ? (
          <>
            <Link
              href="/profile"
              className="w-[28px] h-[28px] rounded-full bg-gold/90 flex items-center justify-center text-[10px] font-medium text-ink cursor-pointer"
            >
              {(session.user.name ?? session.user.email ?? 'U')[0].toUpperCase()}
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-[11px] text-cream/30 hover:text-cream/60 transition-colors tracking-wide"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="text-[11px] tracking-[0.08em] uppercase px-3 py-1.5 border border-white/15 rounded text-cream/50 hover:border-gold/50 hover:text-gold/80 transition-colors"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
