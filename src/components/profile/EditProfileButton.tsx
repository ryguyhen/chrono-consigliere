'use client';

// src/components/profile/EditProfileButton.tsx
// Own-profile edit button + modal for display name and username.
// Client component — the profile page (server component) passes current values as props.
//
// On save:
//   username changed  → router.push('/profile/[newUsername]')
//   displayName only  → router.refresh() so the server component re-renders with new data

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  currentDisplayName: string | null;
  currentUsername: string;
}

interface FieldErrors {
  displayName?: string;
  username?: string;
  general?: string;
}

export function EditProfileButton({ currentDisplayName, currentUsername }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const usernameRef = useRef<HTMLInputElement>(null);

  // Reset form each time modal opens
  useEffect(() => {
    if (open) {
      setDisplayName(currentDisplayName ?? '');
      setUsername(currentUsername);
      setErrors({});
    }
  }, [open, currentDisplayName, currentUsername]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const isDirty =
    displayName.trim() !== (currentDisplayName ?? '') ||
    username.trim().toLowerCase() !== currentUsername;

  async function handleSave() {
    if (saving || !isDirty) return;
    setSaving(true);
    setErrors({});

    const fields: { displayName?: string; username?: string } = {};
    if (displayName.trim() !== (currentDisplayName ?? '')) fields.displayName = displayName.trim();
    const normalizedUsername = username.trim().toLowerCase();
    if (normalizedUsername !== currentUsername) fields.username = normalizedUsername;

    try {
      const res = await fetch('/api/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.fields) { setErrors(data.fields); }
        else { setErrors({ general: data.error ?? 'Something went wrong.' }); }
        return;
      }

      setOpen(false);
      if (data.username !== currentUsername) {
        router.push(`/profile/${data.username}`);
      } else {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="border border-white/15 text-white/60 text-[11px] font-medium uppercase tracking-wide px-3 py-2 sm:px-4 rounded hover:border-gold/60 hover:text-gold transition-colors whitespace-nowrap"
      >
        Edit
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-[#191919] border border-[var(--border)] rounded-lg w-full max-w-[400px] p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Edit profile</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-muted text-[13px] hover:text-ink transition-colors"
              >
                Cancel
              </button>
            </div>

            {/* General error */}
            {errors.general && (
              <p className="text-[12px] text-red-400 mb-4 text-center">{errors.general}</p>
            )}

            {/* Display name */}
            <div className="mb-4">
              <label className="block font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted mb-2">
                Display name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (errors.displayName) setErrors((er) => ({ ...er, displayName: undefined }));
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') usernameRef.current?.focus(); }}
                maxLength={50}
                placeholder="Your name"
                className={`w-full bg-[#1c1c1c] border rounded px-3 py-2.5 text-[14px] text-ink placeholder:text-muted/50 outline-none focus:border-gold/40 transition-colors
                  ${errors.displayName ? 'border-red-500/60' : 'border-[var(--border)]'}`}
              />
              {errors.displayName && (
                <p className="text-[11px] text-red-400 mt-1">{errors.displayName}</p>
              )}
            </div>

            {/* Username */}
            <div className="mb-6">
              <label className="block font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted mb-2">
                Username
              </label>
              <div className={`flex items-center bg-[#1c1c1c] border rounded px-3 transition-colors focus-within:border-gold/40
                ${errors.username ? 'border-red-500/60' : 'border-[var(--border)]'}`}>
                <span className="text-muted text-[14px] mr-0.5">@</span>
                <input
                  ref={usernameRef}
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                    if (errors.username) setErrors((er) => ({ ...er, username: undefined }));
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                  maxLength={30}
                  placeholder="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="flex-1 bg-transparent py-2.5 text-[14px] text-ink placeholder:text-muted/50 outline-none"
                />
              </div>
              {errors.username ? (
                <p className="text-[11px] text-red-400 mt-1">{errors.username}</p>
              ) : (
                <p className="text-[11px] text-muted/60 mt-1">
                  2–30 chars · lowercase letters, numbers, underscores
                </p>
              )}
            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="w-full bg-gold text-black font-mono text-[11px] font-bold uppercase tracking-[0.1em] py-3 rounded transition-opacity disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
