import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SessionSummaryDto } from '@parlons/shared';
import { THEME_LABELS } from '@parlons/shared';
import { api } from '../lib/api';
import { getStoredUserId } from '../lib/profile';
import { Button, Card, PageShell } from '../components';

export function HistoryPage() {
  const [sessions, setSessions] = useState<SessionSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = getStoredUserId();

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    void api
      .listSessions(userId)
      .then(setSessions)
      .finally(() => setLoading(false));
  }, [userId]);

  const remove = async (id: string) => {
    if (!confirm('Supprimer définitivement cette session ?')) return;
    await api.deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const scored = sessions.filter((s) => s.marks);

  return (
    <PageShell title="Mes sessions">
      <div className="space-y-5">
        {loading && (
          <Card>
            <p className="text-sm text-slate-600">Chargement…</p>
          </Card>
        )}

        {!loading && sessions.length === 0 && (
          <Card className="space-y-3">
            <p className="text-sm text-slate-700">Vous n'avez pas encore fait d'oral.</p>
            <Link
              to="/"
              className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Commencer
            </Link>
          </Card>
        )}

        {scored.length > 1 && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Progression (total sur 30)
            </h2>
            <div className="flex items-end gap-2" role="img" aria-label="Graphique de progression">
              {scored
                .slice()
                .reverse()
                .map((s) => (
                  <div key={s.id} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-xs tabular-nums text-slate-500">{s.marks!.total}</span>
                    <div
                      className="w-full rounded-t bg-indigo-500"
                      style={{ height: `${(s.marks!.total / 30) * 120}px` }}
                    />
                  </div>
                ))}
            </div>
          </Card>
        )}

        {sessions.map((s) => (
          <Card key={s.id} className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-indigo-700">
                {THEME_LABELS[s.theme]} · {s.mode === 'exam' ? 'Examen' : 'Entraînement'}
              </p>
              <p className="text-sm font-medium text-slate-900">{s.stimulusCaption}</p>
              <p className="text-xs text-slate-500">
                {new Date(s.createdAt).toLocaleString('fr-FR')} · {s.status}
              </p>
              {s.marks && (
                <p className="font-mono text-sm tabular-nums text-slate-700">
                  A {s.marks.A}/12 · B1 {s.marks.B1}/6 · B2 {s.marks.B2}/6 · C {s.marks.C}/6 ·{' '}
                  <strong>{s.marks.total}/30</strong>
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <Link
                to={`/session/${s.id}/report`}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-center text-sm text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Rapport
              </Link>
              <Button variant="danger" onClick={() => remove(s.id)}>
                Supprimer
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
