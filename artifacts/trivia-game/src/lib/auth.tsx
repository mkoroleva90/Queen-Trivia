
import { useState, createContext, useContext } from "react";


type AuthState = {
 user: { id: number; name: string } | null;
 isAdmin: boolean;
 loginUser: (user: { id: number; name: string }) => void;
 loginAdmin: () => void;
 logout: () => Promise<void>;
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


const loginUser = (u: { id: number; name: string }) => {
 setUser(u);
 localStorage.setItem("trivia_user", JSON.stringify(u));
};


const loginAdmin = () => {
 setIsAdmin(true);
 localStorage.setItem("trivia_admin", "true");
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
     <AuthContext.Provider value={{ user, isAdmin, loginUser, loginAdmin, logout }}>
         {children}
     </AuthContext.Provider>
    );
}


export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
}


