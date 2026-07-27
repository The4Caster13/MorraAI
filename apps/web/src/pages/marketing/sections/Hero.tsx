import { gsap } from 'gsap';
import { ChevronRight, Play, UserPlus } from 'lucide-react';
import { useEntranceAnimation, useTypewriter } from '../../../hooks/useAnimations';
import { LinkButton } from '../../../components/ui';

const STATS = [
  { n: '5', label: 'IB Themes' },
  { n: '25', label: 'Image prompts' },
  { n: '3', label: 'Exam parts' },
  { n: '30', label: 'Points IB rubric' },
];

export function Hero() {
  const typed = useTypewriter([
    'Individual Oral.',
    'IB French B.',
    'your confidence.',
    'your grade.',
  ]);

  const ref = useEntranceAnimation<HTMLElement>(() => {
    // fromTo + clearProps, never `from`: a `from` tween holds the element at
    // opacity 0 until it completes, so an interrupted animation would leave the
    // landing page blank. clearProps removes the inline styles once it lands.
    const rise = (selector: string, y: number, duration: number, delay: number) =>
      gsap.fromTo(
        selector,
        { opacity: 0, y },
        { opacity: 1, y: 0, duration, delay, ease: 'power3.out', clearProps: 'all' },
      );

    rise('.hero-badge', -16, 0.6, 0);
    rise('.hero-headline', 32, 0.8, 0.15);
    rise('.hero-sub', 20, 0.7, 0.35);
    rise('.hero-cta', 16, 0.6, 0.5);
    rise('.hero-stats', 16, 0.6, 0.65);
  });

  return (
    <section
      ref={ref}
      className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-6 py-20 text-center"
    >
      <h1 className="hero-headline mb-6 max-w-4xl font-display text-5xl font-black leading-[1.05] tracking-tight text-navy md:text-7xl">
        AI that masters
        <br />
        <span className="text-brand">
          {typed}
          <span className="typewriter-cursor" aria-hidden="true" />
        </span>
      </h1>

      <p className="hero-sub mb-10 max-w-xl text-lg leading-relaxed text-slate-500">
        Practice your French B Individual Oral with a live AI examiner:
        you'll be given 10 minutes to prep, followed by a 10 minute presentation period and an adaptive follow-up questions session. After your presentation the AI examiner will present a mark breakdown that quotes what
        you actually said and where you can improve.
      </p>

      <div className="hero-cta mb-16 flex flex-col items-center gap-3 sm:flex-row">
        <LinkButton to="/signup" variant="primary">
          <UserPlus size={16} />
          Sign up free
        </LinkButton>
        <LinkButton to="/practice" variant="secondary">
          <Play size={16} />
          Start practice
        </LinkButton>
        <button
          onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-navy transition-all hover:bg-slate-50"
        >
          See how it works
          <ChevronRight size={16} />
        </button>
      </div>

      <dl className="hero-stats flex flex-wrap items-center justify-center gap-x-10 gap-y-6 text-sm text-slate-400">
        {STATS.map(({ n, label }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <dt className="sr-only">{label}</dt>
            <dd className="font-display text-2xl font-black text-navy">{n}</dd>
            <span className="text-xs">{label}</span>
          </div>
        ))}
      </dl>

      <p className="mt-12 max-w-md text-xs leading-relaxed text-slate-400">
        Marks are AI-generated practice estimates.{' '}
        <button
          onClick={() => document.getElementById('rubric')?.scrollIntoView({ behavior: 'smooth' })}
          className="underline hover:text-brand"
        >
          See how scoring works
        </button>
        .
      </p>
    </section>
  );
}
