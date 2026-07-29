
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, Loader2, AlertCircle, ArrowLeft } from "lucide-react";


export default function AdminLogin() {
const [code, setCode] = useState("");
const [error, setError] = useState("");
const [pending, setPending] = useState(false);
const { loginAdmin } = useAuth();
const [, setLocation] = useLocation();
const { toast } = useToast();


const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 const trimmed = code.trim().toUpperCase();
 if (!trimmed) {
     setError("Enter your admin code");
     return;
 }
 setError("");
 setPending(true);
 try {
     const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code: trimmed }),
     });


     if (res.status === 401) {
      setError("That code isn't right — try again");
         return;
     }
     if (!res.ok) {
         toast({ variant: "destructive", title: "Something went wrong — please retry" });
         return;
     }


     loginAdmin();
     setLocation("/admin");
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
          <div className="flex items-center justify-center gap-3">
          <Shield className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold tracking-tighter">
           HOST ACCESS
          </h1>
    </div>
    <p className="text-muted-foreground">
     Enter your admin code to manage tonight's games
    </p>
   </div>


   <Card className="border-primary/20 bg-card/50 backdrop-blur">
    <CardHeader className="pb-2">
      <CardTitle className="text-base font-medium text-muted-foreground uppercasetracking-widest">
      Admin Code
     </CardTitle>
    </CardHeader>
    <CardContent>
     <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
      <Input
       value={code}
       onChange={(e) => {
           setCode(e.target.value);
           setError("");
       }}
       placeholder="ENTER ADMIN CODE"
       autoCapitalize="characters"
       autoComplete="off"
       autoFocus
          aria-invalid={!!error}
        className={`h-14 text-center text-2xl uppercase tracking-widest bg-backgroundborder-primary/30 focus-visible:ring-primary ${
            error ? "border-destructive focus-visible:ring-destructive" : ""
          }`}
       />
       {error && (
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
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
            VERIFYING...
          </>
       ):(
          "UNLOCK DASHBOARD"
              )}
              </Button>
           </form>
          </CardContent>
         </Card>


         <div className="text-center space-y-2">
          <Link
           href="/"
     className="inline-flex items-center gap-1.5 text-sm text-muted-foregroundhover:text-foreground transition-colors"
          >
           <ArrowLeft className="h-4 w-4" />
           Back to player login
          </Link>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <Link href="/register" className="hover:text-foreground transition-colors">
              Create account
            </Link>
            <span>·</span>
            <Link href="/forgot-password" className="hover:text-foreground transition-colors">
              Forgot password?
            </Link>
          </div>
         </div>
         </div>
     </div>
    );
}


