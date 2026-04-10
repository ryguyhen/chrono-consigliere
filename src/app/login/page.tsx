// src/app/login/page.tsx
'use client';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';

// NextAuth redirects to /login?error=<code> on OAuth failures.
function oauthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case 'OAuthAccountNotLinked':
      // Account exists with credentials — direct them to use their password.
      // (Our signIn callback pre-links accounts, so this only fires if that step failed.)
      return 'This email is already registered with a password. Sign in with your password below.';
    case 'OAuthCallback':
    case 'Callback':
      return 'Google sign-in failed. Check that Google OAuth is configured and try again.';
    case 'OAuthCreateAccount':
      return 'Could not create your account via Google. Please try again.';
    case 'CredentialsSignin':
      return 'Invalid email or password.';
    case 'SessionRequired':
      return 'Please sign in to continue.';
    default:
      return 'Something went wrong during sign-in. Please try again.';
  }
}

const ACTION_CONTEXT: Record<string, string> = {
  save: 'Create an account to save watches to your Roll.',
  owned: 'Create an account to track watches you own.',
};

function LoginForm() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useSearchParams();

  const from = params.get('from') ?? '/';
  const action = params.get('action') ?? '';
  const actionContext = ACTION_CONTEXT[action] ?? null;

  // Build register link preserving return context
  const registerHref = from && from !== '/'
    ? `/register?from=${encodeURIComponent(from)}${action ? `&action=${action}` : ''}`
    : '/register';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(oauthErrorMessage(params.get('error')) ?? '');
  // Tracks whether the most recent credentials attempt failed — shows recovery hint.
  const [showRecoveryHint, setShowRecoveryHint] = useState(false);

  useEffect(() => {
    if (session) router.push(from);
  }, [session, router, from]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setShowRecoveryHint(false);

    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);

    if (res?.error) {
      setError('Invalid email or password.');
      // Only surface the set-password hint after a real credentials failure,
      // not on initial load from a URL ?error= param.
      setShowRecoveryHint(true);
    } else {
      router.push(from);
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
              See what your friends are into.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block font-mono text-[9px] uppercase tracking-[0.12em] text-muted mb-1.5">
              Email
            </label>
            <input
              id="login-email"
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
            <label htmlFor="login-password" className="block font-mono text-[9px] uppercase tracking-[0.12em] text-muted mb-1.5">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full px-3 py-2.5 border border-[var(--border)] rounded bg-parchment text-[13px] text-ink outline-none focus:border-gold transition-colors"
            />
          </div>

          {error && (
            <div className="text-[12px] text-red-400 bg-red-950/50 border border-red-900/50 rounded px-3 py-2 space-y-1">
              <div>{error}</div>
              {showRecoveryHint && (
                <div className="text-muted">
                  No password set?{' '}
                  <Link
                    href={`/set-password${email ? `?email=${encodeURIComponent(email)}` : ''}`}
                    className="text-gold hover:text-gold-dark"
                  >
                    Set one here
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
          onClick={() => signIn('google', { callbackUrl: from })}
          className="w-full py-2.5 border border-[var(--border)] rounded text-[12px] text-ink/70 hover:border-gold/50 hover:text-gold transition-colors"
        >
          Continue with Google
        </button>

        <div className="text-center mt-5 space-y-1.5">
          <div className="text-[12px] text-muted">
            New here?{' '}
            <Link href={registerHref} className="text-gold hover:text-gold-dark">
              Start your roll
            </Link>
          </div>
          <div className="text-[11px] text-muted/60">
            No password set?{' '}
            <Link href="/set-password" className="text-gold/70 hover:text-gold">
              Set one here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
