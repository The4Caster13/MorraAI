import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../state/authStore';
import { Button, ErrorNote, Logo } from '../../components/ui';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = await api.resetPassword({ token, newPassword });
      setUser(user);
      navigate('/practice');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset your password');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-sm">
        <div className="mb-10 flex items-center justify-between">
          <Link to="/" aria-label="Morra AI — home">
            <Logo size="sm" />
          </Link>
        </div>

        <h1 className="mb-2 font-display text-3xl font-black text-navy">Choose a new password</h1>

        {!token ? (
          <ErrorNote>
            This link is missing its reset token. Request a new one from the{' '}
            <Link to="/forgot-password" className="underline">
              forgot password
            </Link>{' '}
            page.
          </ErrorNote>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <div>
              <label htmlFor="newPassword" className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-navy outline-none focus:border-brand"
              />
              <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>
            </div>

            {error && <ErrorNote>{error}</ErrorNote>}

            <Button type="submit" full disabled={busy}>
              <KeyRound size={16} />
              {busy ? 'Saving…' : 'Save new password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
