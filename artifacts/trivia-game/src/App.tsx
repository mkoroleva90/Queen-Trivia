
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "./lib/auth";
import Gate from "./pages/Gate";
import AdminLogin from "./pages/AdminLogin";
import Lobby from "./pages/Lobby";
import GamePlay from "./pages/GamePlay";
import Results from "./pages/Results";
import Admin from "./pages/Admin";
const queryClient = new QueryClient();


function PlayerRoute({
    component: Component,
}: {
    component: () => React.JSX.Element | null;
}) {
    const { user } = useAuth();
    if (!user) return <Redirect to="/" />;
    return <Component />;
}


function Router() {
    return (
     <Switch>
       <Route path="/" component={Gate} />
       <Route path="/admin-login" component={AdminLogin} />
       <Route path="/lobby">
       <PlayerRoute component={Lobby} />
       </Route>
       <Route path="/game/:id">
       <PlayerRoute component={GamePlay} />
       </Route>
       <Route path="/results/:gameId">
       <PlayerRoute component={Results} />
         </Route>
         <Route path="/admin" component={Admin} />
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


