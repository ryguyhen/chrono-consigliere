// src/app/people/page.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface UserResult {
  id: string;
  username: string;
  displayName: string | null;
  tasteTags: string[];
  isFollowing: boolean;
  followerCount: number;
  likeCount: number;
}

function Avatar({ name, size = 36 }: { name: string | null; size?: number }) {
  const initials = (name ?? 'U').slice(0, 2).toUpperCase();
  const hue = (initials.charCodeAt(0) * 37 + (initials.charCodeAt(1) || 0) * 13) % 360;
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 text-white/70 font-medium"
      style={{ width: size, height: size, fontSize: size * 0.32, background: `hsl(${hue}, 15%, 22%)` }}
    >
      {initials}
    </div>
  );
}

export default function PeoplePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [suggested, setSuggested] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!session) router.push('/login');
  }, [session, router]);

  // Load suggested users on mount
  useEffect(() => {
    fetch('/api/search/users?q=a')
      .then(r => r.json())
      .then(d => setSuggested(d.users ?? []));
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const res = await fetch(`/api/search/users?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setResults(data.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  async function toggleFollow(userId: string, currently: boolean) {
    const optimistic = !currently;
    setFollowing(prev => ({ ...prev, [userId]: optimistic }));
    setResults(prev => prev.map(u => u.id === userId ? { ...u, isFollowing: optimistic } : u));
    setSuggested(prev => prev.map(u => u.id === userId ? { ...u, isFollowing: optimistic } : u));

    const method = currently ? 'DELETE' : 'POST';
    const res = await fetch(`/api/follow/${userId}`, { method });
    if (!res.ok) {
      // Revert on failure
      setFollowing(prev => ({ ...prev, [userId]: currently }));
      setResults(prev => prev.map(u => u.id === userId ? { ...u, isFollowing: currently } : u));
      setSuggested(prev => prev.map(u => u.id === userId ? { ...u, isFollowing: currently } : u));
    }
  }

  const displayList = query.length >= 2 ? results : suggested;

  return (
    <div className="max-w-[640px] mx-auto px-6 py-8">
      <h1 className="text-[1.5rem] font-normal tracking-[-0.02em] mb-1">People</h1>
      <p className="text-[13px] text-muted mb-6">Find people to follow. See what they're saving.</p>

      {/* Search */}
      <div className="relative mb-8">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or username…"
          className="w-full px-4 py-3 border border-[var(--border)] rounded-lg bg-parchment text-[13px] text-ink outline-none focus:border-gold transition-colors pr-10 placeholder:text-muted/50"
          autoFocus
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        )}
      </div>

      {/* Results */}
      {query.length >= 2 && results.length === 0 && !loading && (
        <div className="text-center py-12 text-muted text-[13px]">
          Nobody found for "{query}"
        </div>
      )}

      {query.length < 2 && suggested.length > 0 && (
        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted mb-3">
          Worth following
        </div>
      )}

      <div className="space-y-2">
        {displayList.map(user => {
          const isFollowing = following[user.id] ?? user.isFollowing;
          return (
            <div key={user.id} className="bg-surface border border-[var(--border)] rounded-lg p-4 flex items-center gap-3">
              <Link href={`/profile/${user.username}`}>
                <Avatar name={user.displayName ?? user.username} size={40} />
              </Link>

              <div className="flex-1 min-w-0">
                <Link href={`/profile/${user.username}`} className="hover:text-gold transition-colors">
                  <div className="text-[14px] font-medium text-ink truncate">
                    {user.displayName ?? user.username}
                  </div>
                  <div className="text-[11px] text-muted">@{user.username}</div>
                </Link>
                {user.tasteTags.length > 0 && (
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {user.tasteTags.slice(0, 3).map(tag => (
                      <span key={tag} className="font-mono text-[8px] uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border border-gold/25 text-gold/60">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleFollow(user.id, isFollowing)}
                  className={`font-mono text-[9px] tracking-[0.08em] uppercase px-3 py-1.5 rounded border transition-colors
                    ${isFollowing
                      ? 'bg-gold border-gold text-black font-bold'
                      : 'border-[var(--border)] text-muted hover:border-gold/60 hover:text-gold'
                    }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                <div className="text-[10px] text-muted">{user.followerCount} followers</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
