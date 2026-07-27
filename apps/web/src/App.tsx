import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MarketingLayout } from './components/MarketingLayout';
import { LandingPage } from './pages/marketing/LandingPage';
import { PracticePage } from './pages/app/PracticePage';
import { ConsentPage } from './pages/app/ConsentPage';
import { ExamPage } from './pages/app/ExamPage';
import { ReportPage } from './pages/app/ReportPage';
import { HistoryPage } from './pages/app/HistoryPage';
import { SignUpPage } from './pages/auth/SignUpPage';
import { SignInPage } from './pages/auth/SignInPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { RequireAuth } from './components/RequireAuth';
import { useAuthStore } from './state/authStore';

export function App() {
  const load = useAuthStore((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <BrowserRouter>
      <Routes>
        {/* The marketing site is a single scrolling page with anchor navigation. */}
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<LandingPage />} />
        </Route>

        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        {/* Exam flow runs full-bleed, without the marketing chrome. No
            account is required — starting a session provisions a guest
            identity automatically (see ensureIdentity.ts on the server),
            which later folds into a real account on sign up/sign in. */}
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/session/:sessionId/consent" element={<ConsentPage />} />
        <Route path="/session/:sessionId/exam" element={<ExamPage />} />
        <Route path="/session/:sessionId/report" element={<ReportPage />} />

        {/* History across sessions is an account feature — a guest gets
            redirected to sign in/up rather than seeing an empty list. */}
        <Route element={<RequireAuth />}>
          <Route path="/history" element={<HistoryPage />} />
        </Route>

        {/* Older links used /prep for the exam screen. */}
        <Route path="/session/:sessionId/prep" element={<Navigate to="../exam" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
