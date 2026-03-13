import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import OrganizationHomePage from "@/pages/organization-home";
import OrganizationSettingsPage from "@/pages/organization-settings";
import WorkspacePrepPage from "@/pages/workspace-prep";
import MeetingRoomCorePage from "@/pages/meeting-room-core";
import OutcomesBoardPage from "@/pages/outcomes-board";
import LoginPage from "@/pages/login";

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Switch>
      <Route path="/" component={OrganizationHomePage} />
      <Route path="/org/settings" component={OrganizationSettingsPage} />
      <Route path="/workspace/:id" component={WorkspacePrepPage} />
      <Route path="/workspace/:id/outcomes" component={OutcomesBoardPage} />
      <Route path="/meeting/:id" component={MeetingRoomCorePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <ProtectedRoutes />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
