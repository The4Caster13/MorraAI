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
} from '@parlons/shared';
import { CRITERION_MAX } from '@parlons/shared';
import { api } from '../../lib/api';
import { ensureUserId } from '../../lib/profile';
import { themeContent } from '../../lib/themeContent';
import { Button, DisclaimerBanner, Logo, SplitText } from '../../components/ui';

const CRITERION_TITLES: Record<string, string> = {
  A: 'A — Langue',
  B1: 'B1 — Message : stimulus',
  B2: 'B2 — Message : conversation',
  C: 'C — Compétences interactives',
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

  const color = pct >= 75 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#f59e0b';

  return (
    <div className="mb-5">
      <div className="mb-2 flex justify-between">
        <span className="text-sm font-medium text-slate-300">{CRITERION_TITLES[code]}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>
          {score}/{max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.08]">
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
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold text-white">{CRITERION_TITLES[code]}</h3>
        <span className="shrink-0 font-mono text-lg tabular-nums text-brand-bright">
          {result.mark}
          <span className="text-xs text-slate-500">
            /{CRITERION_MAX[code as keyof typeof CRITERION_MAX]}
          </span>
        </span>
      </header>
      <span className="mb-3 inline-block rounded bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-slate-300">
        {result.band}
      </span>
      <p className="mb-3 text-sm leading-relaxed text-slate-400">{result.justification}</p>
      {result.evidenceQuotes.length > 0 && (
        <>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Extraits cités
          </p>
          <ul className="space-y-1.5">
            {result.evidenceQuotes.map((q, i) => (
              <li
                key={i}
                className="border-l-2 pl-3 text-sm italic text-slate-400"
                style={{ borderColor: 'rgba(59,130,246,0.4)' }}
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
  { key: 'pronunciation', label: 'Prononciation', icon: Volume2 },
  { key: 'intonation', label: 'Intonation', icon: AudioLines },
  { key: 'fluency', label: 'Aisance', icon: Waves },
  { key: 'pace', label: 'Débit', icon: Gauge },
] as const;

/**
 * Criterion A covers pronunciation, intonation and fluency, which a transcript
 * cannot show — this section reports what the scorer heard in the recording.
 */
function DeliveryCard({ delivery, accent }: { delivery: DeliveryDto; accent: string }) {
  return (
    <section className="results-card rounded-2xl border border-white/[0.07] bg-white/[0.03] p-7 lg:col-span-3">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Volume2 size={16} style={{ color: accent }} aria-hidden="true" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-white">
          Voix et diction
        </h2>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={
            delivery.audioAssessed
              ? { background: 'rgba(34,197,94,0.12)', color: '#4ade80' }
              : { background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }
          }
        >
          {delivery.audioAssessed ? 'Analysé depuis votre enregistrement' : 'Non analysé'}
        </span>
      </div>

      {!delivery.audioAssessed && (
        <p className="mb-5 text-sm leading-relaxed text-amber-200">
          Aucun enregistrement exploitable n'a pu être analysé, donc la prononciation et
          l'intonation n'ont pas été prises en compte dans le critère A.
        </p>
      )}

      <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {DELIVERY_ASPECTS.map(({ key, label, icon: Icon }) => (
          <div key={key} className="rounded-xl bg-white/[0.03] p-4">
            <dt className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Icon size={13} aria-hidden="true" />
              {label}
            </dt>
            <dd className="text-sm leading-relaxed text-slate-300">{delivery[key]}</dd>
          </div>
        ))}
      </dl>

      {delivery.observations.length > 0 && (
        <>
          <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Moments entendus
          </h3>
          <ul className="space-y-1.5">
            {delivery.observations.map((o, i) => (
              <li
                key={i}
                className="border-l-2 pl-3 text-sm text-slate-400"
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

  useEffect(() => {
    if (!sessionId) return;
    const userId = ensureUserId();
    void api.getSession(sessionId, userId).then(setSession);
    void api.getTranscript(sessionId, userId).then(setTranscript);
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
    if (!confirm('Supprimer définitivement cette session, son audio et sa transcription ?')) return;
    await api.deleteSession(sessionId, ensureUserId());
    navigate('/history');
  };

  if (!session) {
    return (
      <div className="on-dark flex min-h-screen items-center justify-center bg-navy-deep text-slate-400">
        <p>Chargement du rapport…</p>
      </div>
    );
  }

  const score = session.score;
  const content = themeContent(session.stimulus.theme);
  const pct = score ? score.total / 30 : 0;
  const totalColor = pct >= 0.75 ? '#22c55e' : pct >= 0.5 ? '#3b82f6' : '#f59e0b';

  return (
    <div ref={containerRef} className="on-dark min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
          <div className="results-header">
            <h1 className="mb-2 font-display text-4xl font-black text-white">
              <SplitText text="Vos résultats" />
            </h1>
            <p className="text-sm text-slate-400">
              {content.label} · {session.mode === 'exam' ? 'Mode examen' : 'Mode entraînement'} ·{' '}
              {new Date(session.createdAt).toLocaleDateString('fr-FR')}
            </p>
          </div>
          <Logo size="sm" dark />
        </div>

        {!score && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6">
            <p className="text-sm text-slate-300">
              Aucune évaluation n'est disponible pour cette session (statut : {session.status}).
              {session.status === 'ABANDONED' &&
                ' La session a été interrompue avant la fin de la partie 3.'}
            </p>
          </div>
        )}

        {score && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="results-card flex flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03] p-8 text-center">
              <p className="mb-4 text-xs uppercase tracking-widest text-slate-400">
                Total estimé
              </p>
              <div
                ref={totalRef}
                className="mb-4 flex h-28 w-28 items-center justify-center rounded-full"
                style={{
                  background: `${totalColor}18`,
                  border: `2px solid ${totalColor}40`,
                  boxShadow: `0 0 40px ${totalColor}20`,
                }}
              >
                <span
                  className="font-display text-5xl font-black tabular-nums"
                  style={{ color: totalColor }}
                >
                  {score.total}
                </span>
              </div>
              <p className="text-lg font-bold text-white">sur 30</p>
              <p className="mt-1 text-xs text-slate-500">Estimation d'entraînement</p>
            </div>

            <div className="results-card rounded-2xl border border-white/[0.07] bg-white/[0.03] p-7 lg:col-span-2">
              <div className="mb-6 flex items-center gap-2">
                <TrendingUp size={16} style={{ color: content.color }} aria-hidden="true" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-white">
                  Détail par critère
                </h2>
              </div>
              <ScoreBar code="A" score={score.criterionA.mark} max={CRITERION_MAX.A} delay={0.5} />
              <ScoreBar code="B1" score={score.criterionB1.mark} max={CRITERION_MAX.B1} delay={0.65} />
              <ScoreBar code="B2" score={score.criterionB2.mark} max={CRITERION_MAX.B2} delay={0.8} />
              <ScoreBar code="C" score={score.criterionC.mark} max={CRITERION_MAX.C} delay={0.95} />
            </div>

            {score.uncertaintyNote && (
              <div
                className="results-card rounded-2xl px-5 py-4 lg:col-span-3"
                style={{
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.25)',
                }}
              >
                <p className="text-sm leading-relaxed text-amber-200">
                  <strong>Note d'incertitude :</strong> {score.uncertaintyNote}
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

            <div className="results-card rounded-2xl border border-white/[0.07] bg-white/[0.03] p-7">
              <div className="mb-5 flex items-center gap-2">
                <Sparkles size={16} className="text-green-400" aria-hidden="true" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-white">
                  Points forts
                </h2>
              </div>
              <ul className="space-y-3">
                {score.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-green-400"
                      style={{
                        background: 'rgba(34,197,94,0.15)',
                        border: '1px solid rgba(34,197,94,0.3)',
                      }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm leading-relaxed text-slate-300">{s}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="results-card rounded-2xl border border-white/[0.07] bg-white/[0.03] p-7 lg:col-span-2">
              <div className="mb-5 flex items-center gap-2">
                <Target size={16} className="text-brand-bright" aria-hidden="true" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-white">
                  Priorités
                </h2>
              </div>
              <ol className="space-y-3">
                {score.priorities.map((p, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-brand-bright"
                      style={{
                        background: 'rgba(59,130,246,0.15)',
                        border: '1px solid rgba(59,130,246,0.3)',
                      }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm leading-relaxed text-slate-300">{p}</p>
                  </li>
                ))}
              </ol>

              {score.drills.length > 0 && (
                <>
                  <div className="mb-3 mt-6 flex items-center gap-2 border-t border-white/10 pt-5">
                    <Brain size={15} className="text-slate-400" aria-hidden="true" />
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Exercices suggérés
                    </h3>
                  </div>
                  <ul className="space-y-1.5">
                    {score.drills.map((d, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-400">
                        <span style={{ color: content.color }} aria-hidden="true">
                          •
                        </span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}

        <div className="results-card mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-brand-bright" aria-hidden="true" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">
                Transcription
              </h2>
              <span className="text-xs text-slate-500">({transcript.length} segments)</span>
            </div>
            <Button variant="ghost-dark" onClick={() => setShowTranscript((v) => !v)}>
              {showTranscript ? 'Masquer' : 'Afficher'}
            </Button>
          </div>
          {showTranscript && (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {transcript.length === 0 && (
                <p className="text-sm text-slate-500">Aucune transcription enregistrée.</p>
              )}
              {transcript.map((seg) => (
                <p key={seg.id} className="text-sm leading-relaxed">
                  <span className="font-mono text-xs text-slate-600">[{seg.phase}] </span>
                  <span
                    className={`font-semibold ${
                      seg.speaker === 'EXAMINER' ? 'text-brand-bright' : 'text-slate-200'
                    }`}
                  >
                    {seg.speaker === 'EXAMINER' ? 'Examinateur' : 'Vous'} :{' '}
                  </span>
                  <span className="text-slate-400">{seg.text}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6">
          <DisclaimerBanner dark />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/practice"
            className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Nouvelle session
          </Link>
          <Link
            to="/history"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
          >
            Mon historique
          </Link>
          <Button variant="danger" onClick={remove}>
            Supprimer cette session
          </Button>
        </div>
      </div>
    </div>
  );
}
