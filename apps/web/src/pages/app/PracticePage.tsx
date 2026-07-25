import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Play, Shuffle } from 'lucide-react';
import type { SessionMode, Theme } from '@parlons/shared';
import { api } from '../../lib/api';
import { ensureUserId, getStoredDisplayName, saveProfile } from '../../lib/profile';
import { THEME_CONTENT } from '../../lib/themeContent';
import { useEntranceAnimation } from '../../hooks/useAnimations';
import { gsap } from 'gsap';
import { Button, ErrorNote, Logo } from '../../components/ui';

const MODES: Array<{ id: SessionMode; label: string; blurb: string }> = [
  {
    id: 'exam',
    label: 'Mode examen',
    blurb: "Conditions réelles : 15 min de préparation, stimulus imposé, questions à l'oral seulement.",
  },
  {
    id: 'practice',
    label: 'Mode entraînement',
    blurb: 'Préparation ajustable, choix du thème, texte des questions affichable.',
  },
];

export function PracticePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetTheme = params.get('theme') as Theme | null;

  const [displayName, setDisplayName] = useState(getStoredDisplayName() || 'Élève');
  const [mode, setMode] = useState<SessionMode>(presetTheme ? 'practice' : 'exam');
  const [theme, setTheme] = useState<Theme | null>(presetTheme);
  const [prepMinutes, setPrepMinutes] = useState(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ref = useEntranceAnimation<HTMLDivElement>(() => {
    gsap.from('.theme-card', {
      opacity: 0,
      y: 50,
      scale: 0.95,
      stagger: 0.07,
      duration: 0.6,
      ease: 'power3.out',
    });
  });

  // In exam mode the examiner picks the stimulus, mirroring the real exam.
  const themeIsChoosable = mode === 'practice';
  const effectiveTheme = themeIsChoosable ? theme : null;
  const accent = effectiveTheme
    ? THEME_CONTENT.find((t) => t.id === effectiveTheme)!.color
    : '#1b4fd8';

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const userId = ensureUserId();
      const name = displayName.trim() || 'Élève';
      await api.createUser(userId, name);
      saveProfile(userId, name);
      const session = await api.createSession({
        userId,
        mode,
        theme: effectiveTheme ?? undefined,
        prepSeconds: mode === 'practice' ? prepMinutes * 60 : undefined,
      });
      navigate(`/session/${session.id}/consent`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de démarrer la session');
      setBusy(false);
    }
  };

  return (
    <div className="on-dark min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div ref={ref} className="mx-auto max-w-5xl">
        <div className="mb-10 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft size={16} /> Retour au site
          </Link>
          <Logo size="sm" dark />
        </div>

        <h1 className="mb-2 font-display text-4xl font-black text-white">
          Configurez votre oral
        </h1>
        <p className="mb-10 text-slate-400">
          Choisissez votre mode. L'examinateur adapte automatiquement la difficulté à votre
          niveau pendant la session.
        </p>

        <label htmlFor="name" className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400">
          Votre prénom
        </label>
        <input
          id="name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mb-10 w-full max-w-xs rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-brand"
        />

        <fieldset className="mb-10">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Mode
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODES.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  aria-pressed={active}
                  className="rounded-2xl p-5 text-left transition-all"
                  style={
                    active
                      ? {
                          background: 'rgba(27,79,216,0.18)',
                          border: '1px solid rgba(27,79,216,0.5)',
                          boxShadow: '0 8px 32px rgba(27,79,216,0.2)',
                        }
                      : {
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                        }
                  }
                >
                  <span className="mb-1 flex items-center gap-2">
                    <span className="font-bold text-white">{m.label}</span>
                    {active && <CheckCircle size={14} className="text-brand-bright" />}
                  </span>
                  <span className="block text-xs leading-relaxed text-slate-400">{m.blurb}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {mode === 'practice' && (
          <div className="mb-10 max-w-md">
            <label
              htmlFor="prep"
              className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400"
            >
              Temps de préparation : {prepMinutes} min
            </label>
            <input
              id="prep"
              type="range"
              min={0}
              max={20}
              value={prepMinutes}
              onChange={(e) => setPrepMinutes(Number(e.target.value))}
              className="w-full accent-brand"
            />
            <p className="mt-1 text-xs text-slate-500">Le véritable examen accorde 15 minutes.</p>
          </div>
        )}

        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Thème</h2>
          {!themeIsChoosable && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Shuffle size={12} /> Imposé en mode examen
            </span>
          )}
        </div>

        <div
          className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 ${
            themeIsChoosable ? '' : 'pointer-events-none opacity-40'
          }`}
          aria-disabled={!themeIsChoosable}
        >
          {THEME_CONTENT.map((t) => {
            const Icon = t.icon;
            const active = effectiveTheme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(active ? null : t.id)}
                aria-pressed={active}
                tabIndex={themeIsChoosable ? 0 : -1}
                className="theme-card rounded-2xl p-6 text-left transition-all duration-300 hover:scale-[1.02]"
                style={
                  active
                    ? {
                        background: `${t.color}18`,
                        border: `1px solid ${t.color}50`,
                        boxShadow: `0 8px 32px ${t.color}20`,
                      }
                    : {
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }
                }
              >
                <span
                  className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ background: `${t.color}22` }}
                >
                  <Icon size={22} style={{ color: t.color }} aria-hidden="true" />
                </span>
                <span className="mb-1 block text-lg font-bold text-white">{t.label}</span>
                <span className="mb-3 block text-xs font-medium" style={{ color: t.color }}>
                  {t.subtitle}
                </span>
                <span className="block text-sm leading-relaxed text-slate-400">
                  {t.description}
                </span>
                {active && (
                  <span className="mt-4 flex items-center gap-1.5 text-xs" style={{ color: t.color }}>
                    <CheckCircle size={13} /> Sélectionné
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mt-8">
            <ErrorNote dark>{error}</ErrorNote>
          </div>
        )}

        <div className="mt-10 flex flex-col items-center gap-3">
          <Button onClick={start} disabled={busy} variant="accent" accent={accent}>
            <Play size={18} />
            {busy
              ? 'Préparation…'
              : effectiveTheme
                ? `Démarrer — ${THEME_CONTENT.find((t) => t.id === effectiveTheme)!.label}`
                : "Démarrer l'oral"}
          </Button>
          <p className="text-xs text-slate-500">
            {effectiveTheme
              ? 'Un stimulus de ce thème sera tiré au sort.'
              : 'Un thème et un stimulus seront tirés au sort, comme à l’examen.'}
          </p>
        </div>
      </div>
    </div>
  );
}
