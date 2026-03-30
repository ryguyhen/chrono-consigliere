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
  { href: '/wishlist', label: 'Wishlist' },
];

export function Nav({ session }: NavProps) {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 h-[52px] bg-ink border-b border-white/5 flex items-center gap-8 px-6">
      {/* Logo */}
      <Link href="/" className="font-serif text-[20px] font-light text-cream tracking-wide whitespace-nowrap">
        Chrono <span className="italic text-gold">Consigliere</span>
      </Link>

      {/* Links */}
      <div className="flex gap-6 flex-1">
        {NAV_LINKS.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`text-[11px] font-medium tracking-[0.08em] uppercase transition-colors pb-0.5 border-b
              ${pathname === link.href
                ? 'text-cream border-gold'
                : 'text-cream/50 border-transparent hover:text-cream hover:border-gold/50'
              }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 ml-auto">
        {session?.user ? (
          <>
            <Link
              href="/profile"
              className="w-[30px] h-[30px] rounded-full bg-gold flex items-center justify-center text-[11px] font-medium text-ink cursor-pointer"
            >
              {(session.user.name ?? session.user.email ?? 'U')[0].toUpperCase()}
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-[11px] text-cream/40 hover:text-cream/70 transition-colors"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="text-[11px] font-medium tracking-[0.06em] uppercase px-3 py-1.5 border border-white/20 rounded text-cream/70 hover:border-gold hover:text-gold transition-colors"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
