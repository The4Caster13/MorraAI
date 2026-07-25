import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import type { SessionSummaryDto } from '@morrai/shared';
import { api } from '../../lib/api';
import { getStoredUserId } from '../../lib/profile';
import { themeContent } from '../../lib/themeContent';
import { Button, Logo } from '../../components/ui';

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
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [userId]);

  const remove = async (id: string) => {
    if (!userId) return;
    if (!confirm('Permanently delete this session?')) return;
    await api.deleteSession(id, userId);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const scored = sessions.filter((s) => s.marks);
  const best = scored.length ? Math.max(...scored.map((s) => s.marks!.total)) : null;
  const average = scored.length
    ? Math.round(scored.reduce((sum, s) => sum + s.marks!.total, 0) / scored.length)
    : null;

  return (
    <div className="on-dark min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft size={16} /> Back to site
          </Link>
          <Logo size="sm" dark />
        </div>

        <h1 className="mb-2 font-display text-4xl font-black text-white">Mes sessions</h1>
        <p className="mb-10 text-slate-400">
          Your orals are saved on this device only.
        </p>

        {loading && <p className="text-sm text-slate-400">Loading…</p>}

        {!loading && sessions.length === 0 && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-8 text-center">
            <p className="mb-5 text-sm text-slate-300">You haven't done an oral yet.</p>
            <Link
              to="/practice"
              className="inline-flex rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Commencer
            </Link>
          </div>
        )}

        {scored.length > 1 && (
          <div className="mb-8 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-7">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-brand-bright" aria-hidden="true" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-white">
                  Progression
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Meilleur <span className="font-bold text-white">{best}/30</span> · Moyenne{' '}
                <span className="font-bold text-white">{average}/30</span>
              </p>
            </div>
            <div className="flex items-end gap-2" style={{ height: 140 }}>
              {scored
                .slice()
                .reverse()
                .map((s) => (
                  <div key={s.id} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span className="text-xs tabular-nums text-slate-400">{s.marks!.total}</span>
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${(s.marks!.total / 30) * 100}px`,
                        background: `linear-gradient(180deg, ${themeContent(s.theme).color}, ${themeContent(s.theme).color}66)`,
                      }}
                      title={`${s.marks!.total}/30 — ${new Date(s.createdAt).toLocaleDateString('fr-FR')}`}
                    />
                  </div>
                ))}
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">
              Oldest session to most recent
            </p>
          </div>
        )}

        <div className="space-y-4">
          {sessions.map((s) => {
            const content = themeContent(s.theme);
            return (
              <div
                key={s.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6"
              >
                <div className="min-w-0 space-y-1.5">
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: content.color }}
                  >
                    {content.label} · {s.mode === 'exam' ? 'Exam' : 'Practice'}
                  </p>
                  <p className="text-sm font-medium text-white">{s.stimulusCaption}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(s.createdAt).toLocaleString('fr-FR')} · {s.status}
                  </p>
                  {s.marks && (
                    <p className="font-mono text-sm tabular-nums text-slate-300">
                      A {s.marks.A}/12 · B1 {s.marks.B1}/6 · B2 {s.marks.B2}/6 · C {s.marks.C}/6 ·{' '}
                      <strong className="text-white">{s.marks.total}/30</strong>
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link
                    to={`/session/${s.id}/report`}
                    className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-white/10"
                  >
                    Rapport
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
    </div>
  );
}
