import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthChange, loginWithGoogle, logout, type User } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      setSigningIn(true);
      setError(null);
      await loginWithGoogle();
    } catch (e: any) {
      const code = e?.code || "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setError(null);
      } else if (code === "auth/popup-blocked") {
        setError("Popup was blocked. Please allow popups for this site.");
      } else if (code === "auth/unauthorized-domain") {
        setError("This domain is not authorized. Add it to Firebase Console > Authentication > Authorized Domains.");
      } else {
        setError(e?.message || "Sign in failed. Please try again.");
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setError(null);
      await logout();
    } catch (e: any) {
      setError(e?.message || "Sign out failed.");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signingIn, error, signIn, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
