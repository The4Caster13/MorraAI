import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mic, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { Button, Card, ErrorNote, Logo, PageHeading } from '../../components/ui';

const CONSENT_TEXT_VERSION = '2026-07-25.v1';

const POINTS = [
  {
    icon: Mic,
    text: 'Your microphone only records during the spoken parts of the session.',
  },
  {
    icon: ShieldCheck,
    text: 'The recording and transcript are used to produce your report and to let you listen back. They are never used to train an AI.',
  },
  {
    icon: Trash2,
    text: 'You can permanently delete a session — recording and transcript included — from the report or your history.',
  },
];

export function ConsentPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [retention, setRetention] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // A stale copy of this page (reached via the browser's back button after the
  // session already moved on, or finished) must never let the student attempt
  // to consent again — bounce forward to wherever the session actually is
  // instead of showing a form for a step that's already behind them.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void api
      .getSession(sessionId)
      .then((session) => {
        if (cancelled) return;
        if (session.status !== 'DRAFT') {
          navigate(`/session/${sessionId}/exam`, { replace: true });
          return;
        }
        setChecking(false);
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate]);

  const submit = async () => {
    if (!sessionId || !recording || !retention) return;
    setBusy(true);
    setError(null);
    try {
      await api.consent(sessionId, {
        recordingConsent: true,
        dataRetentionAcknowledged: true,
        consentTextVersion: CONSENT_TEXT_VERSION,
      });
      navigate(`/session/${sessionId}/exam`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record consent');
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 flex items-center justify-between">
          <Link
            to="/practice"
            className="flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-navy"
          >
            <ArrowLeft size={16} /> Change setup
          </Link>
          <Link to="/" aria-label="Morra AI — home">
            <Logo size="sm" />
          </Link>
        </div>

        <PageHeading
          label="Before you begin"
          title="One thing first"
          intro="To simulate the oral, Morra AI needs to record your voice. Here is exactly what happens."
        />

        <Card className="mt-8">
          <ul className="mb-2 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(27,79,216,0.1)' }}
                >
                  <Icon size={15} className="text-brand" aria-hidden="true" />
                </span>
                <span className="text-sm leading-relaxed text-slate-600">{text}</span>
              </li>
            ))}
          </ul>

          <fieldset className="space-y-4 border-t pt-6" style={{ borderColor: 'rgba(10,22,40,0.08)' }}>
            <legend className="sr-only">Required consent</legend>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={recording}
                onChange={(e) => setRecording(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span>I agree to my voice being recorded during this session.</span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={retention}
                onChange={(e) => setRetention(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span>I understand the recording is kept until I delete it.</span>
            </label>
          </fieldset>

          {error && (
            <div className="mt-6">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={submit} disabled={!recording || !retention || busy} variant="accent">
              {busy ? 'Saving…' : "I agree, let's start"}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/')}>
              Cancel
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
