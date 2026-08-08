import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { type QueryClient } from '@tanstack/react-query';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { PLAYER_TOKEN_KEY } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/apiBase';

export const ADMIN_TOKEN_KEY = 'trivia_admin_token';

type AdminAuthContextType = {
  isAdmin: boolean;
  adminReady: boolean;
  loginAdmin: (adminToken: string) => Promise<void>;
  logoutAdmin: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

/**
 * Switches the global api-client-react auth getter to use the admin Bearer
 * token so that all api-client-react hooks (useListGames, useCreateQuestion,
 * etc.) send admin credentials while the admin is logged in.
 */
function setAdminTokenGetter() {
  setAuthTokenGetter(async () => {
    try {
      return await SecureStore.getItemAsync(ADMIN_TOKEN_KEY);
    } catch {
      return null;
    }
  });
}

/**
 * Restores the global auth getter to the player token so that player screens
 * are not accidentally sending admin credentials after admin logs out.
 */
function setPlayerTokenGetter() {
  setAuthTokenGetter(async () => {
    try {
      return await SecureStore.getItemAsync(PLAYER_TOKEN_KEY);
    } catch {
      return null;
    }
  });
}

export function AdminAuthProvider({
  children,
  queryClient,
}: {
  children: React.ReactNode;
  queryClient: QueryClient;
}) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminReady, setAdminReady] = useState(false);

  const baseUrl = API_BASE_URL;

  // On mount, check if there is a persisted admin token and validate it.
  useEffect(() => {
    const restore = async () => {
      try {
        const token = await SecureStore.getItemAsync(ADMIN_TOKEN_KEY);
        if (token) {
          try {
            const r = await fetch(`${baseUrl}/api/admin/me`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = (await r.json()) as { isAdmin: boolean };
            if (r.ok && data.isAdmin) {
              // Valid admin session — switch auth getter immediately so
              // api-client-react hooks use admin credentials from here on.
              setAdminTokenGetter();
              setIsAdmin(true);
            } else {
              await SecureStore.deleteItemAsync(ADMIN_TOKEN_KEY);
              setPlayerTokenGetter();
            }
          } catch {
            // Network unavailable — trust stored credential
            setAdminTokenGetter();
            setIsAdmin(true);
          }
        }
      } catch {
        // SecureStore unavailable
      } finally {
        setAdminReady(true);
      }
    };
    restore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loginAdmin = async (adminToken: string) => {
    await SecureStore.setItemAsync(ADMIN_TOKEN_KEY, adminToken);
    // Switch auth getter so subsequent api-client-react calls use admin token.
    setAdminTokenGetter();
    // Invalidate all cached queries so admin screens refetch with correct creds.
    queryClient.invalidateQueries();
    setIsAdmin(true);
  };

  const logoutAdmin = async () => {
    const token = await SecureStore.getItemAsync(ADMIN_TOKEN_KEY).catch(() => null);
    try {
      await fetch(`${baseUrl}/api/admin/logout`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      // ignore
    }
    await SecureStore.deleteItemAsync(ADMIN_TOKEN_KEY).catch(() => {});
    // Restore player token getter and clear admin-fetched cache.
    setPlayerTokenGetter();
    queryClient.invalidateQueries();
    setIsAdmin(false);
  };

  return (
    <AdminAuthContext.Provider value={{ isAdmin, adminReady, loginAdmin, logoutAdmin }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
}
