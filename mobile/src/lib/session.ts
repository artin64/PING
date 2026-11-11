import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { User } from './types';

type SessionState = {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  setSession: (token: string, user: User, refreshToken?: string) => void;
  clearSession: () => void;
};

const sessionStorage = createJSONStorage<Pick<SessionState, 'token' | 'refreshToken' | 'user'>>(() => ({
  getItem: async (key) => {
    if (Platform.OS === 'web') return typeof window === 'undefined' ? null : window.sessionStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key, value) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.sessionStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  removeItem: async (key) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.sessionStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
}));

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      setSession: (token, user, refreshToken) => set((state) => ({ token, user, refreshToken: refreshToken ?? state.refreshToken })),
      clearSession: () => set({ token: null, refreshToken: null, user: null }),
    }),
    {
      name: 'pingo.session.v1',
      storage: sessionStorage,
      partialize: (state) => ({ token: state.token, refreshToken: state.refreshToken, user: state.user }),
    },
  ),
);

