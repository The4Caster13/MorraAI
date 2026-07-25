import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ScoreDto, SessionDto, TranscriptSegmentDto } from '@parlons/shared';
import { CRITERION_MAX } from '@parlons/shared';
import { api } from '../lib/api';
import { Button, Card, DisclaimerBanner, PageShell } from '../components';
import { ScoreCard } from '../components/ScoreCard';

export function ReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<(SessionDto & { score: ScoreDto | null }) | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSegmentDto[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    void api.getSession(sessionId).then(setSession);
    void api.getTranscript(sessionId).then(setTranscript);
  }, [sessionId]);

  const remove = async () => {
    if (!sessionId) return;
    if (!confirm('Supprimer définitivement cette session, son audio et sa transcription ?')) return;
    await api.deleteSession(sessionId);
    navigate('/history');
  };

  if (!session) {
    return (
      <PageShell title="Rapport">
        <Card>
          <p className="text-sm text-slate-600">Chargement…</p>
        </Card>
      </PageShell>
    );
  }

  const score = session.score;

  return (
    <PageShell title="Votre rapport">
      <div className="space-y-5">
        <DisclaimerBanner />

        {!score && (
          <Card>
            <p className="text-sm text-slate-700">
              Aucune évaluation n'est disponible pour cette session (statut : {session.status}).
            </p>
          </Card>
        )}

        {score && (
          <>
            <Card className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Total estimé</p>
                <p className="font-mono text-4xl tabular-nums text-indigo-700">
                  {score.total}
                  <span className="text-lg text-slate-400">/30</span>
                </p>
              </div>
              <p className="max-w-xs text-right text-sm text-slate-600">
                {session.stimulus.captionFr}
              </p>
            </Card>

            {score.uncertaintyNote && (
              <p className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <strong>Note d'incertitude :</strong> {score.uncertaintyNote}
              </p>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <ScoreCard criterion="A" max={CRITERION_MAX.A} result={score.criterionA} />
              <ScoreCard criterion="B1" max={CRITERION_MAX.B1} result={score.criterionB1} />
              <ScoreCard criterion="B2" max={CRITERION_MAX.B2} result={score.criterionB2} />
              <ScoreCard criterion="C" max={CRITERION_MAX.C} result={score.criterionC} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <h2 className="mb-2 text-sm font-semibold text-slate-900">Points forts</h2>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {score.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </Card>
              <Card>
                <h2 className="mb-2 text-sm font-semibold text-slate-900">Priorités</h2>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
                  {score.priorities.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ol>
              </Card>
            </div>

            {score.drills.length > 0 && (
              <Card>
                <h2 className="mb-2 text-sm font-semibold text-slate-900">Exercices suggérés</h2>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {score.drills.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Transcription</h2>
            <Button variant="secondary" onClick={() => setShowTranscript((v) => !v)}>
              {showTranscript ? 'Masquer' : 'Afficher'}
            </Button>
          </div>
          {showTranscript && (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {transcript.length === 0 && (
                <p className="text-sm text-slate-400">Aucune transcription enregistrée.</p>
              )}
              {transcript.map((seg) => (
                <p key={seg.id} className="text-sm">
                  <span className="text-xs font-mono text-slate-400">[{seg.phase}] </span>
                  <span
                    className={`font-semibold ${seg.speaker === 'EXAMINER' ? 'text-indigo-700' : 'text-slate-700'}`}
                  >
                    {seg.speaker === 'EXAMINER' ? 'Examinateur' : 'Vous'} :{' '}
                  </span>
                  {seg.text}
                </p>
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            Nouvelle session
          </Link>
          <Link
            to="/history"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Historique
          </Link>
          <Button variant="danger" onClick={remove}>
            Supprimer cette session
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
