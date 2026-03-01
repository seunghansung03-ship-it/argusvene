import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import { SiGoogle } from "react-icons/si";

export default function LoginPage() {
  const { user, loading, signingIn, error, signIn } = useAuth();
  const [, setLocation] = useLocation();

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 space-y-8">
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
            Sign in to join meetings with your AI co-founders
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="text-auth-error">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          data-testid="button-google-signin"
          className="w-full h-12 text-base gap-3"
          onClick={signIn}
          disabled={signingIn}
        >
          {signingIn ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <SiGoogle className="w-5 h-5" />
          )}
          {signingIn ? "Signing in..." : "Sign in with Google"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Powered by Gemini 2.5 Flash
        </p>
      </Card>
    </div>
  );
}
