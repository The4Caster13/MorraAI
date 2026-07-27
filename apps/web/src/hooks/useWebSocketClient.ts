import { useCallback, useEffect, useRef, useState } from 'react';
import { wsServerMessageSchema, type WsClientMessage } from '@morrai/shared';
import { useSessionStore } from '../state/sessionStore';
import { PcmStreamingPlayer } from '../lib/audio/pcmPlayer';

export function useWebSocketClient(sessionId: string | undefined) {
  const socketRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<PcmStreamingPlayer | null>(null);
  const [connected, setConnected] = useState(false);
  const applyServerMessage = useSessionStore((s) => s.applyServerMessage);

  useEffect(() => {
    if (!sessionId) return;
    const player = new PcmStreamingPlayer();
    playerRef.current = player;

    // Ownership is enforced server-side from the session cookie (sent
    // automatically on this same-origin WS handshake), so no userId needs to
    // travel in the URL anymore.
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${proto}://${window.location.host}/ws/session/${sessionId}`);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      socket.send(JSON.stringify({ type: 'client:ready' } satisfies WsClientMessage));
    };
    socket.onclose = () => setConnected(false);
    socket.onmessage = (event) => {
      const parsed = wsServerMessageSchema.safeParse(JSON.parse(event.data));
      if (!parsed.success) return;
      if (parsed.data.type === 'server:examinerInterrupted') player.stopImmediately();
      applyServerMessage(parsed.data, (b64, rate) => player.enqueue(b64, rate));
    };

    return () => {
      player.dispose();
      socket.close();
      socketRef.current = null;
      playerRef.current = null;
    };
  }, [sessionId, applyServerMessage]);

  const send = useCallback((msg: WsClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
  }, []);

  return { connected, send };
}
