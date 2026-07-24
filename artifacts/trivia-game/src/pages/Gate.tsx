
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";


export default function Gate() {
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [step, setStep] = useState<"code" | "name">("code");
    const [pending, setPending] = useState(false);
const [codeError, setCodeError] = useState("");
const [nameError, setNameError] = useState("");
const { loginUser } = useAuth();
const [, setLocation] = useLocation();
const { toast } = useToast();


const handleCodeSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 const trimmed = code.trim().toUpperCase();
 if (!trimmed) {
     setCodeError("Enter your access code");
     return;
 }
 setCodeError("");
 setPending(true);
 try {
     const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code: trimmed }),
     });
     const data = await res.json();
     if (!data.valid) {
      setCodeError("That code isn't right — try again");
      return;
     }
     if (data.role === "admin") {
         // Admin used the player gate — send them to the admin login
         setLocation("/admin-login");
         return;
     }
     setStep("name");
 } catch {
     toast({ variant: "destructive", title: "Connection error — please retry" });
 } finally {
     setPending(false);
 }
};


const handleNameSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 const trimmed = name.trim();
 if (!trimmed) {
     setNameError("Enter your display name");
     return;
 }
 if (trimmed.length > 50) {
     setNameError("Name must be 50 characters or fewer");
     return;
 }
 setNameError("");
 setPending(true);
 try {
     const res = await fetch("/api/auth/login", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         credentials: "include",
         body: JSON.stringify({ code: code.trim().toUpperCase(), name: trimmed }),
     });
     if (res.status === 401) {
         setStep("code");
         setCodeError("Code expired — please re-enter it");
         return;
     }
     if (!res.ok) {
         toast({ variant: "destructive", title: "Something went wrong — please retry" });
         return;
     }
     const user = await res.json();
     loginUser({ id: user.id, name: user.name });
     // Game-specific access code: auto-join that game and go straight to it
     if (user.gameId) {
      try {
       const joinRes = await fetch(`/api/games/${user.gameId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
       });
       if (joinRes.ok || joinRes.status === 409) {
        setLocation(`/game/${user.gameId}`);
        return;
       }
      } catch {
       // fall through to lobby
      }
     }
     setLocation("/lobby");
 } catch {
     toast({ variant: "destructive", title: "Connection error — please retry" });
 } finally {
     setPending(false);
 }
};
return (
 <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4">
  <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
  <div className="text-center space-y-2">
   <h1 className="text-6xl font-bold tracking-tighter text-primary">
    TRIVIA NIGHT
   </h1>
   <p className="text-xl text-muted-foreground">
    The ultimate pub quiz experience
   </p>
  </div>


  <Card className="border-primary/20 bg-card/50 backdrop-blur">
   {step === "code" ? (
    <CardContent className="p-6 pt-6 text-center">
     <form onSubmit={handleCodeSubmit} className="space-y-4">
      <div className="space-y-2">
      <label className="text-sm font-medium uppercase tracking-widest text-secondary text-center">
          Access Code
          </label>
          <Input
          value={code}
          onChange={(e) => {
           setCode(e.target.value);
            setCodeError("");
          }}
          placeholder="ENTER CODE"
          autoCapitalize="characters"
          autoComplete="off"
          aria-invalid={!!codeError}
        className={`h-14 text-center text-2xl uppercase tracking-widest bg-backgroundborder-primary/30 focus-visible:ring-primary ${
            codeError ? "border-destructive focus-visible:ring-destructive" : ""
          }`}
       />
       {codeError && (
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {codeError}
          </p>
       )}
      </div>
      <Button
       type="submit"
       className="w-full h-14 text-lg font-bold tracking-wide"
       disabled={pending}
      >
       {pending ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              CHECKING...
          </>
         ):(
          "ENTER"
         )}
      </Button>
     </form>
    </CardContent>
   ):(
    <CardContent className="pt-6">
     <form onSubmit={handleNameSubmit} className="space-y-4">
      <div className="space-y-2">
      <label className="text-sm font-medium uppercase tracking-widest text-secondary">
          Display Name
         </label>
         <Input
          value={name}
          onChange={(e) => {
              setName(e.target.value);
              setNameError("");
          }}
          placeholder="YOUR NAME"
          autoFocus
          aria-invalid={!!nameError}
        className={`h-14 text-center text-2xl uppercase tracking-widest bg-backgroundborder-secondary/30 focus-visible:ring-secondary ${
            nameError ? "border-destructive focus-visible:ring-destructive" : ""
          }`}
       />
       {nameError && (
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {nameError}
          </p>
       )}
      </div>
      <Button
       type="submit"
      className="w-full h-14 text-lg font-bold tracking-wide bg-secondary text-secondary-foreground hover:bg-secondary/90"
       disabled={pending}
      >
       {pending ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            JOINING...
          </>
       ):(
          "JOIN LOBBY"
       )}
      </Button>
      <button
               type="button"
               onClick={() => setStep("code")}
        className="w-full text-sm text-muted-foreground hover:text-foregroundtransition-colors"
              >
               Wrong code? Go back
              </button>
              </form>
          </CardContent>
         )}
        </Card>


        <p className="text-center text-sm text-muted-foreground">
         Hosting tonight?{" "}
         <Link
          href="/admin-login"
          className="text-secondary underline-offset-4 hover:underline font-medium"
         >
          Admin login
         </Link>
        </p>
        </div>
 </div>
);
}
