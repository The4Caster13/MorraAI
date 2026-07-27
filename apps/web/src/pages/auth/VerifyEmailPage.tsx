import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../state/authStore';
import { LinkButton, Logo } from '../../components/ui';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const load = useAuthStore((s) => s.load);
  const [state, setState] = useState<'checking' | 'ok' | 'error'>('checking');

  useEffect(() => {
    if (!token) {
      setState('error');
      return;
    }
    api
      .verifyEmail({ token })
      .then(() => {
        setState('ok');
        void load(); // refreshes the emailVerified flag so the banner clears
      })
      .catch(() => setState('error'));
  }, [token, load]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-10 text-center">
      <Link to="/" aria-label="Morra AI — home" className="mb-10">
        <Logo size="sm" />
      </Link>

      {state === 'checking' && <p className="text-sm text-slate-500">Verifying your email…</p>}

      {state === 'ok' && (
        <>
          <CheckCircle size={40} className="mb-4 text-emerald-500" />
          <h1 className="mb-2 font-display text-2xl font-black text-navy">Email verified</h1>
          <p className="mb-8 max-w-sm text-sm text-slate-500">Your email is confirmed. You're all set.</p>
          <LinkButton to="/practice">Continue</LinkButton>
        </>
      )}

      {state === 'error' && (
        <>
          <XCircle size={40} className="mb-4 text-red-500" />
          <h1 className="mb-2 font-display text-2xl font-black text-navy">Link invalid or expired</h1>
          <p className="mb-8 max-w-sm text-sm text-slate-500">
            This verification link no longer works. You can request a new one from your account once signed in.
          </p>
          <LinkButton to="/practice">Continue</LinkButton>
        </>
      )}
    </div>
  );
}
