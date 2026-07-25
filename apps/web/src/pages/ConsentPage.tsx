import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { ensureUserId } from '../lib/profile';
import { Button, Card, PageShell } from '../components';

const CONSENT_TEXT_VERSION = '2026-07-25.v1';

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
      navigate(`/session/${sessionId}/prep`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Consentement impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title="Avant de commencer">
      <Card className="space-y-5">
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Pour simuler l'oral, Parlons a besoin d'enregistrer votre voix pendant la session. Voici
            exactement ce qui se passe :
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Votre micro enregistre uniquement pendant les parties orales de la session.</li>
            <li>
              L'enregistrement et la transcription sont conservés pour vous permettre de réécouter
              votre oral et de consulter votre rapport.
            </li>
            <li>
              Vous pouvez supprimer définitivement une session — audio et transcription compris — à
              tout moment depuis la page du rapport ou l'historique.
            </li>
            <li>Vos enregistrements ne sont jamais utilisés pour entraîner un modèle d'IA.</li>
            <li>
              Si vous avez moins de 18 ans, parlez-en à un parent ou à un enseignant avant de
              continuer.
            </li>
          </ul>
        </div>

        <fieldset className="space-y-3 border-t border-slate-200 pt-4">
          <legend className="sr-only">Consentements requis</legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={recording}
              onChange={(e) => setRecording(e.target.checked)}
              className="mt-1"
            />
            <span>J'accepte que ma voix soit enregistrée pendant cette session.</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={retention}
              onChange={(e) => setRetention(e.target.checked)}
              className="mt-1"
            />
            <span>
              Je comprends que l'enregistrement est conservé jusqu'à ce que je le supprime.
            </span>
          </label>
        </fieldset>

        {error && (
          <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button onClick={submit} disabled={!recording || !retention || busy}>
            {busy ? 'Enregistrement du consentement…' : "J'accepte, commencer"}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Annuler
          </Button>
        </div>
      </Card>
    </PageShell>
  );
}
