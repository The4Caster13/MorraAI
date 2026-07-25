import { forwardRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Brain } from 'lucide-react';
import { DISCLAIMER_EN } from '@morrai/shared';

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const icon = size === 'sm' ? 13 : 15;
  return (
    <span className="flex items-center gap-2.5">
      <span className={`${box} flex items-center justify-center rounded-lg bg-navy`}>
        <Brain size={icon} className="text-white" aria-hidden="true" />
      </span>
      <span
        className={`font-display font-bold tracking-tight text-navy ${size === 'sm' ? 'text-sm' : 'text-lg'}`}
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

export const Button = forwardRef<
  HTMLButtonElement,
  {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'danger' | 'accent';
    type?: 'button' | 'submit';
    full?: boolean;
    accent?: string;
  }
>(function Button(
  { children, onClick, disabled, variant = 'primary', type = 'button', full = false, accent },
  ref,
) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50';
  const styles: Record<string, string> = {
    primary: 'bg-navy text-white hover:opacity-90',
    accent: 'text-white hover:opacity-90',
    secondary: 'border border-slate-300 bg-white text-navy hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles[variant]} ${full ? 'w-full' : ''}`}
      style={variant === 'accent' ? { background: accent ?? '#1b4fd8' } : undefined}
    >
      {children}
    </button>
  );
});

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

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border p-6 ${className}`}
      style={{ borderColor: 'rgba(10,22,40,0.08)', background: '#fff' }}
    >
      {children}
    </div>
  );
}

export function DisclaimerBanner() {
  return (
    <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
      {DISCLAIMER_EN}
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

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
      {children}
    </p>
  );
}
