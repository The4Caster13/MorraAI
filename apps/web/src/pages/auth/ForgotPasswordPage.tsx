import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { api } from '../../lib/api';
import { Button, Logo } from '../../components/ui';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    // The server always answers 202 regardless of whether the email exists,
    // so there is nothing to branch on here — showing the same message either
    // way is the point, not an oversight.
    await api.requestPasswordReset({ email: email.trim() }).catch(() => {});
    setSent(true);
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-sm">
        <div className="mb-10 flex items-center justify-between">
          <Link
            to="/signin"
            className="flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-navy"
          >
            <ArrowLeft size={16} /> Back to sign in
          </Link>
          <Link to="/" aria-label="Morra AI — home">
            <Logo size="sm" />
          </Link>
        </div>

        <h1 className="mb-2 font-display text-3xl font-black text-navy">Reset your password</h1>

        {sent ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
            If an account exists for <strong>{email.trim()}</strong>, we've sent a link to reset your password.
          </p>
        ) : (
          <>
            <p className="mb-8 text-sm text-slate-500">
              Enter the email on your account and we'll send you a reset link.
            </p>
            <form className="flex flex-col gap-4" onSubmit={submit}>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-navy outline-none focus:border-brand"
                />
              </div>
              <Button type="submit" full disabled={busy}>
                <Mail size={16} />
                {busy ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
