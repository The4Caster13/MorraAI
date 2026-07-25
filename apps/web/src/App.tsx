import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MarketingLayout } from './components/MarketingLayout';
import { LandingPage } from './pages/marketing/LandingPage';
import { PracticePage } from './pages/app/PracticePage';
import { ConsentPage } from './pages/app/ConsentPage';
import { ExamPage } from './pages/app/ExamPage';
import { ReportPage } from './pages/app/ReportPage';
import { HistoryPage } from './pages/app/HistoryPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* The marketing site is a single scrolling page with anchor navigation. */}
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<LandingPage />} />
        </Route>

        {/* Exam flow runs full-bleed, without the marketing chrome. */}
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/session/:sessionId/consent" element={<ConsentPage />} />
        <Route path="/session/:sessionId/exam" element={<ExamPage />} />
        <Route path="/session/:sessionId/report" element={<ReportPage />} />
        <Route path="/history" element={<HistoryPage />} />

        {/* Older links used /prep for the exam screen. */}
        <Route path="/session/:sessionId/prep" element={<Navigate to="../exam" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
