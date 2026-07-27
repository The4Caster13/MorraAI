import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { gsap } from 'gsap';
import {
  AudioLines,
  Brain,
  Gauge,
  MessageSquare,
  Sparkles,
  Target,
  TrendingUp,
  Volume2,
  Waves,
} from 'lucide-react';
import type {
  CriterionResult,
  DeliveryDto,
  ScoreDto,
  SessionDto,
  TranscriptSegmentDto,
} from '@morrai/shared';
import { CRITERION_MAX } from '@morrai/shared';
import { api } from '../../lib/api';
import { themeContent } from '../../lib/themeContent';
import { Button, Card, DisclaimerBanner, Logo, SplitText } from '../../components/ui';
import { useConfirm } from '../../components/ConfirmDialog';

const CRITERION_TITLES: Record<string, string> = {
  A: 'A — Language',
  B1: 'B1 — Message: stimulus',
  B2: 'B2 — Message: conversation',
  C: 'C — Interactive skills',
};

function ScoreBar({
  code,
  score,
  max,
  delay,
}: {
  code: string;
  score: number;
  max: number;
  delay: number;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const pct = Math.round((score / max) * 100);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.width = `${pct}%`;
      return;
    }
    gsap.fromTo(el, { width: '0%' }, { width: `${pct}%`, duration: 1.1, delay, ease: 'power3.out' });
  }, [pct, delay]);

  const color = pct >= 75 ? '#16a34a' : pct >= 50 ? '#1b4fd8' : '#b45309';

  return (
    <div className="mb-5">
      <div className="mb-2 flex justify-between">
        <span className="text-sm font-medium text-slate-600">{CRITERION_TITLES[code]}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>
          {score}/{max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div
          ref={barRef}
          className="h-2 rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}aa)`, width: 0 }}
        />
      </div>
    </div>
  );
}

