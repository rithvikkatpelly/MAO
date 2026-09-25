import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowLeft, Download, RotateCcw, Loader2 } from "lucide-react";

const API_BASE = "http://localhost:8000";

const PLATFORMS = [
  { id: "linkedin", label: "LinkedIn", hint: "6-slide carousel", aspect: "aspect-square" },
  { id: "instagram", label: "Instagram", hint: "1 feed post", aspect: "aspect-[4/5]" },
  { id: "x", label: "X", hint: "1 card", aspect: "aspect-[16/9]" },
];

const TEMPLATE_STYLES = {
  modern: "bg-navy-950 text-white",
  minimal: "bg-white text-navy-950 border border-navy-950/10",
  "tech-blue": "bg-[#0a66c2] text-white",
  corporate: "bg-navy-700 text-white",
  gradient: "bg-gradient-to-br from-coral-500 via-purple-500 to-blue-500 text-white",
};

function platformMeta(id) {
  return PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0];
}

export default function StudioPage() {
  const [step, setStep] = useState("form"); // form | ideas | result
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("linkedin");
  const [threadId, setThreadId] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleResearch(e) {
    e.preventDefault();
    if (!topic.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/carousel/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, platform }),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Research failed");
      const data = await res.json();
      setThreadId(data.thread_id);
      setIdeas(data.ideas);
      setStep("ideas");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    if (selectedIndex === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/carousel/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, idea_index: selectedIndex }),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Generation failed");
      const data = await res.json();
      setResult(data);
      setStep("result");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep("form");
    setTopic("");
    setThreadId(null);
    setIdeas([]);
    setSelectedIndex(null);
    setResult(null);
    setError(null);
  }

  const meta = platformMeta(platform);

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="border-b border-navy-950/5 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-coral-500 text-white">
              <Sparkles size={18} />
            </span>
            <span className="text-lg font-bold tracking-tight text-navy-950">Aurea Studio</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm font-medium text-navy-800/60 hover:text-navy-950"
          >
            <ArrowLeft size={15} /> Back home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-14">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === "form" && (
          <form onSubmit={handleResearch}>
            <h1 className="text-3xl font-bold tracking-tight text-navy-950">
              What do you want to post about?
            </h1>
            <p className="mt-2 text-navy-800/60">
              Aurea's agents will research it, then draft platform-ready content for you to review.
            </p>

            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Why human-in-the-loop AI beats full automation"
              rows={3}
              required
              className="mt-8 w-full resize-none rounded-2xl border border-navy-950/10 bg-white px-5 py-4 text-base text-navy-950 shadow-sm focus:border-coral-500 focus:outline-none"
            />

            <p className="mt-8 text-sm font-semibold text-navy-950">Platform</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    platform === p.id
                      ? "border-coral-500 bg-coral-500/5 ring-1 ring-coral-500"
                      : "border-navy-950/10 bg-white hover:border-navy-950/20"
                  }`}
                >
                  <p className="text-sm font-semibold text-navy-950">{p.label}</p>
                  <p className="text-xs text-navy-800/50">{p.hint}</p>
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-10 flex w-full items-center justify-center gap-2 rounded-full bg-coral-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-coral-500/30 transition hover:bg-coral-600 disabled:opacity-60"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {busy ? "Researching..." : "Research Ideas"}
            </button>
          </form>
        )}

        {step === "ideas" && (
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-navy-950">Pick an idea</h1>
            <p className="mt-2 text-navy-800/60">
              The research agent found {ideas.length} angles for "{topic}".
            </p>

            <div className="mt-8 flex flex-col gap-3">
              {ideas.map((idea, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedIndex(i)}
                  className={`rounded-2xl border px-5 py-4 text-left transition ${
                    selectedIndex === i
                      ? "border-coral-500 bg-coral-500/5 ring-1 ring-coral-500"
                      : "border-navy-950/10 bg-white hover:border-navy-950/20"
                  }`}
                >
                  <p className="font-semibold text-navy-950">{idea.title}</p>
                  <p className="mt-1 text-sm text-navy-800/60">{idea.angle}</p>
                  <p className="mt-2 text-xs font-medium text-coral-500">{idea.reason}</p>
                </button>
              ))}
            </div>

            <div className="mt-10 flex gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-navy-950/15 px-6 py-3.5 text-sm font-semibold text-navy-950 hover:bg-white"
              >
                Start Over
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={selectedIndex === null || busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-coral-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-coral-500/30 transition hover:bg-coral-600 disabled:opacity-60"
              >
                {busy && <Loader2 size={16} className="animate-spin" />}
                {busy ? "Generating carousel..." : "Generate Carousel"}
              </button>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-navy-950">
                  Your {platformMeta(result.platform).label} content
                </h1>
                <p className="mt-1 text-sm text-navy-800/50">
                  Template: <span className="font-semibold capitalize">{result.template}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1.5 text-sm font-medium text-navy-800/60 hover:text-navy-950"
              >
                <RotateCcw size={14} /> New carousel
              </button>
            </div>

            <div
              className={`mt-8 grid gap-4 ${
                result.slides.length > 1 ? "sm:grid-cols-3" : "sm:grid-cols-1"
              }`}
            >
              {result.slides.map((slide) => (
                <div
                  key={slide.index}
                  className={`flex ${meta.aspect} flex-col justify-between rounded-2xl p-5 shadow-sm ${
                    TEMPLATE_STYLES[result.template] ?? TEMPLATE_STYLES.modern
                  }`}
                >
                  <span className="text-xs font-semibold opacity-70">
                    {String(slide.index).padStart(2, "0")} / {String(result.slides.length).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-lg font-bold leading-snug">{slide.headline}</p>
                    <p className="mt-2 text-sm opacity-80">{slide.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-navy-950/10 bg-white p-5">
              <p className="text-sm font-semibold text-navy-950">Caption</p>
              <p className="mt-1 text-sm text-navy-800/70">{result.caption}</p>
              <p className="mt-3 text-sm font-semibold text-navy-950">Hashtags</p>
              <p className="mt-1 text-sm text-coral-500">
                {result.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
              </p>
              <p className="mt-3 text-sm font-semibold text-navy-950">Call to Action</p>
              <p className="mt-1 text-sm text-navy-800/70">{result.cta}</p>
            </div>

            <a
              href={`${API_BASE}/api/carousel/${result.thread_id}/pdf`}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-coral-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-coral-500/30 transition hover:bg-coral-600"
            >
              <Download size={16} /> Download PDF
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
