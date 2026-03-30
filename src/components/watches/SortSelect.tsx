'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SortSelectInner({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(params.toString());
    next.set('sort', e.target.value);
    next.delete('page');
    router.push(`/browse?${next.toString()}`);
  }

  return (
    <select
      defaultValue={defaultValue}
      onChange={onChange}
      className="px-3 py-2 text-[12px] border border-[var(--border)] rounded bg-parchment text-ink outline-none cursor-pointer focus:border-gold"
    >
      <option value="newest">Newest listed</option>
      <option value="price-asc">Price: low to high</option>
      <option value="price-desc">Price: high to low</option>
      <option value="most-liked">Most liked</option>
    </select>
  );
}

export function SortSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <Suspense fallback={null}>
      <SortSelectInner defaultValue={defaultValue} />
    </Suspense>
  );
}
