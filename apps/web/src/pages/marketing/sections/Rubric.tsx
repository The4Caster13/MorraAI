import { useScrollReveal } from '../../../hooks/useAnimations';
import { CRITERIA_SUMMARY } from '../../../lib/themeContent';
import { DisclaimerBanner, LinkButton, PageHeading } from '../../../components/ui';

const BANDS = [
  { label: 'Emerging', desc: 'Limited range; meaning often unclear.' },
  { label: 'Developing', desc: 'Simple but workable; meaning usually clear.' },
  { label: 'Proficient', desc: 'Varied and developed; consistently clear.' },
  { label: 'Strong', desc: 'Rich, nuanced, and largely accurate throughout.' },
];

export function Rubric() {
  const ref = useScrollReveal<HTMLDivElement>('.rubric-row', { y: 0, x: -30 });

  return (
    <section id="rubric" className="scroll-mt-16 bg-offwhite px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 items-start gap-16 lg:grid-cols-2">
          <div>
            <PageHeading
              label="Scoring"
              title="Marked the way your examiner marks you."
            />
            <p className="mt-6 leading-relaxed text-slate-500">
              Morra AI assesses the four criteria used in the French B Individual Oral at Standard
              Level: language, the message in your presentation, the message in conversation, and
              your interactive skills — 30 marks in total.
            </p>
            <p className="mt-4 leading-relaxed text-slate-500">
              Descriptors here are paraphrased in our own words. The IB's published rubric wording
              is copyright, so we describe the same constructs rather than reproducing the official
              text. Check the IB Language B guide for the authoritative version.
            </p>
            <p className="mt-4 leading-relaxed text-slate-500">
              Every mark is returned with quotations from your own transcript. Where the recording
              was unclear or there wasn't enough evidence, the report says so instead of guessing.
            </p>

            <h2 className="mb-3 mt-10 text-sm font-bold uppercase tracking-wide text-navy">
              Bands
            </h2>
            <dl className="space-y-2">
              {BANDS.map(({ label, desc }) => (
                <div key={label} className="flex gap-3 text-sm">
                  <dt className="w-24 shrink-0 font-semibold text-brand">{label}</dt>
                  <dd className="text-slate-500">{desc}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8">
              <LinkButton to="/practice" variant="accent">
                Get your marks
              </LinkButton>
            </div>
          </div>

          <div ref={ref} className="space-y-3">
            {CRITERIA_SUMMARY.map(({ code, label, max, desc }) => (
              <div
                key={code}
                className="rubric-row rounded-xl bg-white p-5"
                style={{ border: '1px solid rgba(10,22,40,0.07)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className="rounded px-2 py-0.5 text-xs font-black text-brand"
                        style={{ background: 'rgba(27,79,216,0.1)' }}
                      >
                        {code}
                      </span>
                      <span className="text-sm font-bold text-navy">{label}</span>
                    </div>
                    <p className="text-xs leading-snug text-slate-400">{desc}</p>
                  </div>
                  <span className="shrink-0 font-display text-2xl font-black text-navy">
                    /{max}
                  </span>
                </div>
              </div>
            ))}
            <div className="rubric-row flex items-center justify-between rounded-xl bg-navy p-4">
              <span className="text-sm font-bold text-white">Total</span>
              <span className="font-display text-2xl font-black text-white">/30</span>
            </div>

            <div className="pt-3">
              <DisclaimerBanner />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
