import type { ReactNode } from 'react';
import { DISCLAIMER_FR, THEME_LABELS, type Theme } from '@parlons/shared';
import type { CaptionLine } from '../state/sessionStore';

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function Timer({ remainingMs, label }: { remainingMs: number | null; label: string }) {
  const text = remainingMs === null ? '—:—' : formatTime(remainingMs);
  const urgent = remainingMs !== null && remainingMs < 30000;
  return (
    <div className="flex flex-col items-end" role="timer" aria-live="polite">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span
        className={`font-mono text-3xl tabular-nums ${urgent ? 'text-red-600' : 'text-slate-800'}`}
      >
        {text}
      </span>
      <span className="sr-only">
        {remainingMs === null ? 'Minuteur non démarré' : `Temps restant : ${text}`}
      </span>
    </div>
  );
}

export function DisclaimerBanner() {
  return (
    <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {DISCLAIMER_FR}
    </p>
  );
}

export function AudioLevelMeter({ level }: { level: number }) {
  const pct = Math.min(100, Math.round(level * 300));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Niveau du microphone"
    >
      <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function RecordingIndicator({ active }: { active: boolean }) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium" aria-live="polite">
      <span
        className={`inline-block h-3 w-3 rounded-full ${active ? 'animate-pulse bg-red-600' : 'bg-slate-300'}`}
        aria-hidden="true"
      />
      {active ? 'Enregistrement en cours' : 'Micro inactif'}
    </p>
  );
}

export function CaptionStream({ lines }: { lines: CaptionLine[] }) {
  return (
    <div
      className="h-64 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-white p-4"
      aria-live="polite"
      aria-label="Transcription en direct"
    >
      {lines.length === 0 && <p className="text-sm text-slate-400">La transcription apparaîtra ici.</p>}
      {lines.map((line, i) => (
        <p key={i} className="text-sm">
          <span
            className={`font-semibold ${line.speaker === 'EXAMINER' ? 'text-indigo-700' : 'text-slate-700'}`}
          >
            {line.speaker === 'EXAMINER' ? 'Examinateur' : 'Vous'} :{' '}
          </span>
          <span className={line.isFinal ? 'text-slate-800' : 'text-slate-400 italic'}>
            {line.text}
          </span>
        </p>
      ))}
    </div>
  );
}

export function StimulusImageCard({
  imageUrl,
  captionFr,
  theme,
  culturalLinkFr,
  attribution,
  licenseName,
}: {
  imageUrl: string;
  captionFr: string;
  theme: Theme;
  culturalLinkFr: string;
  attribution: string;
  licenseName: string;
}) {
  return (
    <figure className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <img src={imageUrl} alt={captionFr} className="w-full max-w-full" />
      <figcaption className="space-y-2 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
          {THEME_LABELS[theme]}
        </p>
        <p className="text-base font-medium text-slate-900">{captionFr}</p>
        <p className="text-sm text-slate-600">{culturalLinkFr}</p>
        <p className="text-xs text-slate-400">
          {attribution} — {licenseName}
        </p>
      </figcaption>
    </figure>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  type?: 'button' | 'submit';
}) {
  const styles = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

export function PageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{title}</h1>
      {children}
    </main>
  );
}
