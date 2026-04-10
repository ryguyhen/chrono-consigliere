// src/app/register/page.tsx
'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const ACTION_CONTEXT: Record<string, string> = {
  save: 'Create an account to save watches to your Roll.',
  owned: 'Create an account to track watches you own.',
};

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();

  const from = params.get('from') ?? '/';
  const action = params.get('action') ?? '';
  const actionContext = ACTION_CONTEXT[action] ?? null;

  // After registration, sign-in link preserves return context
  const loginHref = from && from !== '/'
    ? `/login?from=${encodeURIComponent(from)}${action ? `&action=${action}` : ''}`
    : '/login';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
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

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
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
          {actionContext ? (
            <p className="text-[12px] text-ink/70 leading-snug mt-2">{actionContext}</p>
          ) : (
            <p className="font-mono text-[9px] tracking-[0.18em] text-muted uppercase">
              Start your roll
            </p>
          )}
        </div>

        {done ? (
          <div className="text-center">
            <div className="text-[1.5rem] mb-3 text-gold">◈</div>
            <div className="text-[1.1rem] font-semibold mb-2">You&apos;re in.</div>
            <p className="text-[13px] text-muted mb-6 leading-relaxed">
              Account created. Sign in to continue.
            </p>
            <button
              onClick={() => router.push(loginHref)}
              className="w-full bg-gold text-black text-[11px] font-bold tracking-[0.1em] uppercase py-3 rounded hover:bg-gold-dark transition-colors"
            >
              Sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reg-name" className="block font-mono text-[9px] uppercase tracking-[0.12em] text-muted mb-1.5">
                Name
              </label>
              <input
                id="reg-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="James"
                required
                className="w-full px-3 py-2.5 border border-[var(--border)] rounded bg-parchment text-[13px] text-ink outline-none focus:border-gold transition-colors placeholder:text-muted/50"
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="block font-mono text-[9px] uppercase tracking-[0.12em] text-muted mb-1.5">
                Email
              </label>
              <input
                id="reg-email"
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
              <label htmlFor="reg-password" className="block font-mono text-[9px] uppercase tracking-[0.12em] text-muted mb-1.5">
                Password
              </label>
              <input
                id="reg-password"
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
              <div className="text-[12px] text-red-400 bg-red-950/50 border border-red-900/50 rounded px-3 py-2 space-y-1.5">
                <div>{error}</div>
                {errorCode === 'EMAIL_TAKEN' && (
                  <div className="text-muted">
                    <Link href={loginHref} className="text-gold hover:text-gold-dark">Sign in instead →</Link>
                  </div>
                )}
                {errorCode === 'LEGACY_ACCOUNT' && (
                  <div className="text-muted">
                    <Link
                      href={`/set-password?email=${encodeURIComponent(email)}`}
                      className="text-gold hover:text-gold-dark"
                    >
                      Set your password →
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
              {loading ? 'Creating account…' : 'Start your roll'}
            </button>

            <p className="text-center text-[12px] text-muted pt-1">
              Already have an account?{' '}
              <Link href={loginHref} className="text-gold hover:text-gold-dark">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
