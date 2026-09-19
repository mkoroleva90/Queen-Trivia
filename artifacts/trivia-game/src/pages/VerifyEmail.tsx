import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "../lib/auth";
import { COPY } from "@workspace/copy";

type State = "verifying" | "success" | "error";

export default function VerifyEmail() {
  const [state, setState] = useState<State>("verifying");
  const [message, setMessage] = useState("");
  const [, setLocation] = useLocation();
  const { loginAdmin } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setState("error");
      setMessage(COPY.hostRegister.error.invalidLink);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/auth/email/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
        });

        if (res.ok) {
          // Signed in on success — same as the mobile verify step.
          loginAdmin();
          setState("success");
          setMessage(COPY.hostRegister.verify.verifiedBody);
          setTimeout(() => setLocation("/admin"), 1800);
        } else if (res.status === 429) {
          setState("error");
          setMessage(COPY.hostRegister.error.tooManyAttempts);
        } else {
          setState("error");
          setMessage(COPY.hostRegister.error.invalidLink);
        }
      } catch {
        setState("error");
        setMessage(COPY.hostLogin.error.connectionError);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-[#0a0c12]">
      <Card className="w-full max-w-md bg-[#0a1019] border-[#1b2740]">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          {state === "verifying" && (
            <>
              <Loader2 className="w-10 h-10 text-[#ff2d8e] animate-spin mx-auto" />
              <p className="text-[#9aa6bc]">{COPY.hostRegister.verify.verifying}</p>
            </>
          )}

          {state === "success" && (
            <>
              <CheckCircle className="w-12 h-12 text-[#35d07f] mx-auto" />
              <h2 className="text-xl font-extrabold tracking-widest text-white">{COPY.hostRegister.verify.verifiedHeading}</h2>
              <p className="text-[#9aa6bc] text-sm">{message}</p>
            </>
          )}

          {state === "error" && (
            <>
              <XCircle className="w-12 h-12 text-[#ff6b6b] mx-auto" />
              <h2 className="text-xl font-extrabold tracking-widest text-white">{COPY.hostRegister.verify.failedHeading}</h2>
              <p className="text-[#9aa6bc] text-sm">{message}</p>
              <Button
                className="bg-[#ff2d8e] hover:bg-[#e0207d] text-white"
                onClick={() => setLocation("/register")}
              >
                {COPY.hostRegister.verify.registerAgain}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
