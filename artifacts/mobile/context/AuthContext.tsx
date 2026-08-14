import React, { createContext, useContext, useEffect, useState } from 'react';
import * as storage from '@/lib/storage';
import { API_BASE_URL } from '@/lib/apiBase';

export const PLAYER_TOKEN_KEY = 'trivia_mobile_token';
const USER_KEY = 'trivia_user';

type User = { id: number; name: string };

type AuthContextType = {
  user: User | null;
  authReady: boolean;
  loginUser: (user: User, mobileToken: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

// Note: setAuthTokenGetter is registered in app/_layout.tsx as a unified
// getter that checks the admin token first, then the player token.
// Do not call setAuthTokenGetter here — it would race with the layout.

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const baseUrl = API_BASE_URL;

  useEffect(() => {
    const restore = async () => {
      try {
        const [stored, token] = await Promise.all([
          storage.getItem(USER_KEY),
          storage.getItem(PLAYER_TOKEN_KEY),
        ]);

        if (stored && token) {
          const parsed = JSON.parse(stored) as User;
          try {
            const r = await fetch(`${baseUrl}/api/auth/me`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = (await r.json()) as { user: User | null };
            if (r.ok && data.user) {
              setUser(data.user);
            } else {
              await Promise.all([
                storage.deleteItem(USER_KEY),
                storage.deleteItem(PLAYER_TOKEN_KEY),
              ]);
            }
          } catch {
            // Network error — trust stored user
            setUser(parsed);
          }
        }
      } catch {
        // ignore SecureStore errors
      } finally {
        setAuthReady(true);
      }
    };
    restore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loginUser = async (u: User, mobileToken: string) => {
    await Promise.all([
      storage.setItem(USER_KEY, JSON.stringify(u)),
      storage.setItem(PLAYER_TOKEN_KEY, mobileToken),
    ]);
    setUser(u);
  };

  const logout = async () => {
    const token = await storage.getItem(PLAYER_TOKEN_KEY).catch(() => null);
    try {
      await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      // ignore
    }
    await Promise.all([
      storage.deleteItem(USER_KEY).catch(() => {}),
      storage.deleteItem(PLAYER_TOKEN_KEY).catch(() => {}),
    ]);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, authReady, loginUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
