import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import type { SessionSummaryDto } from '@morrai/shared';
import { api } from '../../lib/api';
import { getStoredUserId } from '../../lib/profile';
import { themeContent } from '../../lib/themeContent';
import { Button, Card, Logo } from '../../components/ui';
import { useConfirm } from '../../components/ConfirmDialog';

export function HistoryPage() {
  const [sessions, setSessions] = useState<SessionSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = getStoredUserId();
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    void api
      .listSessions(userId)
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [userId]);

  const remove = async (id: string) => {
    if (!userId) return;
    if (!(await confirm({ message: 'Permanently delete this session?', danger: true, confirmLabel: 'Delete' })))
      return;
    await api.deleteSession(id, userId);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const scored = sessions.filter((s) => s.marks);
  const best = scored.length ? Math.max(...scored.map((s) => s.marks!.total)) : null;
  const average = scored.length
    ? Math.round(scored.reduce((sum, s) => sum + s.marks!.total, 0) / scored.length)
    : null;

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-navy"
          >
            <ArrowLeft size={16} /> Back to site
          </Link>
          <Link to="/" aria-label="Morra AI — home">
            <Logo size="sm" />
          </Link>
        </div>

        <h1 className="mb-2 font-display text-4xl font-black text-navy">My sessions</h1>
        <p className="mb-10 text-slate-500">Your orals are saved on this device only.</p>

        {loading && <p className="text-sm text-slate-500">Loading…</p>}

        {!loading && sessions.length === 0 && (
          <Card className="text-center">
            <p className="mb-5 text-sm text-slate-600">You haven't done an oral yet.</p>
            <Link
              to="/practice"
              className="inline-flex rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Start
            </Link>
          </Card>
        )}

        {scored.length > 1 && (
          <Card className="mb-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-brand" aria-hidden="true" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-navy">
                  Progress
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Best <span className="font-bold text-navy">{best}/30</span> · Average{' '}
                <span className="font-bold text-navy">{average}/30</span>
              </p>
            </div>
            <div className="flex items-end gap-2" style={{ height: 140 }}>
              {scored
                .slice()
                .reverse()
                .map((s) => (
                  <div key={s.id} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span className="text-xs tabular-nums text-slate-500">{s.marks!.total}</span>
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${(s.marks!.total / 30) * 100}px`,
                        background: `linear-gradient(180deg, ${themeContent(s.theme).color}, ${themeContent(s.theme).color}66)`,
                      }}
                      title={`${s.marks!.total}/30 — ${new Date(s.createdAt).toLocaleDateString('en-GB')}`}
                    />
                  </div>
                ))}
            </div>
            <p className="mt-3 text-center text-xs text-slate-400">
              Oldest session to most recent
            </p>
          </Card>
        )}

        <div className="space-y-4">
          {sessions.map((s) => {
            const content = themeContent(s.theme);
            return (
              <div
                key={s.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-2xl p-6"
                style={{ border: '1px solid rgba(10,22,40,0.08)' }}
              >
                <div className="min-w-0 space-y-1.5">
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: content.color }}
                  >
                    {content.label} · {s.mode === 'exam' ? 'Exam' : 'Practice'}
                  </p>
                  <p className="text-sm font-medium text-navy">{s.stimulusCaption}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(s.createdAt).toLocaleString('en-GB')} · {s.status}
                  </p>
                  {s.marks && (
                    <p className="font-mono text-sm tabular-nums text-slate-600">
                      A {s.marks.A}/12 · B1 {s.marks.B1}/6 · B2 {s.marks.B2}/6 · C {s.marks.C}/6 ·{' '}
                      <strong className="text-navy">{s.marks.total}/30</strong>
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link
                    to={`/session/${s.id}/report`}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-navy transition-colors hover:bg-slate-50"
                  >
                    Report
                  </Link>
                  <Button variant="danger" onClick={() => remove(s.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {dialog}
    </div>
  );
}
