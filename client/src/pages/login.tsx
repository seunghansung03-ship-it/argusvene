import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, Mail } from "lucide-react";
import { SiGoogle } from "react-icons/si";

export default function LoginPage() {
  const { user, loading, signingIn, error, signInWithGoogle, signInWithEmail, registerWithEmail, clearError } = useAuth();
  const [, setLocation] = useLocation();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (user && !loading) {
      setLocation("/");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp) {
      registerWithEmail(email, password, displayName || undefined);
    } else {
      signInWithEmail(email, password);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    clearError();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">A</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">ArgusVene</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            AI Co-founder Engine
          </p>
          <p className="text-muted-foreground text-xs">
            {isSignUp ? "Create an account to get started" : "Sign in to join meetings with your AI co-founders"}
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="text-auth-error">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          {isSignUp && (
            <Input
              data-testid="input-display-name"
              type="text"
              placeholder="Display name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={signingIn}
            />
          )}
          <Input
            data-testid="input-email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={signingIn}
          />
          <Input
            data-testid="input-password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={signingIn}
          />
          <Button
            data-testid="button-email-submit"
            type="submit"
            className="w-full h-11 gap-2"
            disabled={signingIn || !email || !password}
          >
            {signingIn ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            {signingIn ? "Please wait..." : isSignUp ? "Create Account" : "Sign in with Email"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Button
          data-testid="button-google-signin"
          variant="outline"
          className="w-full h-11 gap-3"
          onClick={signInWithGoogle}
          disabled={signingIn}
        >
          <SiGoogle className="w-4 h-4" />
          Continue with Google
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            data-testid="button-toggle-auth-mode"
            type="button"
            onClick={toggleMode}
            className="text-primary hover:underline font-medium"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>

        <p className="text-center text-xs text-muted-foreground">
          Powered by Gemini 2.5 Flash
        </p>
      </Card>
    </div>
  );
}
