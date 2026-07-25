import { Clock, MicOff } from 'lucide-react';
import { MAX_NOTEPAD_BULLETS } from '@parlons/shared';
import type { CaptionLine, Competence } from '../state/sessionStore';
import { formatTime } from './ui';

export function ExamHeader({
  themeLabel,
  accent,
  modeLabel,
  remainingMs,
  recording,
  phaseTitle,
}: {
  themeLabel: string;
  accent: string;
  modeLabel: string;
  remainingMs: number | null;
  recording: boolean;
  phaseTitle: string;
}) {
  const urgent = remainingMs !== null && remainingMs <= 30000;
  return (
    <header
      className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-3">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: accent }}
          aria-hidden="true"
        />
        <span className="text-sm font-semibold text-white">{themeLabel}</span>
        <span
          className="rounded-full px-2 py-0.5 text-xs"
          style={{ background: `${accent}22`, color: accent }}
        >
          {modeLabel}
        </span>
        <span className="hidden text-xs text-slate-500 sm:inline">· {phaseTitle}</span>
      </div>

      <div className="flex items-center gap-4 text-sm text-slate-400">
        {recording && (
          <span className="flex items-center gap-2">
            <span
              className="animate-pulse-dot h-2 w-2 rounded-full bg-red-500"
              style={{ boxShadow: '0 0 8px #ef4444' }}
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-red-400">RECORDING</span>
          </span>
        )}
        <span className="flex items-center gap-1.5" role="timer" aria-live="off">
          <Clock size={13} aria-hidden="true" />
          <span
            className={`font-mono tabular-nums ${urgent ? 'text-red-400' : 'text-slate-200'}`}
          >
            {remainingMs === null ? '--:--' : formatTime(remainingMs)}
          </span>
        </span>
      </div>
    </header>
  );
}

export function RecordingWave({ active }: { active: boolean }) {
  if (!active) {
    return <MicOff size={32} className="text-slate-600" aria-hidden="true" />;
  }
  return (
    <div className="recording-wave flex items-end gap-0" style={{ height: 32 }} aria-hidden="true">
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}

export function AudioMeter({ level }: { level: number }) {
  const pct = Math.min(100, Math.round(level * 300));
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Microphone level"
    >
      <div
        className="h-full rounded-full transition-[width] duration-150"
        style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#3b82f6,#22c55e)' }}
      />
    </div>
  );
}

/**
 * Live view of what the examiner has measured and how it is adapting.
 *
 * The adaptive loop is otherwise invisible: the questions simply get harder or
 * easier, which is impossible to attribute while you are busy answering them.
 * Showing the signals makes the behaviour legible.
 *
 * The level arrives from the server in French — it is also fed verbatim into
 * the examiner's prompt — so it is mapped to English for display here rather
 * than changed at the source.
 */
const LEVEL_DISPLAY: Record<
  Competence['level'],
  { label: string; pitch: string; color: string }
> = {
  fragile: {
    label: 'Building',
    pitch: 'short, concrete questions in the present tense',
    color: '#f59e0b',
  },
  intermédiaire: {
    label: 'Intermediate',
    pitch: 'open questions that invite you to develop your ideas',
    color: '#3b82f6',
  },
  fort: {
    label: 'Strong',
    pitch: 'abstract and hypothetical questions (conditional, subjunctive)',
    color: '#22c55e',
  },
};

export function AdaptationPanel({ competence }: { competence: Competence | null }) {
  const level = competence?.level ?? 'intermédiaire';
  const { label, pitch, color } = LEVEL_DISPLAY[level];

  return (
    <section
      className="rounded-xl px-4 py-3"
      style={{ background: `${color}12`, border: `1px solid ${color}33` }}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color }}>
          Level detected: {label}
        </h2>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-400">Examiner is asking {pitch}.</p>
      {competence && (
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums text-slate-300">
          <div>
            <dt className="inline text-slate-500">pace </dt>
            <dd className="inline font-semibold">
              {competence.wordsPerMinute === null ? '—' : `${competence.wordsPerMinute} wpm`}
            </dd>
          </div>
          <div>
            <dt className="inline text-slate-500">pauses </dt>
            <dd className="inline font-semibold">{competence.pauseCount}</dd>
          </div>
          <div>
            <dt className="inline text-slate-500">fillers </dt>
            <dd className="inline font-semibold">{competence.fillerRate}/100w</dd>
          </div>
          <div>
            <dt className="inline text-slate-500">tenses </dt>
            <dd className="inline font-semibold">{competence.tenseVariety}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

export function DarkCaptionStream({ lines }: { lines: CaptionLine[] }) {
  return (
    <div
      className="min-h-[8rem] flex-1 space-y-2.5 overflow-y-auto rounded-xl p-4"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
      aria-live="polite"
      aria-label="Live transcript"
    >
      {lines.length === 0 && (
        <p className="text-xs text-slate-500">The transcript will appear here.</p>
      )}
      {lines.map((line, i) => (
        <p key={i} className="text-sm leading-relaxed">
          <span
            className={`font-semibold ${
              line.speaker === 'EXAMINER' ? 'text-brand-bright' : 'text-slate-200'
            }`}
          >
            {line.speaker === 'EXAMINER' ? 'Examiner' : 'You'}:{' '}
          </span>
          <span className={line.isFinal ? 'text-slate-300' : 'italic text-slate-500'}>
            {line.text}
          </span>
        </p>
      ))}
    </div>
  );
}

export function DarkNotepad({
  bullets,
  onChange,
  accent,
}: {
  bullets: string[];
  onChange: (next: string[]) => void;
  accent: string;
}) {
  const update = (i: number, value: string) => {
    const next = [...bullets];
    next[i] = value;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-white">Your notes</h2>
        <span className="text-xs text-slate-500">
          {bullets.length}/{MAX_NOTEPAD_BULLETS} points
        </span>
      </div>

      <ul className="space-y-2">
        {bullets.map((bullet, i) => (
          <li key={i} className="flex items-center gap-2">
            <span style={{ color: accent }} aria-hidden="true">
              •
            </span>
            <input
              type="text"
              value={bullet}
              onChange={(e) => update(i, e.target.value)}
              aria-label={`Point ${i + 1}`}
              maxLength={300}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={() => onChange(bullets.filter((_, idx) => idx !== i))}
              aria-label={`Delete point ${i + 1}`}
              className="rounded px-2 py-1 text-sm text-slate-500 hover:text-red-400"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onChange([...bullets, ''])}
        disabled={bullets.length >= MAX_NOTEPAD_BULLETS}
        className="w-full rounded-lg border border-dashed border-white/15 px-3 py-2 text-sm text-slate-400 transition-colors hover:border-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        + Ajouter un point
      </button>

      {bullets.length >= MAX_NOTEPAD_BULLETS && (
        <p className="text-xs text-amber-300">
          {MAX_NOTEPAD_BULLETS}-point limit reached, exactly as in the real exam.
        </p>
      )}
    </div>
  );
}

export function PrepTips({ accent }: { accent: string }) {
  const tips = [
    'Describe what you can see',
    'Link it to the theme',
    'Connect it to francophone culture',
    'Give your own opinion',
  ];
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'rgba(27,79,216,0.1)', border: '1px solid rgba(27,79,216,0.2)' }}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-bright">
        Conseils
      </p>
      <ul className="space-y-1.5">
        {tips.map((tip) => (
          <li key={tip} className="flex items-start gap-2">
            <span style={{ color: accent }} aria-hidden="true">
              •
            </span>
            <span className="text-xs text-slate-300">{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
