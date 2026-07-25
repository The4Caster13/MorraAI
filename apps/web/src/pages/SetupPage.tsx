import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { THEMES, THEME_LABELS, type SessionMode, type Theme } from '@parlons/shared';
import { api } from '../lib/api';
import { ensureUserId, getStoredDisplayName, saveProfile } from '../lib/profile';
import { Button, Card, DisclaimerBanner, PageShell } from '../components';

export function SetupPage() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(getStoredDisplayName() || 'Élève');
  const [mode, setMode] = useState<SessionMode>('exam');
  const [theme, setTheme] = useState<Theme | ''>('');
  const [prepMinutes, setPrepMinutes] = useState(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const userId = ensureUserId();
      await api.createUser(userId, displayName.trim() || 'Élève');
      saveProfile(userId, displayName.trim() || 'Élève');
      const session = await api.createSession({
        userId,
        mode,
        theme: theme || undefined,
        prepSeconds: mode === 'practice' ? prepMinutes * 60 : undefined,
      });
      navigate(`/session/${session.id}/consent`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de démarrer la session');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title="Parlons — Oral individuel de français B">
      <div className="space-y-6">
        <DisclaimerBanner />

        <Card className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700">
              Votre prénom
            </label>
            <input
              id="name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Mode</legend>
            <div className="mt-2 space-y-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'exam'}
                  onChange={() => setMode('exam')}
                  className="mt-1"
                />
                <span>
                  <strong>Mode examen</strong> — conditions réelles : 15 minutes de préparation,
                  stimulus imposé, questions uniquement à l'oral.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'practice'}
                  onChange={() => setMode('practice')}
                  className="mt-1"
                />
                <span>
                  <strong>Mode entraînement</strong> — préparation ajustable, choix du thème, texte
                  des questions affichable.
                </span>
              </label>
            </div>
          </fieldset>

          <div>
            <label htmlFor="theme" className="block text-sm font-medium text-slate-700">
              Thème {mode === 'exam' && <span className="text-slate-400">(imposé si non choisi)</span>}
            </label>
            <select
              id="theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme | '')}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <option value="">Aléatoire (comme à l'examen)</option>
              {THEMES.map((t) => (
                <option key={t} value={t}>
                  {THEME_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {mode === 'practice' && (
            <div>
              <label htmlFor="prep" className="block text-sm font-medium text-slate-700">
                Temps de préparation : {prepMinutes} min
              </label>
              <input
                id="prep"
                type="range"
                min={0}
                max={20}
                value={prepMinutes}
                onChange={(e) => setPrepMinutes(Number(e.target.value))}
                className="mt-1 w-full"
              />
            </div>
          )}

          {error && (
            <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={start} disabled={busy}>
              {busy ? 'Préparation…' : "Commencer l'oral"}
            </Button>
            <Link
              to="/history"
              className="text-sm text-indigo-700 underline focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Voir mes sessions passées
            </Link>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
