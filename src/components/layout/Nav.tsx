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
  { href: '/roll', label: 'Roll' },
  { href: '/people', label: 'People' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  if (href === '/roll') return pathname.startsWith('/roll');
  return pathname === href || pathname.startsWith(href + '/');
}

// Minimal inline SVG icons for bottom nav
function IconDiscover({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V21a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

function IconBrowse({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconRoll({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21L12 16l-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
    </svg>
  );
}

function IconPeople({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

const BOTTOM_NAV = [
  { href: '/', label: 'Discover', Icon: IconDiscover },
  { href: '/browse', label: 'Browse', Icon: IconBrowse },
  { href: '/roll', label: 'Roll', Icon: IconRoll },
  { href: '/people', label: 'People', Icon: IconPeople },
];

export function Nav({ session }: NavProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Top nav */}
      <nav className="sticky top-0 z-50 h-[52px] bg-black border-b border-white/[0.07] flex items-center px-4 sm:px-6 gap-6 sm:gap-10">
        {/* Logo */}
        <Link href="/" className="text-[14px] font-medium text-white whitespace-nowrap flex-shrink-0 tracking-[0.01em]">
          Chrono <span className="text-gold">Consigliere</span>
        </Link>

        {/* Desktop nav links — hidden on mobile */}
        <div className="hidden md:flex gap-7 flex-1">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-[11px] font-medium tracking-[0.1em] uppercase transition-colors
                ${isActive(pathname, link.href)
                  ? 'text-white'
                  : 'text-white/35 hover:text-white/70'
                }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Spacer on mobile */}
        <div className="flex-1 md:hidden" />

        {/* Right */}
        <div className="flex items-center gap-3 sm:gap-4 ml-auto md:ml-0">
          {session?.user ? (
            <>
              <Link
                href="/profile"
                className="w-[28px] h-[28px] rounded-full bg-gold flex items-center justify-center text-[10px] font-bold text-black cursor-pointer flex-shrink-0"
              >
                {(session.user.name ?? session.user.email ?? 'U')[0].toUpperCase()}
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="hidden sm:block text-[11px] text-white/25 hover:text-white/55 transition-colors tracking-wide"
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

      {/* Mobile bottom nav — hidden on md+ */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-black border-t border-white/[0.07]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex h-14">
          {BOTTOM_NAV.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors
                  ${active ? 'text-white' : 'text-white/30 hover:text-white/60'}`}
              >
                <Icon active={active} />
                <span className={`font-mono text-[8px] tracking-[0.08em] uppercase ${active ? 'text-gold' : ''}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
