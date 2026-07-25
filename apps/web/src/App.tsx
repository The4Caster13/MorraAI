import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SetupPage } from './pages/SetupPage';
import { ConsentPage } from './pages/ConsentPage';
import { ExamPage } from './pages/ExamPage';
import { ReportPage } from './pages/ReportPage';
import { HistoryPage } from './pages/HistoryPage';

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <Routes>
          <Route path="/" element={<SetupPage />} />
          <Route path="/session/:sessionId/consent" element={<ConsentPage />} />
          <Route path="/session/:sessionId/prep" element={<ExamPage />} />
          <Route path="/session/:sessionId/report" element={<ReportPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
