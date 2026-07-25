import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Award, Mic, MicOff, Play, RefreshCw } from 'lucide-react';
import type { SessionDto } from '@parlons/shared';
import { api } from '../../lib/api';
import { ensureUserId } from '../../lib/profile';
import { themeContent } from '../../lib/themeContent';
import { useWebSocketClient } from '../../hooks/useWebSocketClient';
import { useMicCapture } from '../../hooks/useMicCapture';
import { useSessionStore } from '../../state/sessionStore';
import {
  AudioMeter,
  DarkCaptionStream,
  DarkNotepad,
  ExamHeader,
  PrepTips,
  RecordingWave,
} from '../../components/exam';
import { Button, ErrorNote, formatTime } from '../../components/ui';

export function ExamPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionDto | null>(null);
  const [bullets, setBullets] = useState<string[]>([]);
  const [debugText, setDebugText] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [ending, setEnding] = useState(false);

  const { connected, send } = useWebSocketClient(sessionId);
  const status = useSessionStore((s) => s.status);
  const phase = useSessionStore((s) => s.phase);
  const remainingMs = useSessionStore((s) => s.remainingMs);
  const captions = useSessionStore((s) => s.captions);
  const examinerSpeaking = useSessionStore((s) => s.examinerSpeaking);
  const showQuestionText = useSessionStore((s) => s.showQuestionText);
  const setShowQuestionText = useSessionStore((s) => s.setShowQuestionText);
  const part1HardStopped = useSessionStore((s) => s.part1HardStopped);
  const complete = useSessionStore((s) => s.complete);
  const error = useSessionStore((s) => s.error);
  const reset = useSessionStore((s) => s.reset);

  useEffect(() => {
    if (!sessionId) return;
    void api.getSession(sessionId, ensureUserId()).then(setSession);
    return () => reset();
  }, [sessionId, reset]);

  // Redirect on any terminal status, not just the live "sessionComplete" event —
  // that event only fires once, at the moment scoring finishes in a runtime
  // that's still in memory. Loading this page against an already-finished,
  // abandoned, or errored session (e.g. after a reload, or a dropped
  // connection) must not leave the exam screen showing a blank panel forever.
  // Checked against both the WebSocket-reported status and the plain REST
  // fetch, since a WS that never connects would otherwise leave `status` null.
  useEffect(() => {
    if (!sessionId) return;
    const terminal = new Set(['COMPLETE', 'ABANDONED', 'ERROR']);
    if (complete || terminal.has(status ?? '') || terminal.has(session?.status ?? '')) {
      navigate(`/session/${sessionId}/report`);
    }
  }, [complete, status, session?.status, sessionId, navigate]);

  // Clear the in-flight flags once the server confirms a phase change, so a
  // rejected request cannot leave the buttons permanently disabled.
  useEffect(() => {
    setFinishing(false);
    setEnding(false);
  }, [status]);

  const recordingActive = useMemo(
    () => status === 'PART1_RECORDING' || status === 'PART2_QA' || status === 'PART3_QA',
    [status],
  );

  const { level, error: micError } = useMicCapture(recordingActive, (pcm16Base64) => {
    if (!phase) return;
    send({ type: 'client:audioChunk', phase, seq: 0, pcm16Base64, sampleRate: 16000 });
  });

  const isPractice = session?.mode === 'practice';
  const content = session ? themeContent(session.stimulus.theme) : null;
  const accent = content?.color ?? '#1b4fd8';

  const phaseTitle = (): string => {
    switch (status) {
      case 'CONSENTED':
        return 'Prêt à commencer';
      case 'PREP':
        return 'Préparation';
      case 'PART1_INTRO':
      case 'PART1_RECORDING':
      case 'PART1_CLOSING':
        return 'Partie 1 — Présentation';
      case 'PART2_QA':
        return 'Partie 2 — Discussion du stimulus';
      case 'PART3_QA':
        return 'Partie 3 — Conversation générale';
      case 'SCORING':
        return 'Évaluation';
      default:
        return 'Session';
    }
  };

  if (!session || !content) {
    return (
      <div className="on-dark flex min-h-screen items-center justify-center bg-navy-deep text-slate-400">
        <p>Chargement de la session…</p>
      </div>
    );
  }

  const isPart1 = status === 'PART1_INTRO' || status === 'PART1_RECORDING' || status === 'PART1_CLOSING';
  const isQa = status === 'PART2_QA' || status === 'PART3_QA';

  return (
    <div className="on-dark flex min-h-screen flex-col bg-navy-deep">
      <ExamHeader
        themeLabel={content.label}
        accent={accent}
        modeLabel={isPractice ? 'Entraînement' : 'Examen'}
        remainingMs={remainingMs}
        recording={recordingActive}
        phaseTitle={phaseTitle()}
      />

      <div className="flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
        {/* Stimulus — always visible, exactly as the candidate sees it in the real exam. */}
        <div className="relative min-h-[16rem] flex-1 overflow-hidden bg-black/40">
          <img
            src={session.stimulus.imageUrl}
            alt={session.stimulus.captionFr}
            className="h-full w-full object-cover"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(7,15,30,0.9) 0%, transparent 45%)',
            }}
          />
          <figcaption className="absolute inset-x-6 bottom-5">
            <p className="text-sm font-medium leading-snug text-slate-100">
              {session.stimulus.captionFr}
            </p>
            <p className="mt-1 text-xs text-slate-400">{session.stimulus.culturalLinkFr}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {session.stimulus.attribution} — {session.stimulus.licenseName}
            </p>
          </figcaption>
        </div>

        {/* Control panel */}
        <aside
          className="flex w-full shrink-0 flex-col gap-4 border-t p-6 lg:w-[26rem] lg:overflow-y-auto lg:border-l lg:border-t-0"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0a1628' }}
        >
          <p className="text-xs text-slate-500" aria-live="polite">
            {connected ? 'Connecté à l’examinateur' : 'Connexion…'}
          </p>

          {error && <ErrorNote dark>{error.message}</ErrorNote>}
          {micError && (
            <p
              className="rounded-xl px-3 py-2 text-xs text-amber-200"
              style={{
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.25)',
              }}
            >
              Micro indisponible : {micError}
            </p>
          )}

          {status === 'CONSENTED' && (
            <div className="flex flex-1 flex-col justify-center gap-5 text-center">
              <div>
                <h2 className="mb-2 font-display text-xl font-bold text-white">
                  Tout est prêt
                </h2>
                <p className="text-sm leading-relaxed text-slate-400">
                  Vous aurez {Math.round(session.prepSecondsAllotted / 600)} minutes de préparation,
                  puis 10 minutes de présentation avant les questions de l'examinateur.
                </p>
              </div>
              <Button
                variant="accent"
                accent={accent}
                full
                onClick={() => send({ type: 'client:startPhase', phase: 'PART1' })}
              >
                <Play size={16} /> Démarrer la préparation
              </Button>
            </div>
          )}

          {status === 'PREP' && (
            <>
              <div className="flex flex-col items-center py-2">
                <div
                  className="animate-float mb-3 flex h-20 w-20 items-center justify-center rounded-full font-display text-2xl font-black text-white"
                  style={{ background: accent, boxShadow: `0 8px 32px ${accent}66` }}
                >
                  {remainingMs === null ? '—' : formatTime(remainingMs)}
                </div>
                <p className="text-xs text-slate-400">Temps de préparation</p>
              </div>

              <PrepTips accent={accent} />

              <DarkNotepad
                bullets={bullets}
                accent={accent}
                onChange={(next) => {
                  setBullets(next);
                  send({ type: 'client:notepadUpdate', bullets: next });
                }}
              />

              <div className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-4">
                <Button
                  variant="accent"
                  accent={accent}
                  full
                  onClick={() => send({ type: 'client:startPhase', phase: 'PART1' })}
                >
                  <Mic size={16} /> Je suis prêt — présenter
                </Button>
                {isPractice && (
                  <Button variant="ghost-dark" full onClick={() => send({ type: 'client:skipPrep' })}>
                    Passer la préparation
                  </Button>
                )}
              </div>
            </>
          )}

          {isPart1 && (
            <>
              <div>
                <h2 className="text-lg font-bold text-white">Présentation en cours</h2>
                <p className="text-xs text-slate-400">Parlez pendant 10 minutes.</p>
              </div>

              <div
                className="flex flex-col items-center justify-center gap-3 rounded-xl py-8"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <RecordingWave active={status === 'PART1_RECORDING'} />
                <p className="text-xs text-slate-400">
                  {status === 'PART1_RECORDING' ? 'Enregistrement actif' : 'Micro inactif'}
                </p>
              </div>

              <AudioMeter level={level} />

              {bullets.filter(Boolean).length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Vos notes
                  </h3>
                  <ul className="space-y-1">
                    {bullets.filter(Boolean).map((b, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-300">
                        <span style={{ color: accent }} aria-hidden="true">
                          •
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {part1HardStopped && (
                <p
                  className="rounded-xl px-3 py-2 text-sm text-amber-200"
                  style={{
                    background: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.25)',
                  }}
                  role="status"
                >
                  L'examinateur vous a interrompu — les 4 minutes sont écoulées.
                </p>
              )}

              <div className="mt-auto border-t border-white/10 pt-4">
                <Button
                  variant="ghost-dark"
                  full
                  onClick={() => {
                    setFinishing(true);
                    send({ type: 'client:finishPresentation' });
                  }}
                  // Stays disabled until the server confirms the phase change,
                  // which can take a moment — a second press must not queue up.
                  disabled={status !== 'PART1_RECORDING' || finishing}
                >
                  <MicOff size={16} />
                  {finishing ? 'Fin de la présentation…' : "J'ai terminé ma présentation"}
                </Button>
              </div>
            </>
          )}

          {isQa && (
            <>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-white">
                  {status === 'PART2_QA' ? 'Discussion' : 'Conversation'}
                </h2>
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-medium"
                  style={
                    examinerSpeaking
                      ? { background: `${accent}22`, color: accent }
                      : { background: 'rgba(34,197,94,0.12)', color: '#4ade80' }
                  }
                  aria-live="polite"
                >
                  {examinerSpeaking ? "L'examinateur parle…" : 'À vous'}
                </span>
              </div>

              <AudioMeter level={level} />

              {isPractice && (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={showQuestionText}
                    onChange={(e) => {
                      setShowQuestionText(e.target.checked);
                      send({ type: 'client:toggleTextMode', show: e.target.checked });
                    }}
                    className="h-4 w-4 accent-brand"
                  />
                  Afficher le texte des questions
                </label>
              )}

              <DarkCaptionStream lines={captions} />

              <div className="flex flex-col gap-2">
                <Button variant="ghost-dark" full onClick={() => send({ type: 'client:requestRephrase' })}>
                  <RefreshCw size={15} /> Pouvez-vous répéter ?
                </Button>
                <Button
                  variant="danger"
                  full
                  disabled={ending}
                  onClick={() => {
                    if (!confirm('Terminer la session maintenant ?')) return;
                    setEnding(true);
                    send({ type: 'client:endSessionEarly' });
                  }}
                >
                  {ending ? 'Fin de session…' : 'Terminer la session'}
                </Button>
              </div>

              {isPractice && phase && (
                <form
                  className="flex gap-2 border-t border-white/10 pt-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!debugText.trim()) return;
                    send({ type: 'client:debugStudentText', phase, text: debugText.trim() });
                    setDebugText('');
                  }}
                >
                  <input
                    type="text"
                    value={debugText}
                    onChange={(e) => setDebugText(e.target.value)}
                    placeholder="Répondre par écrit (sans micro)"
                    aria-label="Réponse écrite"
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-brand"
                  />
                  <Button type="submit" variant="accent" accent={accent}>
                    Envoyer
                  </Button>
                </form>
              )}
            </>
          )}

          {status === 'SCORING' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <Award size={32} style={{ color: accent }} aria-hidden="true" />
              <div>
                <h2 className="mb-1 font-display text-xl font-bold text-white">Oral terminé</h2>
                <p className="text-sm text-slate-400" aria-live="polite">
                  L'examinateur analyse votre transcription…
                </p>
              </div>
              <div className="recording-wave flex items-end gap-0" style={{ height: 24 }} aria-hidden="true">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span key={i} />
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
