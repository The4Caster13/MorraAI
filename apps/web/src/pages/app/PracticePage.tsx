import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Play, Shuffle } from 'lucide-react';
import {
  PART1_SECONDS_CAP,
  PREP_MINUTES_MAX,
  PREP_SECONDS_DEFAULT,
  QUESTIONING_SECONDS_TOTAL,
  type SessionMode,
  type Theme,
} from '@morrai/shared';
import { api } from '../../lib/api';
import { ensureUserId, getStoredDisplayName, saveProfile } from '../../lib/profile';
import { clearAccessCode, isAccessCodeError, saveAccessCode } from '../../lib/accessCode';
import { THEME_CONTENT } from '../../lib/themeContent';
import { useEntranceAnimation } from '../../hooks/useAnimations';
import { gsap } from 'gsap';
import { Button, ErrorNote, Logo } from '../../components/ui';

const MODES: Array<{ id: SessionMode; label: string; blurb: string }> = [
  {
    id: 'exam',
    label: 'Exam Mode',
    blurb: `You have ${PREP_SECONDS_DEFAULT / 60} minutes of preparation with a randomly chosen photo to prepare a ${PART1_SECONDS_CAP / 60} minute presentation, followed by ${QUESTIONING_SECONDS_TOTAL / 60} minutes of questioning. You are only allowed to make 10 point notes.`,
  },
  {
    id: 'practice',
    label: 'Practice Mode',
    blurb: 'Adjustable preparation, theme selection, displayable question text.',
  },
];

