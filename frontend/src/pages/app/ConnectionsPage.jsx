import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CircleAlert, ExternalLink, Loader2, Unplug } from "lucide-react";
import { ConfirmDialog } from "../../components/Dialog";
import InstagramGlyph from "../../components/InstagramGlyph";
import { useToast } from "../../components/Toast";
import { instagram } from "../../lib/api";
import { startInstagramConnect, takeReturnPath } from "../../lib/instagram";

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
}

function InstagramCard() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState(null); // { configured, missing, account }
  const [busy, setBusy] = useState(null); // "connect" | "finish" | "disconnect"
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const handled = useRef(false);

  const load = useCallback(() => {
    instagram
      .status()
      .then(setStatus)
      .catch((err) => setError(err.message));
  }, []);

  // Finish a sign-in that Instagram just redirected back from. The code is single use,
  // so it runs once and is removed from the address bar right away.
  useEffect(() => {
    if (handled.current) return;
    const code = params.get("instagram_code");
    const state = params.get("state");
    const failed = params.get("instagram_error");
    if (!code && !failed) {
      load();
      return;
    }
    handled.current = true;
    setParams({}, { replace: true });
    if (failed) {
      takeReturnPath();
      setError(failed);
      load();
      return;
    }
    setBusy("finish");
    instagram
      .finishConnect(code, state || "")
      .then((next) => {
        setStatus(next);
        toast(`Connected @${next.account.username}`);
        const back = takeReturnPath();
        if (back) navigate(back);
      })
      .catch((err) => {
        takeReturnPath();
        setError(err.message);
        load();
      })
      .finally(() => setBusy(null));
  }, [params, setParams, load, navigate, toast]);

  async function connect() {
    setError("");
    setBusy("connect");
    try {
      await startInstagramConnect();
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  }

  async function disconnect() {
    setConfirm(false);
    setBusy("disconnect");
    try {
      await instagram.disconnect();
      setStatus((s) => ({ ...s, account: null }));
      toast("Instagram disconnected");
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  const account = status?.account;

  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 text-white">
          <InstagramGlyph size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink">Instagram</h2>
          <p className="mt-0.5 text-sm text-muted">Post images and carousels straight from the editor.</p>
        </div>
        {account && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Connected</span>}
      </div>

      <div className="mt-5">
        {(!status && !error) || busy === "finish" ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={15} className="animate-spin" /> {busy === "finish" ? "Finishing the connection" : "Loading"}
          </p>
        ) : status && !status.configured ? (
          <div className="rounded-xl bg-paper p-4 text-sm">
            <p className="font-medium text-ink">Instagram publishing is not set up on this server yet.</p>
            <p className="mt-1 text-muted">
              Add these to <code className="kbd">backend/.env</code> and restart the API: {status.missing.join(", ")}. The steps are in{" "}
              <code className="kbd">docs/instagram.md</code>.
            </p>
          </div>
        ) : account ? (
          <div className="flex flex-wrap items-center gap-4">
            {account.profile_picture_url ? (
              <img src={account.profile_picture_url} alt="" className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
                {(account.username || "?").slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <a
                href={`https://www.instagram.com/${account.username}/`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:underline"
              >
                @{account.username} <ExternalLink size={12} className="text-subtle" />
              </a>
              <p className="text-xs text-subtle">
                {account.account_type === "MEDIA_CREATOR" ? "Creator account" : account.account_type === "BUSINESS" ? "Business account" : "Professional account"}
                {" · "}connected {formatDate(account.connected_at)}
                {account.expires_at && <> · access renews when you post, valid until {formatDate(account.expires_at)}</>}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={connect} disabled={!!busy}>
                Switch account
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirm(true)} disabled={!!busy}>
                {busy === "disconnect" ? <Loader2 size={14} className="animate-spin" /> : <Unplug size={14} />} Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-md text-xs text-subtle">
              Works with Instagram Business and Creator accounts. A personal account can switch for free in the Instagram app under Settings, Account type and tools.
            </p>
            {status && (
              <button className="btn btn-primary" onClick={connect} disabled={!!busy}>
                {busy === "connect" ? <Loader2 size={15} className="animate-spin" /> : <InstagramGlyph size={15} />} Connect Instagram
              </button>
            )}
          </div>
        )}

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <CircleAlert size={15} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirm}
        title="Disconnect Instagram?"
        description={`Aurea will stop posting to @${account?.username ?? ""}. Posts already published stay on Instagram.`}
        confirmLabel="Disconnect"
        danger
        onConfirm={disconnect}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 lg:py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Connections</h1>
      <p className="mt-1 text-sm text-muted">Connect your social accounts to publish from Aurea without downloading anything.</p>
      <div className="mt-8 space-y-4">
        <InstagramCard />
      </div>
    </div>
  );
}
