import { Clock, MicOff } from 'lucide-react';
import { MAX_NOTEPAD_BULLETS } from '@parlons/shared';
import type { CaptionLine } from '../state/sessionStore';
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
            <span className="text-xs font-medium text-red-400">EN COURS</span>
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
      aria-label="Niveau du microphone"
    >
      <div
        className="h-full rounded-full transition-[width] duration-150"
        style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#3b82f6,#22c55e)' }}
      />
    </div>
  );
}

export function DarkCaptionStream({ lines }: { lines: CaptionLine[] }) {
  return (
    <div
      className="min-h-[8rem] flex-1 space-y-2.5 overflow-y-auto rounded-xl p-4"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
      aria-live="polite"
      aria-label="Transcription en direct"
    >
      {lines.length === 0 && (
        <p className="text-xs text-slate-500">La transcription apparaîtra ici.</p>
      )}
      {lines.map((line, i) => (
        <p key={i} className="text-sm leading-relaxed">
          <span
            className={`font-semibold ${
              line.speaker === 'EXAMINER' ? 'text-brand-bright' : 'text-slate-200'
            }`}
          >
            {line.speaker === 'EXAMINER' ? 'Examinateur' : 'Vous'} :{' '}
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
        <h2 className="text-sm font-bold text-white">Vos notes</h2>
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
              aria-label={`Supprimer le point ${i + 1}`}
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
          Limite de {MAX_NOTEPAD_BULLETS} points atteinte, comme lors du véritable examen.
        </p>
      )}
    </div>
  );
}

export function PrepTips({ accent }: { accent: string }) {
  const tips = [
    'Décrivez ce que vous voyez',
    'Faites un lien avec le thème',
    'Reliez à la culture francophone',
    'Donnez votre opinion',
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
