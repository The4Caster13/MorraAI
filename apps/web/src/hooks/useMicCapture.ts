import { useEffect, useRef, useState } from 'react';
import { startMicCapture, type MicCapture } from '../lib/audio/micCapture';

export function useMicCapture(active: boolean, onChunk: (pcm16Base64: string) => void) {
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const captureRef = useRef<MicCapture | null>(null);
  const onChunkRef = useRef(onChunk);
  onChunkRef.current = onChunk;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    startMicCapture(
      (b64) => onChunkRef.current(b64),
      (rms) => setLevel(rms),
    )
      .then((capture) => {
        if (cancelled) {
          capture.stop();
          return;
        }
        captureRef.current = capture;
      })
      .catch((err: Error) => setError(err.message));

    return () => {
      cancelled = true;
      captureRef.current?.stop();
      captureRef.current = null;
      setLevel(0);
    };
  }, [active]);

  return { level, error };
}
