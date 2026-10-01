import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2, RefreshCw, ServerCrash } from "lucide-react";
import { loadSession, useAuth } from "../lib/auth";
import { CustomFontFaces } from "../lib/fonts";
import { loadProjects, onSyncError } from "../lib/storage";
import { useToast } from "./Toast";

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper text-subtle">
      <Loader2 size={20} className="animate-spin" />
    </div>
  );
}

function ServerUnavailable() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-500">
        <ServerCrash size={20} />
      </span>
      <h1 className="text-lg font-semibold text-ink">Cannot reach Aurea right now</h1>
      <p className="max-w-sm text-sm text-muted">The server did not respond. Check that the backend is running, then try again.</p>
      <button className="btn btn-primary mt-3" onClick={loadSession}>
        <RefreshCw size={14} /> Try again
      </button>
    </div>
  );
}

// Layout route for signed-in pages. Sends visitors to sign in and new users to onboarding.
export default function Protected({ requireOnboarded = true }) {
  const { status, user, profile } = useAuth();
  const location = useLocation();
  const toast = useToast();

  useEffect(() => {
    if (status === "signed-in") loadProjects(user.id);
  }, [status, user?.id]);

  useEffect(() => onSyncError((message) => toast(message, { tone: "error" })), [toast]);

  if (status === "loading") return <FullPageLoader />;
  if (status === "error") return <ServerUnavailable />;
  if (status === "signed-out") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/signin?next=${next}`} replace />;
  }
  if (requireOnboarded && !profile?.onboarded) return <Navigate to="/onboarding" replace />;
  return (
    <>
      <CustomFontFaces />
      <Outlet />
    </>
  );
}
