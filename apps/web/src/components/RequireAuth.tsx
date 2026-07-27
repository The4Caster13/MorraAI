import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../state/authStore';

/**
 * Gates a route behind a *real* account, redirecting to /signin otherwise.
 *
 * A guest (someone trying a mock interview with no account — see
 * ensureIdentity.ts on the server) still has a working session and shows up
 * as `status === 'authenticated'`, but `user.email` is null for them. This
 * only guards pages that are genuinely account-only, like history — the exam
 * flow itself is deliberately left unguarded so a guest can go straight in.
 */
export function RequireAuth() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (status === 'loading') {
    // Avoids a flash-redirect to /signin before GET /api/auth/me resolves.
    return <div className="min-h-screen bg-white" />;
  }

  if (!user?.email) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/signin?next=${next}`} replace />;
  }

  return <Outlet />;
}