export function PracticePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetTheme = params.get('theme') as Theme | null;

  const [displayName, setDisplayName] = useState(getStoredDisplayName() || 'Student');
  const [mode, setMode] = useState<SessionMode>(presetTheme ? 'practice' : 'exam');
  const [theme, setTheme] = useState<Theme | null>(presetTheme);
  const [prepMinutes, setPrepMinutes] = useState(PREP_SECONDS_DEFAULT / 60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsCode, setNeedsCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');

  const ref = useEntranceAnimation<HTMLDivElement>(() => {
    // fromTo + clearProps rather than gsap.from: `from` leaves the cards at
    // opacity 0 until the tween finishes, so anything that interrupts it — a
    // background tab pausing rAF, a reverted context — leaves them permanently
    // invisible. clearProps strips the inline styles once it lands, so the
    // cards' visibility never depends on an animation having completed.
    gsap.fromTo(
      '.theme-card',
      { opacity: 0, y: 50, scale: 0.95 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        stagger: 0.07,
        duration: 0.6,
        ease: 'power3.out',
        clearProps: 'all',
      },
    );
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
      const name = displayName.trim() || 'Student';
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
      if (isAccessCodeError(err)) {
        // A saved code that's now wrong would fail silently forever otherwise.
        clearAccessCode();
        setNeedsCode(true);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Could not start the session');
      }
      setBusy(false);
    }
  };

  const submitAccessCode = async () => {
    if (!codeInput.trim()) return;
    saveAccessCode(codeInput);
    setNeedsCode(false);
    setCodeInput('');
    await start();
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div ref={ref} className="mx-auto max-w-5xl">
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

        <h1 className="mb-2 font-display text-4xl font-black text-navy">Set up your oral</h1>
        <p className="mb-10 text-slate-500">
          Choose your mode. The examiner adapts the difficulty to your level automatically as
          the session goes on.
        </p>

        <label htmlFor="name" className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400">
          Your first name
        </label>
        <input
          id="name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mb-10 w-full max-w-xs rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-navy outline-none focus:border-brand"
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
                          background: 'rgba(27,79,216,0.08)',
                          border: '1px solid rgba(27,79,216,0.4)',
                          boxShadow: '0 8px 32px rgba(27,79,216,0.12)',
                        }
                      : {
                          background: '#fff',
                          border: '1px solid rgba(10,22,40,0.08)',
                        }
                  }
                >
                  <span className="mb-1 flex items-center gap-2">
                    <span className="font-bold text-navy">{m.label}</span>
                    {active && <CheckCircle size={14} className="text-brand" />}
                  </span>
                  <span className="block text-xs leading-relaxed text-slate-500">{m.blurb}</span>
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
              Preparation Time : {prepMinutes} min
            </label>
            <input
              id="prep"
              type="range"
              min={0}
              max={PREP_MINUTES_MAX}
              value={prepMinutes}
              onChange={(e) => setPrepMinutes(Number(e.target.value))}
              className="w-full accent-brand"
            />
            <p className="mt-1 text-xs text-slate-400">
              The real exam gives you {PREP_SECONDS_DEFAULT / 60} minutes to prepare, then a{' '}
              {PART1_SECONDS_CAP / 60} minute presentation and{' '}
              {QUESTIONING_SECONDS_TOTAL / 60} minutes of questioning.
            </p>
          </div>
        )}

        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Theme</h2>
          {!themeIsChoosable && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <Shuffle size={12} /> Chosen for you in exam mode
            </span>
          )}
        </div>

        <div
          className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 ${
            themeIsChoosable ? '' : 'pointer-events-none opacity-40'
          }`}
          aria-disabled={!themeIsChoosable}
        >
          {/*
            Random is a real choice, not the absence of one. Without a card for
            it the only way to get a random stimulus is to click a selected
            theme to deselect it, which nothing on screen suggests.
          */}
          <button
            onClick={() => setTheme(null)}
            aria-pressed={themeIsChoosable && theme === null}
            tabIndex={themeIsChoosable ? 0 : -1}
            className="theme-card rounded-2xl p-6 text-left transition-all duration-300 hover:scale-[1.02]"
            style={
              themeIsChoosable && theme === null
                ? {
                    background: '#1b4fd80f',
                    border: '1px solid #1b4fd840',
                    boxShadow: '0 8px 32px #1b4fd815',
                  }
                : {
                    background: '#fff',
                    border: '1px solid rgba(10,22,40,0.08)',
                  }
            }
          >
            <span
              className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: '#1b4fd818' }}
            >
              <Shuffle size={22} style={{ color: '#1b4fd8' }} aria-hidden="true" />
            </span>
            <span className="mb-1 block text-lg font-bold text-navy">Random</span>
            <span className="mb-3 block text-xs font-medium" style={{ color: '#1b4fd8' }}>
              Just like the exam
            </span>
            <span className="block text-sm leading-relaxed text-slate-500">
              The examiner picks the theme and the stimulus for you, with no warning.
            </span>
            {themeIsChoosable && theme === null && (
              <span className="mt-4 flex items-center gap-1.5 text-xs" style={{ color: '#1b4fd8' }}>
                <CheckCircle size={13} /> Selected
              </span>
            )}
          </button>

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
                        background: `${t.color}0f`,
                        border: `1px solid ${t.color}40`,
                        boxShadow: `0 8px 32px ${t.color}15`,
                      }
                    : {
                        background: '#fff',
                        border: '1px solid rgba(10,22,40,0.08)',
                      }
                }
              >
                <span
                  className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ background: `${t.color}18` }}
                >
                  <Icon size={22} style={{ color: t.color }} aria-hidden="true" />
                </span>
                <span className="mb-1 block text-lg font-bold text-navy">{t.label}</span>
                <span className="mb-3 block text-xs font-medium" style={{ color: t.color }}>
                  {t.subtitle}
                </span>
                <span className="block text-sm leading-relaxed text-slate-500">
                  {t.description}
                </span>
                {active && (
                  <span className="mt-4 flex items-center gap-1.5 text-xs" style={{ color: t.color }}>
                    <CheckCircle size={13} /> Selected
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {needsCode && (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="mb-1 font-display text-lg font-bold text-slate-900">
              Access code required
            </h2>
            <p className="mb-4 text-sm text-slate-600">
              This app is invite-only while it's in testing. Enter the code you were given.
            </p>
            <form
              className="flex flex-wrap gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void submitAccessCode();
              }}
            >
              <input
                type="password"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Access code"
                aria-label="Access code"
                autoFocus
                className="min-w-56 flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-brand"
              />
              <Button type="submit" disabled={!codeInput.trim()}>
                Continue
              </Button>
            </form>
          </div>
        )}

        {error && (
          <div className="mt-8">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        <div className="mt-10 flex flex-col items-center gap-3">
          <Button onClick={start} disabled={busy} variant="accent" accent={accent}>
            <Play size={18} />
            {busy
              ? 'Starting…'
              : effectiveTheme
                ? `Start — ${THEME_CONTENT.find((t) => t.id === effectiveTheme)!.label}`
                : 'Start the oral'}
          </Button>
          <p className="text-xs text-slate-400">
            {effectiveTheme
              ? 'A stimulus from this theme will be drawn at random.'
              : 'A theme and stimulus will be drawn at random, just like the exam.'}
          </p>
        </div>
      </div>
    </div>
  );
}
