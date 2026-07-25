import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { SessionDto } from '@parlons/shared';
import { api } from '../lib/api';
import { ensureUserId } from '../lib/profile';
import { useWebSocketClient } from '../hooks/useWebSocketClient';
import { useMicCapture } from '../hooks/useMicCapture';
import { useSessionStore } from '../state/sessionStore';
import { NotepadEditor } from '../components/NotepadEditor';
import {
  AdaptationPanel,
  AudioLevelMeter,
  Button,
  Card,
  CaptionStream,
  PageShell,
  RecordingIndicator,
  StimulusImageCard,
  Timer,
} from '../components';

export function ExamPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionDto | null>(null);
  const [bullets, setBullets] = useState<string[]>([]);
  const [debugText, setDebugText] = useState('');

  const { connected, send } = useWebSocketClient(sessionId);
  const status = useSessionStore((s) => s.status);
  const phase = useSessionStore((s) => s.phase);
  const remainingMs = useSessionStore((s) => s.remainingMs);
  const captions = useSessionStore((s) => s.captions);
  const examinerSpeaking = useSessionStore((s) => s.examinerSpeaking);
  const showQuestionText = useSessionStore((s) => s.showQuestionText);
  const setShowQuestionText = useSessionStore((s) => s.setShowQuestionText);
  const part1HardStopped = useSessionStore((s) => s.part1HardStopped);
  const competence = useSessionStore((s) => s.competence);
  const complete = useSessionStore((s) => s.complete);
  const error = useSessionStore((s) => s.error);
  const reset = useSessionStore((s) => s.reset);

  useEffect(() => {
    if (!sessionId) return;
    void api.getSession(sessionId, ensureUserId()).then(setSession);
    return () => reset();
  }, [sessionId, reset]);

  useEffect(() => {
    if (complete && sessionId) navigate(`/session/${sessionId}/report`);
  }, [complete, sessionId, navigate]);

  const recordingActive = useMemo(
    () => status === 'PART1_RECORDING' || status === 'PART2_QA' || status === 'PART3_QA',
    [status],
  );

  const { level, error: micError } = useMicCapture(recordingActive, (pcm16Base64) => {
    if (!phase) return;
    send({ type: 'client:audioChunk', phase, seq: 0, pcm16Base64, sampleRate: 16000 });
  });

  const isPractice = session?.mode === 'practice';

  const phaseLabel = (): string => {
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
        return 'Évaluation en cours…';
      default:
        return 'Session';
    }
  };

  if (!session) {
    return (
      <PageShell title="Chargement…">
        <Card>
          <p className="text-sm text-slate-600">Chargement de la session…</p>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell title={phaseLabel()}>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-6">
          <p className="text-sm text-slate-500">
            {connected ? 'Connecté à l’examinateur' : 'Connexion…'}
          </p>
          <Timer
            remainingMs={remainingMs}
            label={status === 'PREP' ? 'Préparation' : 'Temps restant'}
          />
        </div>

        {error && (
          <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error.message}
          </p>
        )}
        {micError && (
          <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Micro indisponible : {micError}
          </p>
        )}

        {status === 'CONSENTED' && (
          <Card className="space-y-4">
            <p className="text-sm text-slate-700">
              Vous allez recevoir un stimulus visuel et disposer de{' '}
              {Math.round(session.prepSecondsAllotted / 60)} minutes de préparation, puis présenter
              pendant 3 à 4 minutes avant les questions de l'examinateur.
            </p>
            <Button onClick={() => send({ type: 'client:startPhase', phase: 'PART1' })}>
              Démarrer la préparation
            </Button>
          </Card>
        )}

        {status === 'PREP' && (
          <div className="grid gap-5 md:grid-cols-2">
            <StimulusImageCard
              imageUrl={session.stimulus.imageUrl}
              captionFr={session.stimulus.captionFr}
              theme={session.stimulus.theme}
              culturalLinkFr={session.stimulus.culturalLinkFr}
              attribution={session.stimulus.attribution}
              licenseName={session.stimulus.licenseName}
            />
            <Card className="space-y-4">
              <NotepadEditor
                bullets={bullets}
                onChange={(next) => {
                  setBullets(next);
                  send({ type: 'client:notepadUpdate', bullets: next });
                }}
              />
              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                <Button onClick={() => send({ type: 'client:startPhase', phase: 'PART1' })}>
                  Je suis prêt — commencer la présentation
                </Button>
                {isPractice && (
                  <Button variant="secondary" onClick={() => send({ type: 'client:skipPrep' })}>
                    Passer la préparation
                  </Button>
                )}
              </div>
            </Card>
          </div>
        )}

        {(status === 'PART1_INTRO' || status === 'PART1_RECORDING' || status === 'PART1_CLOSING') && (
          <div className="grid gap-5 md:grid-cols-2">
            <StimulusImageCard
              imageUrl={session.stimulus.imageUrl}
              captionFr={session.stimulus.captionFr}
              theme={session.stimulus.theme}
              culturalLinkFr={session.stimulus.culturalLinkFr}
              attribution={session.stimulus.attribution}
              licenseName={session.stimulus.licenseName}
            />
            <Card className="space-y-4">
              <RecordingIndicator active={status === 'PART1_RECORDING'} />
              <AudioLevelMeter level={level} />
              {bullets.filter(Boolean).length > 0 && (
                <div>
                  <h2 className="mb-1 text-sm font-semibold text-slate-900">Vos notes</h2>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {bullets.filter(Boolean).map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
              {part1HardStopped && (
                <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  L'examinateur vous a interrompu — les 4 minutes sont écoulées.
                </p>
              )}
              <Button
                variant="secondary"
                onClick={() => send({ type: 'client:endSessionEarly' })}
                disabled={status !== 'PART1_RECORDING'}
              >
                J'ai terminé ma présentation
              </Button>
            </Card>
          </div>
        )}

        {(status === 'PART2_QA' || status === 'PART3_QA') && (
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <RecordingIndicator active={recordingActive} />
              <p className="text-sm text-slate-600" aria-live="polite">
                {examinerSpeaking ? "L'examinateur parle…" : 'À vous de répondre'}
              </p>
            </div>
            <AudioLevelMeter level={level} />
            <AdaptationPanel competence={competence} />

            {isPractice && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={showQuestionText}
                  onChange={(e) => {
                    setShowQuestionText(e.target.checked);
                    send({ type: 'client:toggleTextMode', show: e.target.checked });
                  }}
                />
                Afficher le texte des questions (accessibilité / entraînement)
              </label>
            )}

            <CaptionStream lines={captions} />

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => send({ type: 'client:requestRephrase' })}>
                Pouvez-vous répéter ?
              </Button>
              <Button variant="danger" onClick={() => send({ type: 'client:endSessionEarly' })}>
                Terminer la session
              </Button>
            </div>

            {isPractice && phase && (
              <form
                className="flex gap-2 border-t border-slate-200 pt-4"
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
                  placeholder="Mode mock : tapez votre réponse ici"
                  aria-label="Réponse écrite (mode mock)"
                  className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
                <Button type="submit">Envoyer</Button>
              </form>
            )}
          </Card>
        )}

        {status === 'SCORING' && (
          <Card>
            <p className="text-sm text-slate-700" aria-live="polite">
              Votre oral est terminé. L'évaluation est en cours…
            </p>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
