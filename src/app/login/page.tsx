// src/app/login/page.tsx
'use client';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session) router.push('/');
  }, [session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) setError('Invalid credentials. Try ryan@example.com in demo mode.');
    else router.push('/');
  }

  return (
    <div className="min-h-[calc(100dvh-52px)] flex items-center justify-center bg-cream px-4 py-8">
      <div className="bg-surface border border-[var(--border)] rounded-xl p-6 sm:p-10 w-full max-w-[380px]">
        <div className="text-center mb-7">
          <div className="text-[18px] font-semibold tracking-[-0.01em] mb-1">
            Chrono <span className="text-gold">Consigliere</span>
          </div>
          <p className="font-mono text-[9px] tracking-[0.18em] text-muted uppercase">
            See what your friends are into.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-muted mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-3 py-2.5 border border-[var(--border)] rounded bg-parchment text-[13px] text-ink outline-none focus:border-gold transition-colors placeholder:text-muted/50"
            />
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-muted mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3 py-2.5 border border-[var(--border)] rounded bg-parchment text-[13px] text-ink outline-none focus:border-gold transition-colors"
            />
          </div>

          {error && (
            <div className="text-[12px] text-red-400 bg-red-950/50 border border-red-900/50 rounded px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold text-black text-[11px] font-bold tracking-[0.1em] uppercase py-3 rounded hover:bg-gold-dark transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border)]" />
          </div>
          <div className="relative flex justify-center font-mono text-[10px] text-muted bg-surface px-2">or</div>
        </div>

        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="w-full py-2.5 border border-[var(--border)] rounded text-[12px] text-ink/70 hover:border-gold/50 hover:text-gold transition-colors"
        >
          Continue with Google
        </button>

        <div className="mt-5 p-3 bg-parchment rounded text-[11px] text-muted space-y-0.5 border border-[var(--border)]">
          <div className="font-medium text-ink/60">Demo credentials</div>
          <div>Email: <code className="font-mono text-gold">ryan@example.com</code></div>
          <div>Password: <code className="font-mono text-gold">password123</code></div>
        </div>

        <div className="text-center mt-5 text-[12px] text-muted">
          New here?{' '}
          <Link href="/register" className="text-gold hover:text-gold-dark">
            Start your roll
          </Link>
        </div>
      </div>
    </div>
  );
}
