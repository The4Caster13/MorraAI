import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LogIn } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../state/authStore';
import { Button, ErrorNote, Logo } from '../../components/ui';

export function SignInPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [params] = useSearchParams();
  const next = params.get('next') || '/practice';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = await api.signIn({ email: email.trim(), password });
      setUser(user);
      navigate(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-sm">
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

        <h1 className="mb-2 font-display text-3xl font-black text-navy">Welcome back</h1>
        <p className="mb-8 text-sm text-slate-500">Sign in to continue where you left off.</p>

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
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-widest text-slate-400">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs font-medium text-brand hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-navy outline-none focus:border-brand"
            />
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}

          <Button type="submit" full disabled={busy}>
            <LogIn size={16} />
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don't have an account?{' '}
          <Link to={`/signup${next !== '/practice' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-brand hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
