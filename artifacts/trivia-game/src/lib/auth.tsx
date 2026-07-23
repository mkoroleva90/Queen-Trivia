
import { useState, useEffect, createContext, useContext } from "react";


type AuthState = {
  user: { id: number; name: string } | null;
  isAdmin: boolean;
  authReady: boolean;
  loginUser: (user: { id: number; name: string }) => void;
  loginAdmin: () => void;
  logout: () => Promise<void>;
  clearAdmin: () => void;
};


const AuthContext = createContext<AuthState | null>(null);


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: number; name: string } | null>(() => {
    try {
      const saved = localStorage.getItem("trivia_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem("trivia_admin") === "true";
  });
  // authReady flips to true once we've verified the session against the server
  const [authReady, setAuthReady] = useState(false);


  // On mount, verify localStorage state against live server sessions
  useEffect(() => {
    const verify = async () => {
      const storedAdmin = localStorage.getItem("trivia_admin") === "true";
      const storedUser = (() => {
        try {
          const s = localStorage.getItem("trivia_user");
          return s ? JSON.parse(s) : null;
        } catch { return null; }
      })();

      try {
        if (storedAdmin) {
          const r = await fetch("/api/admin/me", { credentials: "include" });
          const data = await r.json().catch(() => ({}));
          if (!r.ok || !data.isAdmin) {
            // Server session gone — clear stale admin flag
            setIsAdmin(false);
            localStorage.removeItem("trivia_admin");
          }
        } else if (storedUser) {
          const r = await fetch("/api/auth/me", { credentials: "include" });
          const data = await r.json().catch(() => ({}));
          if (!r.ok || !data.user) {
            setUser(null);
            localStorage.removeItem("trivia_user");
          }
        }
      } catch {
        // Network error — leave existing state; server will return 401 on actual requests
      } finally {
        setAuthReady(true);
      }
    };
    verify();
  }, []);


  const loginUser = (u: { id: number; name: string }) => {
    setUser(u);
    localStorage.setItem("trivia_user", JSON.stringify(u));
  };


  const loginAdmin = () => {
    setIsAdmin(true);
    localStorage.setItem("trivia_admin", "true");
  };

  const clearAdmin = () => {
    setIsAdmin(false);
    localStorage.removeItem("trivia_admin");
  };


  const logout = async () => {
    try {
      const endpoint = isAdmin ? "/api/admin/logout" : "/api/auth/logout";
      await fetch(endpoint, { method: "POST", credentials: "include" });
    } catch {
      // ignore network errors — clear client state regardless
    }
    setUser(null);
    setIsAdmin(false);
    localStorage.removeItem("trivia_user");
    localStorage.removeItem("trivia_admin");
  };


  return (
    <AuthContext.Provider value={{ user, isAdmin, authReady, loginUser, loginAdmin, logout, clearAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