function CriterionDetail({ code, result }: { code: string; result: CriterionResult }) {
  return (
    <section className="rounded-2xl p-5" style={{ border: '1px solid rgba(10,22,40,0.08)' }}>
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold text-navy">{CRITERION_TITLES[code]}</h3>
        <span className="shrink-0 font-mono text-lg tabular-nums text-brand">
          {result.mark}
          <span className="text-xs text-slate-400">
            /{CRITERION_MAX[code as keyof typeof CRITERION_MAX]}
          </span>
        </span>
      </header>
      <span className="mb-3 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        {result.band}
      </span>
      <p className="mb-3 text-sm leading-relaxed text-slate-600">{result.justification}</p>
      {result.evidenceQuotes.length > 0 && (
        <>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Quoted extracts
          </p>
          <ul className="space-y-1.5">
            {result.evidenceQuotes.map((q, i) => (
              <li
                key={i}
                className="border-l-2 pl-3 text-sm italic text-slate-500"
                style={{ borderColor: 'rgba(27,79,216,0.3)' }}
              >
                « {q} »
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

const DELIVERY_ASPECTS = [
  { key: 'pronunciation', label: 'Pronunciation', icon: Volume2 },
  { key: 'intonation', label: 'Intonation', icon: AudioLines },
  { key: 'fluency', label: 'Fluency', icon: Waves },
  { key: 'pace', label: 'Pace', icon: Gauge },
] as const;

/**
 * Criterion A covers pronunciation, intonation and fluency, which a transcript
 * cannot show — this section reports what the scorer heard in the recording.
 */
function DeliveryCard({ delivery, accent }: { delivery: DeliveryDto; accent: string }) {
  return (
    <section
      className="results-card rounded-2xl p-7 lg:col-span-3"
      style={{ border: '1px solid rgba(10,22,40,0.08)' }}
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Volume2 size={16} style={{ color: accent }} aria-hidden="true" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-navy">
          Voice and delivery
        </h2>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={
            delivery.audioAssessed
              ? { background: 'rgba(34,197,94,0.12)', color: '#15803d' }
              : { background: 'rgba(245,158,11,0.12)', color: '#b45309' }
          }
        >
          {delivery.audioAssessed ? 'Assessed from your recording' : 'Not assessed'}
        </span>
      </div>

      {!delivery.audioAssessed && (
        <p className="mb-5 text-sm leading-relaxed text-amber-800">
          No usable recording could be analysed, so pronunciation and intonation were not
          taken into account for Criterion A.
        </p>
      )}

      <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {DELIVERY_ASPECTS.map(({ key, label, icon: Icon }) => (
          <div key={key} className="rounded-xl bg-slate-50 p-4">
            <dt className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Icon size={13} aria-hidden="true" />
              {label}
            </dt>
            <dd className="text-sm leading-relaxed text-slate-600">{delivery[key]}</dd>
          </div>
        ))}
      </dl>

      {delivery.observations.length > 0 && (
        <>
          <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
            What we heard
          </h3>
          <ul className="space-y-1.5">
            {delivery.observations.map((o, i) => (
              <li
                key={i}
                className="border-l-2 pl-3 text-sm text-slate-500"
                style={{ borderColor: `${accent}66` }}
              >
                {o}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function ReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<(SessionDto & { score: ScoreDto | null }) | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSegmentDto[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLDivElement>(null);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    if (!sessionId) return;
    void api.getSession(sessionId).then(setSession);
    void api.getTranscript(sessionId).then(setTranscript);
  }, [sessionId]);

  useEffect(() => {
    if (!session?.score || !containerRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.results-header .char', { opacity: 0, y: 26, stagger: 0.028, duration: 0.6 });
      tl.from(
        totalRef.current,
        { scale: 0, rotation: -180, opacity: 0, duration: 0.8, ease: 'back.out(1.7)' },
        0.25,
      );
      tl.from('.results-card', { opacity: 0, y: 28, stagger: 0.09, duration: 0.5 }, 0.45);
    }, containerRef);
    return () => ctx.revert();
  }, [session?.score]);

  const remove = async () => {
    if (!sessionId) return;
    const ok = await confirm({
      message: 'Permanently delete this session, its recording and its transcript?',
      danger: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await api.deleteSession(sessionId);
    navigate('/history');
  };

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-slate-500">
        <p>Loading report…</p>
      </main>
    );
  }

  const score = session.score;
  const content = themeContent(session.stimulus.theme);
  const pct = score ? score.total / 30 : 0;
  const totalColor = pct >= 0.75 ? '#16a34a' : pct >= 0.5 ? '#1b4fd8' : '#b45309';

  return (
    <div ref={containerRef} className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
          <div className="results-header">
            <h1 className="mb-2 font-display text-4xl font-black text-navy">
              <SplitText text="Your results" />
            </h1>
            <p className="text-sm text-slate-500">
              {content.label} · {session.mode === 'exam' ? 'Exam mode' : 'Practice mode'} ·{' '}
              {new Date(session.createdAt).toLocaleDateString('en-GB')}
            </p>
          </div>
          <Link to="/" aria-label="Morra AI — home">
            <Logo size="sm" />
          </Link>
        </div>

        {!score && (
          <Card>
            <p className="text-sm text-slate-600">
              No marks are available for this session (status: {session.status}).
              {session.status === 'ABANDONED' &&
                ' The session was ended before part 3 finished.'}
            </p>
          </Card>
        )}

        {score && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div
              className="results-card flex flex-col items-center justify-center rounded-2xl p-8 text-center"
              style={{ border: '1px solid rgba(10,22,40,0.08)' }}
            >
              <p className="mb-4 text-xs uppercase tracking-widest text-slate-400">
                Estimated total
              </p>
              <div
                ref={totalRef}
                className="mb-4 flex h-28 w-28 items-center justify-center rounded-full"
                style={{
                  background: `${totalColor}12`,
                  border: `2px solid ${totalColor}30`,
                  boxShadow: `0 0 40px ${totalColor}15`,
                }}
              >
                <span
                  className="font-display text-5xl font-black tabular-nums"
                  style={{ color: totalColor }}
                >
                  {score.total}
                </span>
              </div>
              <p className="text-lg font-bold text-navy">out of 30</p>
              <p className="mt-1 text-xs text-slate-400">Practice estimate</p>
            </div>

            <div
              className="results-card rounded-2xl p-7 lg:col-span-2"
              style={{ border: '1px solid rgba(10,22,40,0.08)' }}
            >
              <div className="mb-6 flex items-center gap-2">
                <TrendingUp size={16} style={{ color: content.color }} aria-hidden="true" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-navy">
                  Criterion breakdown
                </h2>
              </div>
              <ScoreBar code="A" score={score.criterionA.mark} max={CRITERION_MAX.A} delay={0.5} />
              <ScoreBar code="B1" score={score.criterionB1.mark} max={CRITERION_MAX.B1} delay={0.65} />
              <ScoreBar code="B2" score={score.criterionB2.mark} max={CRITERION_MAX.B2} delay={0.8} />
              <ScoreBar code="C" score={score.criterionC.mark} max={CRITERION_MAX.C} delay={0.95} />
            </div>

            {score.uncertaintyNote && (
              <div className="results-card rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 lg:col-span-3">
                <p className="text-sm leading-relaxed text-amber-800">
                  <strong>Uncertainty note:</strong> {score.uncertaintyNote}
                </p>
              </div>
            )}

            {score.delivery && <DeliveryCard delivery={score.delivery} accent={content.color} />}

            <div className="results-card grid grid-cols-1 gap-4 md:grid-cols-2 lg:col-span-3">
              <CriterionDetail code="A" result={score.criterionA} />
              <CriterionDetail code="B1" result={score.criterionB1} />
              <CriterionDetail code="B2" result={score.criterionB2} />
              <CriterionDetail code="C" result={score.criterionC} />
            </div>

            <Card className="results-card">
              <div className="mb-5 flex items-center gap-2">
                <Sparkles size={16} className="text-green-600" aria-hidden="true" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-navy">
                  Strengths
                </h2>
              </div>
              <ul className="space-y-3">
                {score.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-green-700"
                      style={{
                        background: 'rgba(34,197,94,0.12)',
                        border: '1px solid rgba(34,197,94,0.3)',
                      }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm leading-relaxed text-slate-600">{s}</p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="results-card lg:col-span-2">
              <div className="mb-5 flex items-center gap-2">
                <Target size={16} className="text-brand" aria-hidden="true" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-navy">
                  Priorities
                </h2>
              </div>
              <ol className="space-y-3">
                {score.priorities.map((p, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-brand"
                      style={{
                        background: 'rgba(27,79,216,0.1)',
                        border: '1px solid rgba(27,79,216,0.3)',
                      }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm leading-relaxed text-slate-600">{p}</p>
                  </li>
                ))}
              </ol>

              {score.drills.length > 0 && (
                <>
                  <div className="mb-3 mt-6 flex items-center gap-2 border-t pt-5" style={{ borderColor: 'rgba(10,22,40,0.08)' }}>
                    <Brain size={15} className="text-slate-400" aria-hidden="true" />
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Suggested drills
                    </h3>
                  </div>
                  <ul className="space-y-1.5">
                    {score.drills.map((d, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-500">
                        <span style={{ color: content.color }} aria-hidden="true">
                          •
                        </span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </div>
        )}

        <Card className="results-card mt-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-brand" aria-hidden="true" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-navy">
                Transcript
              </h2>
              <span className="text-xs text-slate-400">({transcript.length} segments)</span>
            </div>
            <Button variant="secondary" onClick={() => setShowTranscript((v) => !v)}>
              {showTranscript ? 'Hide' : 'Show'}
            </Button>
          </div>
          {showTranscript && (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {transcript.length === 0 && (
                <p className="text-sm text-slate-400">No transcript was recorded.</p>
              )}
              {transcript.map((seg) => (
                <p key={seg.id} className="text-sm leading-relaxed">
                  <span className="font-mono text-xs text-slate-400">[{seg.phase}] </span>
                  <span
                    className={`font-semibold ${
                      seg.speaker === 'EXAMINER' ? 'text-brand' : 'text-navy'
                    }`}
                  >
                    {seg.speaker === 'EXAMINER' ? 'Examiner' : 'You'}:{' '}
                  </span>
                  <span className="text-slate-600">{seg.text}</span>
                </p>
              ))}
            </div>
          )}
        </Card>

        <div className="mt-6">
          <DisclaimerBanner />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/practice"
            className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            New session
          </Link>
          <Link
            to="/history"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-navy transition-colors hover:bg-slate-50"
          >
            My history
          </Link>
          <Button variant="danger" onClick={remove}>
            Delete this session
          </Button>
        </div>
      </div>
      {dialog}
    </div>
  );
}
