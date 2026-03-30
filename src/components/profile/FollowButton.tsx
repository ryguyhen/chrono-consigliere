'use client';
import { useState } from 'react';

export function FollowButton({ userId, initialIsFollowing }: { userId: string; initialIsFollowing: boolean }) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const method = isFollowing ? 'DELETE' : 'POST';
    const res = await fetch(`/api/follow/${userId}`, { method });
    if (res.ok) setIsFollowing(!isFollowing);
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-[11px] uppercase tracking-wide px-5 py-2 rounded border transition-colors disabled:opacity-60
        ${isFollowing
          ? 'bg-gold border-gold text-ink hover:bg-transparent hover:text-gold'
          : 'border-white/20 text-cream hover:border-gold hover:text-gold'
        }`}
    >
      {loading ? '…' : isFollowing ? 'Following' : 'Follow'}
    </button>
  );
}
