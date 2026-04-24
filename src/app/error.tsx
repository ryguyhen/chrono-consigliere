// src/app/error.tsx
// Root error boundary. Runs on the client and only catches errors from the
// route tree beneath it, so layout + nav remain available when a page throws.
// We log the error so Railway picks it up, and give the user a single action
// (reset) that re-attempts the render.
'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error] unhandled', { digest: error.digest, message: error.message, stack: error.stack });
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="text-3xl mb-5 opacity-15">◈</div>
      <h1 className="text-[1.3rem] font-semibold tracking-[-0.02em] mb-2">
        Something broke here.
      </h1>
      <p className="text-[13px] text-muted max-w-[360px] leading-relaxed mb-6">
        We&apos;ve logged the error. Try again, or head back to the homepage.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="font-mono text-[10px] tracking-[0.12em] uppercase px-5 py-2.5 bg-gold text-black rounded font-bold hover:bg-gold-dark transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="font-mono text-[10px] tracking-[0.12em] uppercase px-5 py-2.5 border border-[var(--border)] text-muted rounded hover:border-gold/50 hover:text-gold transition-colors"
        >
          Home
        </Link>
      </div>
      {error.digest && (
        <div className="font-mono text-[9px] tracking-[0.1em] text-muted/60 mt-8">
          digest {error.digest}
        </div>
      )}
    </div>
  );
}
