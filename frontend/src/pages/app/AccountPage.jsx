import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Loader2, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../../components/Dialog";
import { useToast } from "../../components/Toast";
import { account } from "../../lib/api";
import { signOut, useAuth } from "../../lib/auth";
import { resetTime, useUsage } from "../../lib/usage";

const ORDER = ["design", "research", "assist", "chat", "trend", "upload", "publish"];

function UsageRow({ item }) {
  const share = item.limit ? Math.min(item.used / item.limit, 1) : 0;
  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink first-letter:uppercase">{item.label}</span>
        <span className="tabular-nums text-muted">
          {item.used} of {item.limit}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
        <div className={`h-full rounded-full ${share >= 1 ? "bg-amber-500" : "bg-accent"}`} style={{ width: `${share * 100}%` }} />
      </div>
    </li>
  );
}

// Today's limits, a copy of everything stored, and account deletion.
export default function AccountPage() {
  const { user } = useAuth();
  const [usage] = useUsage();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setBusy("export");
    setError("");
    try {
      const blob = await account.export();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "aurea-export.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setConfirming(false);
    setBusy("delete");
    setError("");
    try {
      await account.remove();
      await signOut();
      toast("Your account and its data were deleted");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 lg:py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Account and data</h1>
      <p className="mt-1 text-sm text-muted">Your daily AI limits, a copy of your data, and account deletion.</p>

      {error && <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="card mt-8 p-5">
        <h2 className="text-base font-semibold text-ink">Today's usage</h2>
        <p className="mt-0.5 text-sm text-muted">Limits reset at {resetTime(usage)}. Runs that fail or are cancelled do not count.</p>
        {usage ? (
          <ul className="mt-3 divide-y divide-line">
            {ORDER.filter((b) => usage.buckets[b]).map((b) => (
              <UsageRow key={b} item={usage.buckets[b]} />
            ))}
          </ul>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Loader2 size={15} className="animate-spin" /> Loading
          </p>
        )}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="text-base font-semibold text-ink">Download your data</h2>
        <p className="mt-0.5 text-sm text-muted">
          One JSON file with your profile, projects, versions, ideas, insights, and chats. Connected account passwords and tokens are never included.
        </p>
        <button className="btn btn-secondary mt-4" onClick={download} disabled={busy !== null}>
          {busy === "export" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download
        </button>
      </section>

      <section className="card mt-6 border-red-200 p-5">
        <h2 className="text-base font-semibold text-ink">Delete account</h2>
        <p className="mt-0.5 text-sm text-muted">
          Permanently deletes {user?.email ? <span className="font-medium text-ink">{user.email}</span> : "your account"} and everything stored with it, including
          connected accounts and saved AI runs. This cannot be undone.
        </p>
        <button className="btn mt-4 bg-red-600 text-white hover:bg-red-700" onClick={() => setConfirming(true)} disabled={busy !== null}>
          {busy === "delete" ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Delete account
        </button>
      </section>

      <ConfirmDialog
        open={confirming}
        title="Delete your account?"
        description="Your projects, ideas, brand kit, insights, and connected accounts will be deleted for good. Download your data first if you want a copy."
        confirmLabel="Delete everything"
        danger
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
