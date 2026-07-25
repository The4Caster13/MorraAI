import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mic, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { ensureUserId } from '../../lib/profile';
import { Button, ErrorNote, Logo } from '../../components/ui';

const CONSENT_TEXT_VERSION = '2026-07-25.v1';

const POINTS = [
  {
    icon: Mic,
    text: "Votre micro n'enregistre que pendant les parties orales de la session.",
  },
  {
    icon: ShieldCheck,
    text: "L'enregistrement et la transcription servent à produire votre rapport et à vous réécouter. Ils ne sont jamais utilisés pour entraîner une IA.",
  },
  {
    icon: Trash2,
    text: 'Vous pouvez supprimer définitivement une session — audio et transcription compris — depuis le rapport ou votre historique.',
  },
];

export function ConsentPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [retention, setRetention] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!sessionId || !recording || !retention) return;
    setBusy(true);
    setError(null);
    try {
      await api.consent(sessionId, {
        userId: ensureUserId(),
        recordingConsent: true,
        dataRetentionAcknowledged: true,
        consentTextVersion: CONSENT_TEXT_VERSION,
      });
      navigate(`/session/${sessionId}/exam`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Consentement impossible');
      setBusy(false);
    }
  };

  return (
    <div className="on-dark min-h-screen bg-navy-deep px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 flex items-center justify-between">
          <Link
            to="/practice"
            className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft size={16} /> Modifier la configuration
          </Link>
          <Logo size="sm" dark />
        </div>

        <h1 className="mb-2 font-display text-3xl font-black text-white">Avant de commencer</h1>
        <p className="mb-8 text-slate-400">
          Pour simuler l'oral, Morra AI a besoin d'enregistrer votre voix. Voici exactement ce qui
          se passe.
        </p>

        <ul className="mb-8 space-y-4">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3">
              <span
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'rgba(27,79,216,0.15)' }}
              >
                <Icon size={15} className="text-brand-bright" aria-hidden="true" />
              </span>
              <span className="text-sm leading-relaxed text-slate-300">{text}</span>
            </li>
          ))}
        </ul>

        <p
          className="mb-8 rounded-xl px-4 py-3 text-sm leading-relaxed text-amber-200"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          Si vous avez moins de 18 ans, parlez-en à un parent ou à un enseignant avant de
          continuer.
        </p>

        <fieldset className="mb-8 space-y-4 border-t border-white/10 pt-6">
          <legend className="sr-only">Consentements requis</legend>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={recording}
              onChange={(e) => setRecording(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand"
            />
            <span>J'accepte que ma voix soit enregistrée pendant cette session.</span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={retention}
              onChange={(e) => setRetention(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand"
            />
            <span>
              Je comprends que l'enregistrement est conservé jusqu'à ce que je le supprime.
            </span>
          </label>
        </fieldset>

        {error && (
          <div className="mb-6">
            <ErrorNote dark>{error}</ErrorNote>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={submit}
            disabled={!recording || !retention || busy}
            variant="accent"
          >
            {busy ? 'Enregistrement…' : "J'accepte, commencer"}
          </Button>
          <Button variant="ghost-dark" onClick={() => navigate('/')}>
            Annuler
          </Button>
        </div>
      </div>
    </div>
  );
}
