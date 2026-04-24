// src/components/landing/HowItWorks.tsx
// Three-step explainer used on the logged-out homepage. Frames the product
// around the three verbs that define it: save, roll, follow.
import Link from 'next/link';

const STEPS = [
  {
    n: '01',
    title: 'Save what you want',
    body: 'Spot something good from any dealer we index. One tap lands it in your roll.',
  },
  {
    n: '02',
    title: 'Build your roll',
    body: 'Your WatchRoll is your taste — favorites, grails, what you own. Organised, private if you want.',
  },
  {
    n: '03',
    title: 'Follow the collectors',
    body: 'See what your circle is saving and buying. Discover watches the way you find bands: through people you trust.',
  },
] as const;

export function HowItWorks() {
  return (
    <>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
        <div className="border-t border-[var(--border)]" />
      </div>
      <section className="px-4 sm:px-8 py-12 sm:py-20 max-w-[1040px] mx-auto">
        <div className="text-center mb-10 sm:mb-14">
          <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted mb-2">
            How it works
          </div>
          <h2 className="text-[1.6rem] sm:text-[2.1rem] font-semibold tracking-[-0.03em]">
            A watch app built around taste.
          </h2>
        </div>
        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          {STEPS.map((step) => (
            <li key={step.n} className="relative pt-6 border-t border-[var(--border)]">
              <div className="font-mono text-[10px] tracking-[0.14em] text-gold mb-3">{step.n}</div>
              <div className="text-[1rem] font-semibold mb-2 tracking-[-0.01em]">{step.title}</div>
              <p className="text-[13px] text-muted leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="flex justify-center mt-10 sm:mt-14">
          <Link
            href="/register"
            className="font-mono text-[10px] tracking-[0.12em] uppercase px-6 py-3 bg-ink text-cream rounded font-bold hover:bg-gold hover:text-black transition-colors"
          >
            Start your roll →
          </Link>
        </div>
      </section>
    </>
  );
}
