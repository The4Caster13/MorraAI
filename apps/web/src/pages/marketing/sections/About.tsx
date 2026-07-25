import { Brain, FileText, ScanSearch, Volume2 } from 'lucide-react';
import { useScrollReveal } from '../../../hooks/useAnimations';
import { LinkButton, PageHeading } from '../../../components/ui';

const FEATURES = [
  {
    icon: ScanSearch,
    title: 'Real visual stimuli',
    desc: 'A reviewed image pool across all five IB French B themes, each tagged with a francophone cultural link.',
  },
  {
    icon: Volume2,
    title: 'Live mock IO',
    desc: 'The full exam shape: 10 minutes of prep with a 10-bullet notepad, then a timed presentation and discussion.',
  },
  {
    icon: Brain,
    title: 'Adaptive examiner',
    desc: 'Questions are generated from what you actually said, and get harder or simpler as you speak.',
  },
  {
    icon: FileText,
    title: 'Evidence-cited marks',
    desc: 'Every criterion comes with a justification that quotes your transcript — no vague feedback.',
  },
];

export function About() {
  const ref = useScrollReveal<HTMLDivElement>('.about-item');

  return (
    <section id="about" className="scroll-mt-16 px-6 py-20">
      <div ref={ref} className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <div className="about-item">
            <PageHeading
              label="About"
              title="Built for IB students who want more than just practice."
            />
            <p className="mt-6 leading-relaxed text-slate-500">
              Morra AI is designed specifically for IB Diploma French B students preparing for the
              Individual Oral. Unlike generic language apps, every part of the session mirrors the
              real exam — the timings, the 10-bullet note limit, and an examiner who never corrects
              you mid-session.
            </p>
            <p className="mt-4 leading-relaxed text-slate-500">
              The AI listens to your presentation, then asks follow-up questions calibrated to your
              demonstrated level. Afterwards it marks you against paraphrased IB-style criteria and
              shows you the exact lines it based each mark on.
            </p>
            <p className="mt-4 leading-relaxed text-slate-500">
              It is a practice tool, not an examiner. Marks are estimates to help you improve, never
              a predicted grade.
            </p>
            <div className="mt-8">
              <LinkButton to="/practice" variant="primary">
                Try a session
              </LinkButton>
            </div>
          </div>

          <div className="about-item grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl p-5"
                style={{ background: '#f8faff', border: '1px solid rgba(10,22,40,0.07)' }}
              >
                <div
                  className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: 'rgba(27,79,216,0.1)' }}
                >
                  <Icon size={18} className="text-brand" aria-hidden="true" />
                </div>
                <h2 className="mb-1.5 text-sm font-bold text-navy">{title}</h2>
                <p className="text-xs leading-relaxed text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
