// src/app/set-password/page.tsx
// Recovery path for legacy accounts that were created before passwords were required.
'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function SetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setErrorCode('');

    const res = await fetch('/api/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.');
      setErrorCode(data.code ?? '');
    } else {
      setDone(true);
    }
  }

  return (
    <div className="min-h-[calc(100dvh-52px)] flex items-center justify-center bg-cream px-4 py-8">
      <div className="bg-surface border border-[var(--border)] rounded-xl p-6 sm:p-10 w-full max-w-[380px]">
        <div className="text-center mb-7">
          <div className="text-[18px] font-semibold tracking-[-0.01em] mb-1">
            Chrono <span className="text-gold">Consigliere</span>
          </div>
          <p className="font-mono text-[9px] tracking-[0.18em] text-muted uppercase">
            Set your password
          </p>
        </div>

        {done ? (
          <div className="text-center">
            <div className="text-[1.5rem] mb-3 text-gold">◈</div>
            <div className="text-[1.1rem] font-semibold mb-2">Password set.</div>
            <p className="text-[13px] text-muted mb-6 leading-relaxed">
              You can now sign in with your email and new password.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-gold text-black text-[11px] font-bold tracking-[0.1em] uppercase py-3 rounded hover:bg-gold-dark transition-colors"
            >
              Sign in
            </button>
          </div>
        ) : (
          <>
            <p className="text-[12px] text-muted mb-5 leading-relaxed text-center">
              If you signed up with Google or before passwords were added, enter your email and choose a password to enable email sign-in.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="sp-email" className="block font-mono text-[9px] uppercase tracking-[0.12em] text-muted mb-1.5">
                  Email
                </label>
                <input
                  id="sp-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="w-full px-3 py-2.5 border border-[var(--border)] rounded bg-parchment text-[13px] text-ink outline-none focus:border-gold transition-colors placeholder:text-muted/50"
                />
              </div>
              <div>
                <label htmlFor="sp-password" className="block font-mono text-[9px] uppercase tracking-[0.12em] text-muted mb-1.5">
                  New Password
                </label>
                <input
                  id="sp-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 border border-[var(--border)] rounded bg-parchment text-[13px] text-ink outline-none focus:border-gold transition-colors"
                />
              </div>

              {error && (
                <div className="text-[12px] text-red-400 bg-red-950/50 border border-red-900/50 rounded px-3 py-2 space-y-1">
                  <div>{error}</div>
                  {errorCode === 'HAS_PASSWORD' && (
                    <div>
                      <Link href="/login" className="text-gold hover:text-gold-dark">
                        Go to sign in →
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gold text-black text-[11px] font-bold tracking-[0.1em] uppercase py-3 rounded hover:bg-gold-dark transition-colors disabled:opacity-50"
              >
                {loading ? 'Setting password…' : 'Set password'}
              </button>
            </form>

            <div className="text-center mt-5 text-[12px] text-muted">
              <Link href="/login" className="text-gold hover:text-gold-dark">
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  );
}
