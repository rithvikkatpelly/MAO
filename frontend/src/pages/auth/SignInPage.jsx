import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Loader2, Terminal } from "lucide-react";
import { Logo } from "../../components/AppShell";
import SlideStack from "../../components/SlideStack";
import { devLogin, getAuthConfig, signInWithGoogle, useAuth } from "../../lib/auth";
import { loadGoogleIdentity, safeNext } from "../../lib/google";

function Notice({ children }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function GoogleButton({ clientId, onCredential, onError }) {
  const ref = useRef(null);
  const handlers = useRef({ onCredential, onError });
  useEffect(() => {
    handlers.current = { onCredential, onError };
  });

  useEffect(() => {
    let cancelled = false;
    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !ref.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) => handlers.current.onCredential(credential),
          ux_mode: "popup",
          auto_select: false,
          itp_support: true,
        });
        google.accounts.id.renderButton(ref.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          logo_alignment: "center",
          width: 320,
        });
      })
      .catch((err) => handlers.current.onError(err.message));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return <div ref={ref} className="flex h-11 justify-center" />;
}

export default function SignInPage() {
  const { status } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get("next"));
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAuthConfig()
      .then(setConfig)
      .catch(() => setError("Cannot reach the Aurea server. Make sure the backend is running."));
  }, []);

  const finish = useRef(async (action) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  });

  if (status === "signed-in") return <Navigate to={next} replace />;

  const ready = config && config.database === "ok" && config.google_client_id;

  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Logo to="/" />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-16 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Welcome to Aurea Studio</h1>
          <p className="mt-2 text-sm text-muted">Sign in or create your account with Google. New here? We will set up your brand in two minutes.</p>

          <div className="mt-8 space-y-4">
            {!config && !error && (
              <div className="flex h-11 items-center justify-center text-subtle">
                <Loader2 size={18} className="animate-spin" />
              </div>
            )}
            {config && config.database !== "ok" && (
              <Notice>The database is not connected yet. Set DATABASE_URL on the server (see docs/setup.md).</Notice>
            )}
            {config && config.database === "ok" && !config.google_client_id && (
              <Notice>Google sign-in is not configured yet. Set GOOGLE_CLIENT_ID on the server (see docs/setup.md).</Notice>
            )}
            {ready && (
              <div className={busy ? "pointer-events-none opacity-60" : ""}>
                <GoogleButton
                  clientId={config.google_client_id}
                  onCredential={(credential) => finish.current(() => signInWithGoogle(credential))}
                  onError={setError}
                />
              </div>
            )}
            {config?.dev_login && config.database === "ok" && (
              <button className="btn btn-secondary h-11 w-full rounded-full" disabled={busy} onClick={() => finish.current(devLogin)}>
                <Terminal size={15} /> Continue as local developer
              </button>
            )}
            {busy && <p className="text-xs text-subtle">Signing you in</p>}
            {error && <Notice>{error}</Notice>}
          </div>

          <p className="mt-10 text-xs leading-relaxed text-subtle">
            By continuing you agree to use Aurea responsibly. We only read your name, email address, and profile photo from Google.
          </p>
        </div>
        <Link to="/" className="text-xs text-muted hover:text-ink">
          Back to home
        </Link>
      </div>

      <div className="relative hidden overflow-hidden bg-ink lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(circle at 70% 20%, rgba(255,90,60,0.28), transparent 45%), radial-gradient(circle at 20% 90%, rgba(79,70,229,0.25), transparent 45%)" }}
        />
        <SlideStack width={230} className="relative" />
        <p className="relative mt-12 max-w-xs text-center text-sm text-white/70">
          Research, write, and design carousels, posters, and images in your brand, in minutes.
        </p>
      </div>
    </div>
  );
}
