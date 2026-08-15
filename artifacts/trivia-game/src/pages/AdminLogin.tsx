
import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { COPY } from "@workspace/copy";

/** Public Google OAuth web client ID, provided at build time. */
const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as
  | string
  | undefined;

const APPLE_SERVICES_ID = "com.queentrivia.web";
const APPLE_RETURN_URL = "https://queen-trivia.com/auth/apple/callback";

/** Loads an external script once; resolves when it is ready. */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
    document.head.appendChild(script);
  });
}


export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [pending, setPending] = useState(false);
  const { loginAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [ssoPending, setSsoPending] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  /** Posts an SSO ID token to the server and enters the admin area on success. */
  const submitSsoToken = async (
    endpoint: "/api/auth/sso/google" | "/api/auth/sso/apple",
    body: { idToken: string; name?: string },
  ) => {
    setSsoPending(true);
    setEmailError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let message: string = COPY.hostLogin.error.somethingWrong;
        try {
          const data = await res.json();
          if (typeof data?.error === "string" && data.error) message = data.error;
        } catch {
          /* non-JSON error body — keep generic message */
        }
        setEmailError(message);
        return;
      }
      loginAdmin();
      setLocation("/admin");
    } catch {
      toast({ variant: "destructive", title: COPY.hostLogin.error.connectionError });
    } finally {
      setSsoPending(false);
    }
  };

  // Google Identity Services: render the real (hidden) GIS button so we get a
  // Google ID token; our styled button forwards its click to it.
  useEffect(() => {
    if (!GOOGLE_WEB_CLIENT_ID) return;
    let cancelled = false;
    loadScript("https://accounts.google.com/gsi/client")
      .then(() => {
        if (cancelled) return;
        const google = (window as any).google;
        if (!google?.accounts?.id || !googleBtnRef.current) return;
        google.accounts.id.initialize({
          client_id: GOOGLE_WEB_CLIENT_ID,
          callback: (response: { credential?: string }) => {
            if (response.credential) {
              void submitSsoToken("/api/auth/sso/google", { idToken: response.credential });
            }
          },
        });
        google.accounts.id.renderButton(googleBtnRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          width: 400,
        });
        setGoogleReady(true);
      })
      .catch(() => {
        /* script blocked/offline — button click will surface an error */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAppleClick = async () => {
    try {
      await loadScript(
        "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js",
      );
      const AppleID = (window as any).AppleID;
      AppleID.auth.init({
        clientId: APPLE_SERVICES_ID,
        scope: "name email",
        redirectURI: APPLE_RETURN_URL,
        usePopup: true,
      });
      const result = await AppleID.auth.signIn();
      const idToken: string | undefined = result?.authorization?.id_token;
      if (!idToken) return;
      const nameParts = [result?.user?.name?.firstName, result?.user?.name?.lastName]
        .filter(Boolean)
        .join(" ");
      await submitSsoToken("/api/auth/sso/apple", {
        idToken,
        ...(nameParts ? { name: nameParts } : {}),
      });
    } catch (err: any) {
      // User closing the Apple popup rejects with { error: "popup_closed_by_user" } — not an error.
      if (err?.error === "popup_closed_by_user") return;
      setEmailError(COPY.hostLogin.error.somethingWrong);
    }
  };


  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setEmailError(COPY.hostLogin.error.enterBoth);
      return;
    }
    setEmailError("");
    setPending(true);
    try {
      const res = await fetch("/api/auth/email/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password, rememberMe }),
      });

      if (res.status === 403) {
        setEmailError(COPY.hostLogin.error.verifyEmail);
        return;
      }
      if (res.status === 401) {
        setEmailError(COPY.hostLogin.error.invalidCredentials);
        return;
      }
      if (!res.ok) {
        toast({ variant: "destructive", title: COPY.hostLogin.error.somethingWrong });
        return;
      }

      loginAdmin();
      setLocation("/admin");
    } catch {
      toast({ variant: "destructive", title: COPY.hostLogin.error.connectionError });
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
              {COPY.hostLogin.heading}
            </h1>
          </div>
          <p className="text-muted-foreground">
            {COPY.hostLogin.helper}
          </p>
        </div>

        <Card className="border-primary/20 bg-card/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-muted-foreground uppercase tracking-widest">
              {COPY.hostLogin.cardHeading}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError("");
                  }}
                  placeholder={COPY.hostLogin.emailPlaceholder}
                  autoComplete="email"
                  autoFocus
                  aria-invalid={!!emailError}
                  className={`h-12 bg-background border-primary/30 focus-visible:ring-primary ${
                    emailError ? "border-destructive focus-visible:ring-destructive" : ""
                  }`}
                />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setEmailError("");
                  }}
                  placeholder={COPY.hostLogin.passwordPlaceholder}
                  autoComplete="current-password"
                  aria-invalid={!!emailError}
                  className={`h-12 bg-background border-primary/30 focus-visible:ring-primary ${
                    emailError ? "border-destructive focus-visible:ring-destructive" : ""
                  }`}
                />
                {emailError && (
                  <p className="flex items-center gap-1.5 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {emailError}
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-primary/30 accent-primary"
                />
                {COPY.hostLogin.rememberMe}
              </label>

              <Button
                type="submit"
                className="w-full h-14 text-lg font-bold tracking-wide"
                disabled={pending}
              >
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {COPY.hostLogin.signingIn}
                  </>
                ) : (
                  COPY.hostLogin.signInBtn
                )}
              </Button>
            </form>

            <div className="flex items-center gap-3 my-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {COPY.hostLogin.orDivider}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-3">
              {/*
                Google requires a genuine user click on its own rendered
                control to issue an ID token, so the real GIS button sits
                transparently on top of our styled button and receives the
                click directly.
              */}
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12"
                  disabled={ssoPending || !googleReady}
                  tabIndex={-1}
                  aria-hidden="true"
                >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                  {COPY.hostLogin.continueWithGoogle}
                </Button>
                {/* Real GIS button, transparent, capturing the actual click. */}
                <div
                  ref={googleBtnRef}
                  className={`absolute inset-0 flex items-center justify-center overflow-hidden opacity-0 ${
                    ssoPending || !googleReady ? "pointer-events-none" : ""
                  }`}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full h-12"
                disabled={ssoPending}
                onClick={handleAppleClick}
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M16.365 1.43c0 1.14-.417 2.2-1.25 3.03-.855.9-2.03 1.57-3.11 1.49-.14-1.11.36-2.28 1.16-3.09.87-.9 2.29-1.55 3.2-1.43zm3.85 16.05c-.53 1.22-.79 1.77-1.47 2.85-.95 1.51-2.29 3.39-3.95 3.4-1.48.02-1.86-.97-3.87-.96-2.01.01-2.43.98-3.91.96-1.66-.02-2.93-1.71-3.88-3.22-2.66-4.22-2.94-9.17-1.3-11.8 1.17-1.87 3.01-2.96 4.74-2.96 1.76 0 2.87.97 4.33.97 1.41 0 2.27-.97 4.31-.97 1.54 0 3.17.84 4.33 2.29-3.8 2.08-3.19 7.51.67 9.44z" />
                </svg>
                {COPY.hostLogin.continueWithApple}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {COPY.hostLogin.backToPlayer}
          </Link>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <Link href="/register" className="hover:text-foreground transition-colors">
              {COPY.hostLogin.createAccount}
            </Link>
            <span>·</span>
            <Link href="/forgot-password" className="hover:text-foreground transition-colors">
              {COPY.hostLogin.forgotPassword}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
