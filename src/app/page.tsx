// src/app/page.tsx
//
// The root route serves two distinct surfaces that share zero data:
//
//   Logged-out → marketing landing. Explain the product (social watch
//     discovery), drive to one next action (start your roll). No inventory
//     shelves — those duplicate /browse.
//
//   Logged-in → a state-based dashboard. The top StateCard adapts to
//     whether the user has saves, a circle, and recent circle activity.
//     The sections beneath are all gated on their own data — every module
//     can render or not independently, so the page never feels padded.
//
// Variant selection and state fetching live in lib/landing/home-state.ts.
// Inventory-specific queries live in lib/watches/queries.ts. This file is
// just the orchestrator.

import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth.config';
import { getActiveDealers, getPublicLandingStats } from '@/lib/landing/public-stats';
import { getHomeState } from '@/lib/landing/home-state';
import { MarketingHero } from '@/components/landing/MarketingHero';
import { DealerSection } from '@/components/landing/DealerSection';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { SocialPreview } from '@/components/landing/SocialPreview';
import { StateCard } from '@/components/landing/StateCard';
import { ContinueStrip } from '@/components/landing/ContinueStrip';
import { PersonalizedSuggestions } from '@/components/landing/PersonalizedSuggestions';
import { CircleActivityPreview } from '@/components/landing/CircleActivityPreview';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    return <AuthenticatedHome userId={session.user.id} displayName={session.user.name ?? 'Collector'} />;
  }

  return <PublicHome />;
}

// ─── Logged-out home ─────────────────────────────────────────────────────────
// Hero → dealer rail → how it works → social preview. No inventory grids —
// browsing lives at /browse and that's where inventory-style exploration belongs.

async function PublicHome() {
  const [{ inStockWatchCount, curatedDealerCount }, dealers] = await Promise.all([
    getPublicLandingStats(),
    getActiveDealers(),
  ]);

  return (
    <div>
      <MarketingHero
        inStockWatchCount={inStockWatchCount}
        curatedDealerCount={curatedDealerCount}
      />
      <DealerSection dealers={dealers} />
      <HowItWorks />
      <Suspense fallback={null}>
        <SocialPreview />
      </Suspense>
    </div>
  );
}

// ─── Logged-in home ──────────────────────────────────────────────────────────
// Order of sections is intentional:
//   1. StateCard        — orientation + next action (adaptive)
//   2. ContinueStrip    — pick up recent saves (hidden when empty)
//   3. CirclePreview    — social tease (hidden for empty-roll & active-circle)
//   4. Suggestions      — personalized by saved brands (hidden when no saves)
//   5. DealerSection    — ambient freshness, same rail as the public page
//
// Every module silently disappears when it has nothing useful to say — so a
// brand-new user sees a clean top card + starter chips + dealer rail, while
// an active collector sees a dense personalized surface.

async function AuthenticatedHome({ userId, displayName }: { userId: string; displayName: string }) {
  const [state, dealers] = await Promise.all([
    getHomeState(userId),
    getActiveDealers(),
  ]);

  // Don't duplicate the circle preview: the active-circle top card already
  // embeds recent events, so the standalone preview below it is skipped.
  const showCirclePreview = state.variant !== 'active-circle' && state.variant !== 'empty-roll';

  return (
    <div>
      <StateCard
        variant={state.variant}
        displayName={displayName}
        savedCount={state.savedCount}
        followingCount={state.followingCount}
        recentCircleEvents={state.recentCircleEvents}
      />

      {state.savedCount > 0 && (
        <Suspense fallback={null}>
          <ContinueStrip userId={userId} />
        </Suspense>
      )}

      {showCirclePreview && (
        <CircleActivityPreview
          events={state.recentCircleEvents}
          followingCount={state.followingCount}
        />
      )}

      {state.savedCount > 0 && (
        <Suspense fallback={null}>
          <PersonalizedSuggestions userId={userId} />
        </Suspense>
      )}

      <DealerSection
        dealers={dealers}
        eyebrow="Fresh from dealers"
        title="Live inventory"
        compact
      />
    </div>
  );
}
