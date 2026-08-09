
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "./lib/auth";
import Home from "./pages/Home";
import Gate from "./pages/Gate";
import AdminLogin from "./pages/AdminLogin";
import GamePlay from "./pages/GamePlay";
import Results from "./pages/Results";
import Admin from "./pages/Admin";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import OwnerDashboard from "./pages/OwnerDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on auth errors — they need a fresh login
        const status = (error as { status?: number })?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 2;
      },
    },
  },
});


function PlayerRoute({
  component: Component,
}: {
  component: () => React.JSX.Element | null;
}) {
  const { user, authReady } = useAuth();
  if (!authReady) return null; // wait for session verification
  if (!user) return <Redirect to="/" />;
  return <Component />;
}


function AdminRoute() {
  const { isAdmin, authReady, clearAdmin } = useAuth();
  if (!authReady) return null;
  if (!isAdmin) {
    clearAdmin();
    return <Redirect to="/admin-login" />;
  }
  return <Admin />;
}


function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/join" component={Gate} />
      <Route path="/admin-login" component={AdminLogin} />
      <Route path="/game/:id">
        <PlayerRoute component={GamePlay} />
      </Route>
      <Route path="/results/:gameId">
        <PlayerRoute component={Results} />
      </Route>
      <Route path="/admin" component={AdminRoute} />
      <Route path="/register" component={Register} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/owner-dashboard" component={OwnerDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}


export default App;
