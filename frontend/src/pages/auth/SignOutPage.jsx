import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Logo } from "../../components/AppShell";
import { signOut } from "../../lib/auth";
import { resetItems } from "../../lib/items";
import { resetProjects } from "../../lib/storage";

export default function SignOutPage() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Google keeps its own session; stop it from auto-selecting this account next time.
    window.google?.accounts?.id?.disableAutoSelect();
    signOut()
      .catch(() => {})
      .finally(() => {
        resetProjects();
        resetItems();
        setDone(true);
      });
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-paper px-6 py-6 sm:px-10">
      <Logo to="/" />
      <div className="flex flex-1 items-center justify-center">
        <div className="card w-full max-w-sm p-8 text-center">
          {done ? (
            <>
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={20} />
              </span>
              <h1 className="mt-4 text-lg font-semibold text-ink">You are signed out</h1>
              <p className="mt-1 text-sm text-muted">Your projects are saved to your account and will be here when you come back.</p>
              <div className="mt-6 flex flex-col gap-2">
                <Link to="/signin" className="btn btn-primary btn-lg">
                  Sign in again
                </Link>
                <Link to="/" className="btn btn-ghost">
                  Back to home
                </Link>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted">
              <Loader2 size={16} className="animate-spin" /> Signing you out
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
