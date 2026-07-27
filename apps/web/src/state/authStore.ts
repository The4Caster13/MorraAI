import { create } from 'zustand';
import type { CurrentUserDto } from '@morrai/shared';
import { api } from '../lib/api';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  user: CurrentUserDto | null;
  status: AuthStatus;
  /** Populates `user`/`status` from the session cookie. Called once at boot. */
  load(): Promise<void>;
  setUser(user: CurrentUserDto | null): void;
  reset(): void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  async load() {
    try {
      const { user } = await api.me();
      set({ user, status: user ? 'authenticated' : 'anonymous' });
    } catch {
      // A network hiccup shouldn't strand the app on a splash forever —
      // treat it as signed out, same as a real "no session" answer.
      set({ user: null, status: 'anonymous' });
    }
  },
  setUser(user) {
    set({ user, status: user ? 'authenticated' : 'anonymous' });
  },
  reset() {
    set({ user: null, status: 'anonymous' });
  },
}));
