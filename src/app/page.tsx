// src/app/page.tsx
//
// HARD RULE (see redesign brief): the homepage never shows rows of watch
// listing cards. Browse, WatchRoll, dealer pages and activity views are
// where inventory lives. Homepage is orientation, momentum, social framing.
//
// Logged-out → marketing landing: hero, dealer rail, how-it-works, social
//   preview. No listing grids, no carousels, no popular/new-in.
//
// Logged-in → adaptive state card + (optionally) one compact continue
//   module and one compact circle-activity preview. Neither uses WatchCard.
//   A dealer rail sits at the bottom purely as ambient freshness (dealer
//   chips, not listings).
//
// If you find yourself importing WatchCard here, stop. That belongs on
// Browse / Roll / Profile.

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
import { CircleActivityPreview } from '@/components/landing/CircleActivityPreview';

export const dynamic = 'force-dynamic';

// Bumped whenever the homepage structure changes. Surfaces as data-home-version
// on the root <div> so we can verify which build is live in production.
const HOME_VERSION = '2026-04-24-v3-no-shelves';

export default async function RootPage() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    return <AuthenticatedHome userId={session.user.id} displayName={session.user.name ?? 'Collector'} />;
  }

  return <PublicHome />;
}

async function PublicHome() {
  const [{ inStockWatchCount, curatedDealerCount }, dealers] = await Promise.all([
    getPublicLandingStats(),
    getActiveDealers(),
  ]);

  return (
    <div data-home-version={HOME_VERSION} data-home-variant="public">
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

async function AuthenticatedHome({ userId, displayName }: { userId: string; displayName: string }) {
  const [state, dealers] = await Promise.all([
    getHomeState(userId),
    getActiveDealers(),
  ]);

  // The active-circle top card already embeds recent events — don't render
  // the standalone preview beneath it or we duplicate signal.
  const showCirclePreview = state.variant !== 'active-circle' && state.variant !== 'empty-roll';

  return (
    <div data-home-version={HOME_VERSION} data-home-variant={state.variant}>
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

      <DealerSection
        dealers={dealers}
        eyebrow="Fresh from dealers"
        title="Live inventory"
        compact
      />
    </div>
  );
}
