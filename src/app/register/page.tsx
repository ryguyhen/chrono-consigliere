// src/app/register/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.');
    } else {
      setDone(true);
    }
  }

  return (
    <div className="min-h-[calc(100vh-52px)] flex items-center justify-center bg-cream p-6">
      <div className="bg-surface border border-[var(--border)] rounded-xl p-10 w-full max-w-[380px]">
        <div className="text-center mb-7">
          <div className="text-[18px] font-semibold tracking-[-0.01em] mb-1">
            Chrono <span className="text-gold">Consigliere</span>
          </div>
          <p className="font-mono text-[9px] tracking-[0.18em] text-muted uppercase">
            Start your roll
          </p>
        </div>

        {done ? (
          <div className="text-center">
            <div className="text-[1.5rem] mb-3 text-gold">◈</div>
            <div className="text-[1.1rem] font-semibold mb-2">You're in.</div>
            <p className="text-[13px] text-muted mb-6 leading-relaxed">
              Account created. Sign in with your email — no password needed yet.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-gold text-black text-[11px] font-bold tracking-[0.1em] uppercase py-3 rounded hover:bg-gold-dark transition-colors"
            >
              Sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-muted mb-1.5">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="James"
                required
                className="w-full px-3 py-2.5 border border-[var(--border)] rounded bg-parchment text-[13px] text-ink outline-none focus:border-gold transition-colors placeholder:text-muted/50"
              />
            </div>
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
              {loading ? 'Creating account…' : 'Start your roll'}
            </button>

            <p className="text-center text-[12px] text-muted pt-1">
              Already have an account?{' '}
              <Link href="/login" className="text-gold hover:text-gold-dark">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
