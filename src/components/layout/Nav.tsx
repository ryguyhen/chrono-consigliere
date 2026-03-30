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
    <nav className="sticky top-0 z-50 h-[52px] bg-black border-b border-white/[0.07] flex items-center px-6 gap-10">
      {/* Logo */}
      <Link href="/" className="text-[14px] font-medium text-white whitespace-nowrap flex-shrink-0 tracking-[0.01em]">
        Chrono <span className="text-gold">Consigliere</span>
      </Link>

      {/* Links */}
      <div className="flex gap-7 flex-1">
        {NAV_LINKS.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`text-[11px] font-medium tracking-[0.1em] uppercase transition-colors
              ${pathname === link.href
                ? 'text-white'
                : 'text-white/35 hover:text-white/70'
              }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Right */}
      <div className="flex items-center gap-4 ml-auto">
        {session?.user ? (
          <>
            <Link
              href="/profile"
              className="w-[28px] h-[28px] rounded-full bg-gold flex items-center justify-center text-[10px] font-bold text-black cursor-pointer"
            >
              {(session.user.name ?? session.user.email ?? 'U')[0].toUpperCase()}
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-[11px] text-white/25 hover:text-white/55 transition-colors tracking-wide"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="text-[11px] font-medium tracking-[0.08em] uppercase px-3 py-1.5 border border-white/15 rounded text-white/50 hover:border-gold/60 hover:text-gold transition-colors"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
