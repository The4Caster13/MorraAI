import type { FastifyPluginAsync } from 'fastify';
import type { WebSocket } from 'ws';
import { wsClientMessageSchema, type WsServerMessage } from '@parlons/shared';
import { sessionRepo } from '../db/repositories/index.js';
import { getExaminerService } from '../examiner/index.js';
import { getRuntime, registerRuntime, SessionRuntime } from '../session/SessionRuntime.js';
import { toSessionDto } from '../routes/mappers.js';

export const wsGateway: FastifyPluginAsync = async (app) => {
  app.get('/ws/session/:sessionId', { websocket: true }, async (socket: WebSocket, req) => {
    const { sessionId } = req.params as { sessionId: string };

    const session = await sessionRepo.findById(sessionId);
    if (!session) {
      socket.close(4404, 'Session not found');
      return;
    }
    // Same self-asserted ownership check as the REST routes — see requireOwner
    // in routes/sessions.ts for why this is not yet real authentication.
    const { userId } = (req.query ?? {}) as { userId?: string };
    if (!userId || userId !== session.userId) {
      socket.close(4403, 'Not your session');
      return;
    }
    if (!session.consent && session.status !== 'DRAFT') {
      socket.close(4403, 'Consent missing');
      return;
    }

    const send = (msg: WsServerMessage) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
    };

    let runtime = getRuntime(sessionId);
    if (!runtime) {
      runtime = new SessionRuntime(
        sessionId,
        session.status as never,
        session.mode as never,
        session.prepSecondsAllotted,
        {
          id: session.stimulus.id,
          theme: session.stimulus.theme,
          subtopic: session.stimulus.subtopic,
          captionFr: session.stimulus.captionFr,
          culturalLinkFr: session.stimulus.culturalLinkFr,
        },
        getExaminerService(),
      );
      registerRuntime(runtime);
    }
    runtime.attach(send, false);

    send({ type: 'server:snapshot', session: toSessionDto(session) });

    socket.on('message', (raw: Buffer) => {
      let parsed;
      try {
        parsed = wsClientMessageSchema.safeParse(JSON.parse(raw.toString()));
      } catch {
        send({ type: 'server:error', code: 'BAD_JSON', message: 'Invalid JSON', recoverable: true });
        return;
      }
      if (!parsed.success) {
        send({
          type: 'server:error',
          code: 'BAD_MESSAGE',
          message: 'Unrecognized message shape',
          recoverable: true,
        });
        return;
      }
      const msg = parsed.data;
      const rt = runtime!;

      void (async () => {
        switch (msg.type) {
          case 'client:ready':
            break;
          case 'client:startPhase':
            if (msg.phase === 'PART1') {
              if (rt.getStatus() === 'CONSENTED') {
                await rt.startPrep();
              } else if (rt.getStatus() === 'PREP') {
                await rt.startPart1();
              }
            }
            // PART2/PART3 transitions are server-driven; clients cannot force them.
            break;
          case 'client:audioChunk':
            rt.handleAudioChunk(msg.phase, msg.pcm16Base64);
            break;
          case 'client:requestRephrase':
            rt.requestRephrase();
            break;
          case 'client:notepadUpdate':
            await rt.handleNotepadUpdate(msg.bullets);
            break;
          case 'client:skipPrep':
            await rt.skipPrep();
            break;
          case 'client:endSessionEarly':
            if (rt.getStatus() === 'PART1_RECORDING') {
              await rt.endPart1();
            } else {
              await rt.endSessionEarly();
            }
            break;
          case 'client:toggleTextMode':
            rt.setShowText(msg.show);
            break;
          case 'client:debugStudentText':
            rt.handleDebugStudentText(msg.phase, msg.text);
            break;
        }
      })().catch((err) => {
        req.log.error({ err }, 'ws message handling failed');
        send({
          type: 'server:error',
          code: 'INTERNAL',
          message: err instanceof Error ? err.message : 'Internal error',
          recoverable: false,
        });
      });
    });

    socket.on('close', () => {
      runtime?.detach();
    });
  });
};
