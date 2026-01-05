import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, AuthTokens } from '@/types';

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setAuth: (user: AuthUser, tokens: AuthTokens) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  updateTokens: (tokens: AuthTokens) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      
      setAuth: (user, tokens) => set({
        user,
        tokens,
        isAuthenticated: true,
        isLoading: false,
      }),
      
      logout: () => set({
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false,
      }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      updateTokens: (tokens) => set({ tokens }),
    }),
    {
      name: 'ral-auth',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
