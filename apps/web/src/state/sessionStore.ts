import { create } from 'zustand';
import type { Phase, SessionDto, SessionStatus, WsServerMessage } from '@parlons/shared';

export interface CaptionLine {
  speaker: 'STUDENT' | 'EXAMINER';
  text: string;
  isFinal: boolean;
}

interface SessionState {
  session: SessionDto | null;
  status: SessionStatus | null;
  phase: Phase | null;
  remainingMs: number | null;
  captions: CaptionLine[];
  examinerSpeaking: boolean;
  showQuestionText: boolean;
  part1HardStopped: boolean;
  error: { code: string; message: string; recoverable: boolean } | null;
  complete: boolean;
  applyServerMessage(msg: WsServerMessage, onAudio: (b64: string, rate: number) => void): void;
  setShowQuestionText(show: boolean): void;
  reset(): void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  status: null,
  phase: null,
  remainingMs: null,
  captions: [],
  examinerSpeaking: false,
  showQuestionText: false,
  part1HardStopped: false,
  error: null,
  complete: false,

  applyServerMessage(msg, onAudio) {
    switch (msg.type) {
      case 'server:snapshot':
        set({ session: msg.session, status: msg.session.status, phase: msg.session.currentPhase });
        break;
      case 'server:phaseChanged':
        set({ status: msg.status, phase: msg.phase, remainingMs: null });
        break;
      case 'server:timerTick':
        set({ remainingMs: msg.remainingMs });
        break;
      case 'server:examinerAudioChunk':
        set({ examinerSpeaking: true });
        onAudio(msg.pcm16Base64, msg.sampleRate);
        break;
      case 'server:examinerInterrupted':
        set({ examinerSpeaking: false });
        break;
      case 'server:questionText':
        set((s) => ({
          examinerSpeaking: true,
          captions: [...s.captions, { speaker: 'EXAMINER', text: msg.text, isFinal: true }],
        }));
        break;
      case 'server:studentTranscript': {
        const captions = [...get().captions];
        const last = captions[captions.length - 1];
        if (last && last.speaker === 'STUDENT' && !last.isFinal) {
          captions[captions.length - 1] = {
            speaker: 'STUDENT',
            text: msg.text,
            isFinal: msg.isFinal,
          };
        } else {
          captions.push({ speaker: 'STUDENT', text: msg.text, isFinal: msg.isFinal });
        }
        set({ captions, examinerSpeaking: false });
        break;
      }
      case 'server:part1HardStop':
        set({ part1HardStopped: true });
        break;
      case 'server:error':
        set({ error: { code: msg.code, message: msg.message, recoverable: msg.recoverable } });
        break;
      case 'server:sessionComplete':
        set({ complete: true });
        break;
      case 'server:stimulusReveal':
        break;
    }
  },

  setShowQuestionText(show) {
    set({ showQuestionText: show });
  },

  reset() {
    set({
      session: null,
      status: null,
      phase: null,
      remainingMs: null,
      captions: [],
      examinerSpeaking: false,
      part1HardStopped: false,
      error: null,
      complete: false,
    });
  },
}));
