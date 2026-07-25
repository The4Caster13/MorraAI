import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Brain } from 'lucide-react';
import { DISCLAIMER_FR } from '@parlons/shared';

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function Logo({ size = 'md', dark = false }: { size?: 'sm' | 'md'; dark?: boolean }) {
  const box = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const icon = size === 'sm' ? 13 : 15;
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`${box} flex items-center justify-center rounded-lg`}
        style={{ background: dark ? '#1b4fd8' : '#0a1628' }}
      >
        <Brain size={icon} className="text-white" aria-hidden="true" />
      </span>
      <span
        className={`font-display font-bold tracking-tight ${size === 'sm' ? 'text-sm' : 'text-lg'}`}
        style={{ color: dark ? '#fff' : '#0a1628' }}
      >
        Morra AI
      </span>
    </span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-bold uppercase tracking-widest text-brand">{children}</span>
  );
}

export function PageHeading({
  label,
  title,
  intro,
  centered = false,
}: {
  label: string;
  title: string;
  intro?: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? 'text-center' : ''}>
      <SectionLabel>{label}</SectionLabel>
      <h1 className="mt-3 font-display text-4xl font-black leading-tight text-navy md:text-5xl">
        {title}
      </h1>
      {intro && (
        <p
          className={`mt-4 leading-relaxed text-slate-500 ${centered ? 'mx-auto max-w-xl' : 'max-w-2xl'}`}
        >
          {intro}
        </p>
      )}
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  type = 'button',
  full = false,
  accent,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'accent' | 'ghost-dark';
  type?: 'button' | 'submit';
  full?: boolean;
  accent?: string;
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50';
  const styles: Record<string, string> = {
    primary: 'bg-navy text-white hover:opacity-90',
    accent: 'text-white hover:opacity-90',
    secondary: 'border border-slate-300 bg-white text-navy hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    'ghost-dark':
      'border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles[variant]} ${full ? 'w-full' : ''}`}
      style={variant === 'accent' ? { background: accent ?? '#1b4fd8' } : undefined}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  to,
  children,
  variant = 'primary',
}: {
  to: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'accent';
}) {
  const styles: Record<string, string> = {
    primary: 'bg-navy text-white hover:opacity-90',
    accent: 'bg-brand text-white hover:opacity-90',
    secondary: 'border border-slate-300 bg-white text-navy hover:bg-slate-50',
  };
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all ${styles[variant]}`}
    >
      {children}
    </Link>
  );
}

export function Card({
  children,
  className = '',
  dark = false,
}: {
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return dark ? (
    <div
      className={`rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 ${className}`}
    >
      {children}
    </div>
  ) : (
    <div
      className={`rounded-2xl border p-6 ${className}`}
      style={{ borderColor: 'rgba(10,22,40,0.08)', background: '#fff' }}
    >
      {children}
    </div>
  );
}

export function DisclaimerBanner({ dark = false }: { dark?: boolean }) {
  return dark ? (
    <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-200">
      {DISCLAIMER_FR}
    </p>
  ) : (
    <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
      {DISCLAIMER_FR}
    </p>
  );
}

/** Splits text into per-character spans so GSAP can stagger them. */
export function SplitText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {text.split('').map((char, i) => (
        <span key={i} className="char">
          {char === ' ' ? ' ' : char}
        </span>
      ))}
    </span>
  );
}

export function Divider() {
  return <div className="h-px w-full" style={{ background: 'rgba(10,22,40,0.07)' }} />;
}

export function ErrorNote({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p
      role="alert"
      className={
        dark
          ? 'rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300'
          : 'rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800'
      }
    >
      {children}
    </p>
  );
}
