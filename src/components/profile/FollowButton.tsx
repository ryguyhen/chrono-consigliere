'use client';
import { useState } from 'react';
import { followUser, unfollowUser } from '@/lib/api/client';

export function FollowButton({ userId, initialIsFollowing }: { userId: string; initialIsFollowing: boolean }) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const result = await (isFollowing ? unfollowUser(userId) : followUser(userId));
    if (result.ok) setIsFollowing(!isFollowing);
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-[11px] uppercase tracking-wide px-5 py-2 rounded border transition-colors disabled:opacity-60
        ${isFollowing
          ? 'bg-gold border-gold text-black font-bold hover:bg-transparent hover:text-gold'
          : 'border-white/20 text-white/60 hover:border-gold/60 hover:text-gold'
        }`}
    >
      {loading ? '…' : isFollowing ? 'Following' : 'Follow'}
    </button>
  );
}
