import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthChange, loginWithGoogle, loginWithEmail, signUpWithEmail, logout, type User } from "@/lib/firebase";
import { setCurrentUserId, queryClient } from "@/lib/queryClient";
import { setUserIdGetter } from "@/lib/api";
import { createDevAuthUser, isDevAuthBypassEnabled } from "@/lib/dev-auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  error: string | null;
  isDevBypass: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function friendlyError(e: any): string {
  const code = e?.code || "";
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/popup-blocked":
      return "Popup was blocked. Please allow popups for this site.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized. Add it to Firebase Console > Authentication > Authorized Domains.";
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    default:
      return e?.message || "Authentication failed. Please try again.";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUserIdGetter(() => user?.uid || null);
  }, [user]);

  useEffect(() => {
    if (isDevAuthBypassEnabled) {
      const demoUser = createDevAuthUser();
      setUser(demoUser);
      setCurrentUserId(demoUser.uid);
      setLoading(false);
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      return () => {};
    }

    const unsubscribe = onAuthChange((firebaseUser) => {
      setUser(firebaseUser);
      setCurrentUserId(firebaseUser?.uid || null);
      setLoading(false);
      if (firebaseUser) {
        queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      }
    });
    return unsubscribe;
  }, []);

  const handleAuth = async (authFn: () => Promise<any>) => {
    try {
      setSigningIn(true);
      setError(null);
      if (isDevAuthBypassEnabled) {
        const demoUser = createDevAuthUser();
        setUser(demoUser);
        setCurrentUserId(demoUser.uid);
        return;
      }
      await authFn();
    } catch (e: any) {
      const msg = friendlyError(e);
      if (msg) setError(msg);
    } finally {
      setSigningIn(false);
    }
  };

  const signInWithGoogleHandler = () => handleAuth(loginWithGoogle);

  const signInWithEmailHandler = (email: string, password: string) =>
    handleAuth(() => loginWithEmail(email, password));

  const registerWithEmailHandler = (email: string, password: string, displayName?: string) =>
    handleAuth(() => signUpWithEmail(email, password, displayName));

  const handleSignOut = async () => {
    try {
      setError(null);
      if (isDevAuthBypassEnabled) {
        return;
      }
      await logout();
    } catch (e: any) {
      setError(e?.message || "Sign out failed.");
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signingIn,
      error,
      isDevBypass: isDevAuthBypassEnabled,
      signInWithGoogle: signInWithGoogleHandler,
      signInWithEmail: signInWithEmailHandler,
      registerWithEmail: registerWithEmailHandler,
      signOut: handleSignOut,
      clearError: () => setError(null),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
