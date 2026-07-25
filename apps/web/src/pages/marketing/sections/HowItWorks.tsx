import { ChevronRight } from 'lucide-react';
import { useScrollReveal } from '../../../hooks/useAnimations';
import { LinkButton, PageHeading } from '../../../components/ui';

const STEPS = [
  {
    n: '01',
    title: 'Choose your mode',
    desc: 'Exam mode mirrors the real thing: a stimulus you don’t pick and audio-only questions. Practice mode lets you choose the theme and show question text.',
    color: '#1b4fd8',
  },
  {
    n: '02',
    title: 'Prepare (15 min)',
    desc: 'Study the stimulus and write up to 10 bullet points — the same limit as the real exam. In practice mode you can shorten or skip it.',
    color: '#0ea5e9',
  },
  {
    n: '03',
    title: 'Present (3–4 min)',
    desc: 'Describe the image and link it to the theme and francophone culture. At 4:00 the examiner politely interrupts, exactly as a real one would.',
    color: '#7c3aed',
  },
  {
    n: '04',
    title: 'Discussion (4–5 min)',
    desc: 'The examiner asks about your presentation, referencing things you actually said. Ask it to repeat a question at any time.',
    color: '#059669',
  },
  {
    n: '05',
    title: 'Conversation (5–6 min)',
    desc: 'The conversation broadens to other themes, adapting difficulty to the level you have shown so far.',
    color: '#dc2626',
  },
  {
    n: '06',
    title: 'Get your report',
    desc: 'Marks for each criterion with transcript quotes as evidence, three strengths, three priorities, and drills to work on.',
    color: '#0a1628',
  },
];

export function HowItWorks() {
  const ref = useScrollReveal<HTMLDivElement>('.step-card', { y: 48, stagger: 0.09 });

  return (
    <section id="how" className="scroll-mt-16 bg-offwhite px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <PageHeading
            label="How it works"
            title="Six steps to exam-ready."
            intro="The session follows the real IB French B Individual Oral format from start to finish."
            centered
          />
        </div>

        <div ref={ref} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(({ n, title, desc, color }) => (
            <div
              key={n}
              className="step-card relative overflow-hidden rounded-2xl bg-white p-6"
              style={{ border: '1px solid rgba(10,22,40,0.07)' }}
            >
              <span
                className="mb-4 block font-display text-6xl font-black leading-none"
                style={{ color: `${color}18` }}
                aria-hidden="true"
              >
                {n}
              </span>
              <div className="mb-4 h-1 w-8 rounded-full" style={{ background: color }} />
              <h2 className="mb-2 text-sm font-bold text-navy">{title}</h2>
              <p className="text-xs leading-relaxed text-slate-400">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <LinkButton to="/practice" variant="primary">
            Try it now
            <ChevronRight size={16} />
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
