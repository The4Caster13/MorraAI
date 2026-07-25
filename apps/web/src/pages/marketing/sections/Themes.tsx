import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { StimulusDto } from '@morrai/shared';
import { api } from '../../../lib/api';
import { THEME_CONTENT } from '../../../lib/themeContent';
import { useScrollReveal } from '../../../hooks/useAnimations';
import { PageHeading } from '../../../components/ui';

export function Themes() {
  const ref = useScrollReveal<HTMLDivElement>('.theme-sec-card', { stagger: 0.08 });
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Show the real size of the reviewed stimulus pool rather than a hardcoded number.
  useEffect(() => {
    void api
      .listStimuli()
      .then((stimuli: StimulusDto[]) => {
        const tally: Record<string, number> = {};
        for (const s of stimuli) tally[s.theme] = (tally[s.theme] ?? 0) + 1;
        setCounts(tally);
      })
      .catch(() => setCounts({}));
  }, []);

  return (
    <section id="themes" className="scroll-mt-16 px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <PageHeading
            label="Themes"
            title="All 5 IB French B themes."
            intro="Every theme from the IB Language B guide is covered. In exam mode the stimulus is chosen for you, just like the real thing."
            centered
          />
        </div>

        <div ref={ref} className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {THEME_CONTENT.map((theme) => {
            const Icon = theme.icon;
            const count = counts[theme.id];
            return (
              <article
                key={theme.id}
                className="theme-sec-card overflow-hidden rounded-2xl"
                style={{ border: '1px solid rgba(10,22,40,0.08)' }}
              >
                <div className="relative h-36 overflow-hidden bg-slate-200">
                  <img
                    src={theme.heroImage}
                    alt={theme.heroAlt}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0" style={{ background: 'rgba(10,22,40,0.3)' }} />
                  <div
                    className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
                  >
                    <Icon size={17} className="text-white" aria-hidden="true" />
                  </div>
                </div>
                <div className="p-5">
                  <div className="mb-2 flex items-baseline gap-2">
                    <h2 className="font-bold text-navy">{theme.label}</h2>
                    <span className="text-xs text-slate-400">{theme.subtitle}</span>
                  </div>
                  <p className="mb-4 text-xs leading-relaxed text-slate-400">{theme.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {count === undefined ? '—' : `${count} stimulus`}
                    </span>
                    <Link
                      to={`/practice?theme=${theme.id}`}
                      className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-80"
                      style={{ color: theme.color }}
                    >
                      Practise <ChevronRight size={12} />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}

          <div
            className="theme-sec-card flex flex-col items-center justify-center rounded-2xl p-6 text-center"
            style={{
              border: '1px dashed rgba(10,22,40,0.15)',
              background: '#f8faff',
              minHeight: 200,
            }}
          >
            <p className="mb-1 text-sm font-bold text-navy">More coming</p>
            <p className="text-xs text-slate-400">
              HL literary-extract mode and a teacher dashboard are in development.
            </p>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-slate-400">
          The photographs above illustrate each theme on this page only. Exam stimuli are served
          from a separate reviewed pool with their own licence and attribution.
        </p>
      </div>
    </section>
  );
}
