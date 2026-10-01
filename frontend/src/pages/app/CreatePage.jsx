import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Bookmark, BookmarkCheck, Check, Lightbulb, Minus, Plus, RefreshCw, Repeat2, Sparkles, WandSparkles, X } from "lucide-react";
import PipelineProgress from "../../components/PipelineProgress";
import { useToast } from "../../components/Toast";
import { ai, describeError, generateContent, researchIdeas, startFromIdea } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { refreshEngineStatus, useEngineStatus } from "../../lib/engine";
import { KINDS, PLATFORMS, SIZES, TEXT_FORMATS } from "../../lib/formats";
import { saveItem, saveItems, useItems } from "../../lib/items";
import { MOD_KEY } from "../../lib/keys";
import { blankProject, projectFromResult, textProjectFromResult } from "../../lib/project";
import { insertProject, useBrand } from "../../lib/storage";
import { TEMPLATES } from "../../lib/templates";

const RESEARCH_RUN = {
  title: "Researching your topic",
  subtitle: "Searching the web and news for fresh, timely angles.",
  steps: [{ node: "research", label: "Researching topic", detail: "Reading the top sources, then drafting content ideas" }],
};

function generateRun(textFormat) {
  const steps = [
    { node: "deep_research", label: "Deep research", detail: "Gathering facts and sources for your idea", parallel: true },
    { node: "brand_context", label: "Your voice and platform", detail: "Your tone, audience, examples, and what performed", parallel: true },
    { node: "content", label: "Writing copy", detail: "Drafting slides, caption, and call to action" },
    { node: "design", label: "Designing slides", detail: "Choosing a layout for your content" },
  ];
  if (textFormat) steps.push({ node: "repurpose", label: `Writing the ${TEXT_FORMATS[textFormat].label.toLowerCase()}`, detail: "Rewriting the researched post into your format" });
  return {
    title: "Building your post",
    subtitle: "Your agents are researching, writing, and designing. This usually takes a minute or two.",
    steps,
  };
}

const EXAMPLES = [
  "5 lessons from launching a side project",
  "Why most productivity advice fails",
  "How AI agents are changing marketing",
  "A beginner's guide to strength training",
];

function SizeShape({ size, active }) {
  const scale = 18 / Math.max(size.w, size.h);
  return (
    <span className="flex h-5 w-5 items-center justify-center">
      <span className={`rounded-[3px] border-[1.5px] ${active ? "border-ink" : "border-subtle"}`} style={{ width: size.w * scale, height: size.h * scale }} />
    </span>
  );
}

function StepDots({ stage }) {
  const steps = ["Brief", "Pick an idea", "Edit and export"];
  const current = stage === "brief" ? 0 : 1;
  return (
    <ol className="mb-8 flex items-center gap-2 text-xs font-medium">
      {steps.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
              i < current ? "bg-ink text-white" : i === current ? "bg-accent text-white" : "bg-ink/[0.06] text-subtle"
            }`}
          >
            {i < current ? <Check size={11} strokeWidth={3} /> : i + 1}
          </span>
          <span className={i === current ? "text-ink" : "text-subtle"}>{label}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-line" />}
        </li>
      ))}
    </ol>
  );
}

function OutputChoice({ active, icon: Icon, label, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative rounded-xl border bg-white p-3.5 text-left transition ${active ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink/25"}`}
    >
      <Icon size={17} className={active ? "text-accent" : "text-muted"} />
      <p className="mt-2.5 text-sm font-semibold text-ink">{label}</p>
      <p className="mt-0.5 text-xs text-muted">{description}</p>
      {active && (
        <span className="absolute top-3 right-3 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-white">
          <Check size={10} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

const PLATFORM_ALIASES = { LinkedIn: "linkedin", Instagram: "instagram", X: "x" };

export default function CreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const brand = useBrand();
  const { profile } = useAuth();
  const engine = useEngineStatus();
  useItems("idea");

  // Arriving from the ideas backlog, a series, or the calendar
  const preset = location.state ?? {};
  const series = preset.series ?? null;
  const [fromIdea, setFromIdea] = useState(preset.idea ?? null);

  const [output, setOutput] = useState(preset.kind || series?.kind || "carousel"); // a KINDS id or a TEXT_FORMATS id
  const isText = output in TEXT_FORMATS;
  const kind = isText ? "carousel" : output;
  const [size, setSize] = useState(KINDS[kind]?.defaultSize ?? "portrait");
  const [template, setTemplate] = useState(series?.template && series.template !== "auto" ? series.template : "auto");
  const [slideCount, setSlideCount] = useState(series?.slide_count ?? 6);
  const [platform, setPlatform] = useState(PLATFORM_ALIASES[profile?.social?.primary_platform] ?? "linkedin");
  const [topic, setTopic] = useState(preset.topic ?? series?.prompt ?? "");
  const [threadId, setThreadId] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [saved, setSaved] = useState({});
  const [selected, setSelected] = useState(null);
  const [stage, setStage] = useState("brief");
  const [error, setError] = useState(null);
  const [run, setRun] = useState(null);
  const [progress, setProgress] = useState({});
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const offline = engine.state === "offline";

  function chooseOutput(id) {
    setOutput(id);
    const nextKind = id in TEXT_FORMATS ? "carousel" : id;
    if (!KINDS[nextKind].sizes.includes(size)) setSize(KINDS[nextKind].defaultSize);
  }

  function track(event) {
    const at = Date.now();
    setProgress((prev) => ({
      ...prev,
      [event.node]: event.status === "running" ? { status: "running", startedAt: at } : { ...prev[event.node], status: "done", endedAt: at },
    }));
  }

  async function runPipeline(start, config) {
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setProgress({});
    setRun({ config, startedAt: Date.now() });
    try {
      return await start(track, controller.signal);
    } catch (err) {
      const message = describeError(err);
      if (message) setError(message);
      if (err instanceof TypeError) refreshEngineStatus();
      return null;
    } finally {
      setRun(null);
    }
  }

  async function handleResearch(e) {
    e?.preventDefault();
    if (run) return;
    if (fromIdea) return generate(null, fromIdea);
    if (!topic.trim()) return;
    const data = await runPipeline(
      (onStep, signal) => researchIdeas({ topic: topic.trim(), platform, kind, slideCount }, onStep, signal),
      RESEARCH_RUN,
    );
    if (data) {
      setThreadId(data.thread_id);
      setIdeas(data.ideas);
      setSaved({});
      setSelected(0);
      setStage("ideas");
    }
  }

  // Generate from a research thread (index) or straight from a saved idea.
  async function generate(index, savedIdea = null) {
    const idea = savedIdea ?? ideas[index];
    const format = isText ? output : null;
    const data = await runPipeline(async (onStep, signal) => {
      let thread = threadId;
      let ideaIndex = index;
      if (savedIdea) {
        const started = await startFromIdea({ idea: savedIdea, topic: topic || savedIdea.topic || savedIdea.title, platform, kind, slideCount });
        thread = started.thread_id;
        ideaIndex = 0;
      }
      const result = await generateContent({ threadId: thread, ideaIndex }, onStep, signal);
      if (!format) return { result };
      onStep({ node: "repurpose", status: "running" });
      const { data: text } = await ai.repurpose(format, {
        title: idea.title,
        kind: "carousel",
        slides: result.slides.map((s) => ({ headline: s.headline, body: s.body })),
        caption: result.caption,
        cta: result.cta,
        sources: result.sources.map((s) => ({ title: s.title, url: s.url })),
        idea: `${idea.title}: ${idea.angle ?? ""}`,
      });
      onStep({ node: "repurpose", status: "done" });
      return { result, text };
    }, generateRun(format));
    if (!data) return;

    try {
      const common = { result: data.result, idea, topic: topic || idea.topic || idea.title, brand };
      const project = insertProject(
        format
          ? textProjectFromResult({ ...common, format, output: data.text })
          : projectFromResult({ ...common, kind, size, template }),
      );
      if (savedIdea?.id) saveItem("idea", { ...savedIdea, status: "used" }).catch(() => {});
      toast("Your post is ready to edit");
      navigate(`/app/p/${project.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function bookmark(i) {
    const idea = ideas[i];
    try {
      const item = await saveItem("idea", { title: idea.title, angle: idea.angle, reason: idea.reason, topic, source: "research", status: "new", kind: isText ? "text" : kind });
      setSaved((s) => ({ ...s, [i]: item.id }));
    } catch (err) {
      toast(err.message, { tone: "error" });
    }
  }

  async function bookmarkAll() {
    const rest = ideas.map((idea, i) => ({ idea, i })).filter(({ i }) => !saved[i]);
    try {
      const items = await saveItems(
        "idea",
        rest.map(({ idea }) => ({ title: idea.title, angle: idea.angle, reason: idea.reason, topic, source: "research", status: "new", kind: isText ? "text" : kind })),
      );
      setSaved((s) => ({ ...s, ...Object.fromEntries(rest.map(({ i }, j) => [i, items[j]?.id])) }));
      toast(`${items.length} ideas saved to your backlog`);
    } catch (err) {
      toast(err.message, { tone: "error" });
    }
  }

  function startBlank() {
    try {
      const draft = blankProject(kind, brand, size);
      if (template !== "auto") draft.design.template = template;
      navigate(`/app/p/${insertProject(draft).id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 lg:py-12">
      {error && (
        <div role="alert" className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {run ? (
        <PipelineProgress
          title={run.config.title}
          subtitle={run.config.subtitle}
          steps={run.config.steps}
          progress={progress}
          startedAt={run.startedAt}
          onCancel={() => abortRef.current?.abort()}
        />
      ) : stage === "brief" ? (
        <form onSubmit={handleResearch} className="animate-fade-in">
          <StepDots stage={stage} />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">What are you making?</h1>
          <p className="mt-1 text-sm text-muted">Aurea researches your topic, writes in your voice, and designs it. You stay in control of every word.</p>

          {series && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm">
              <Repeat2 size={16} className="shrink-0 text-accent" />
              <span className="flex-1">
                New episode of <span className="font-medium text-ink">{series.name}</span>
              </span>
            </div>
          )}

          <p className="mt-6 field-label">Visual</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {Object.values(KINDS).map((k) => (
              <OutputChoice key={k.id} active={output === k.id} icon={k.icon} label={k.label} description={k.description} onClick={() => chooseOutput(k.id)} />
            ))}
          </div>
          <p className="mt-4 field-label">Text</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {Object.values(TEXT_FORMATS).map((f) => (
              <OutputChoice key={f.id} active={output === f.id} icon={f.icon} label={f.label} description={f.description} onClick={() => chooseOutput(f.id)} />
            ))}
          </div>

          {fromIdea ? (
            <div className="mt-8 rounded-xl border border-ink/15 bg-white p-4">
              <div className="flex items-start gap-3">
                <Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted">From your ideas backlog</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{fromIdea.title}</p>
                  {fromIdea.angle && <p className="mt-0.5 text-sm text-muted">{fromIdea.angle}</p>}
                </div>
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => setFromIdea(null)} aria-label="Use a new topic instead">
                  <X size={15} />
                </button>
              </div>
              <p className="mt-3 text-xs text-subtle">Research on this idea starts right away. No need to pick an angle again.</p>
            </div>
          ) : (
            <>
              <label htmlFor="topic" className="mt-8 block text-sm font-medium text-ink">
                What is it about?
              </label>
              <textarea
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleResearch();
                }}
                placeholder="Describe your topic, audience, or the point you want to make"
                rows={3}
                maxLength={500}
                className="input mt-2 resize-none px-4 py-3 text-[15px]"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button key={ex} type="button" className="chip" onClick={() => setTopic(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="field-label">Platform</p>
              <div className="flex rounded-lg bg-ink/[0.05] p-0.5">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className={`h-8 flex-1 rounded-md text-sm font-medium transition ${platform === p.id ? "bg-white text-ink shadow-card" : "text-muted hover:text-ink"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-subtle">Shapes tone and length for that platform.</p>

              {(kind === "carousel" || isText) && (
                <div className="mt-5">
                  <p className="field-label">{isText ? "Research depth (slides drafted first)" : "Number of slides"}</p>
                  <div className="flex items-center gap-2">
                    <button type="button" className="btn btn-secondary btn-icon h-9 w-9" onClick={() => setSlideCount((n) => Math.max(3, n - 1))} disabled={slideCount <= 3} aria-label="Fewer slides">
                      <Minus size={14} />
                    </button>
                    <span className="w-10 text-center text-lg font-semibold tabular-nums text-ink">{slideCount}</span>
                    <button type="button" className="btn btn-secondary btn-icon h-9 w-9" onClick={() => setSlideCount((n) => Math.min(10, n + 1))} disabled={slideCount >= 10} aria-label="More slides">
                      <Plus size={14} />
                    </button>
                    <span className="text-xs text-subtle">3 to 10</span>
                  </div>
                </div>
              )}
            </div>

            {!isText && (
              <div>
                <p className="field-label">Size</p>
                <div className="flex flex-col gap-1">
                  {KINDS[kind].sizes.map((id) => {
                    const s = SIZES[id];
                    const active = size === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSize(id)}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-1.5 text-left transition ${active ? "border-ink bg-white" : "border-transparent hover:bg-white"}`}
                      >
                        <SizeShape size={s} active={active} />
                        <span className="flex-1 text-sm text-ink">
                          {s.label} <span className="text-subtle">{s.ratio}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <label htmlFor="template" className="field-label mt-4">
                  Template
                </label>
                <select id="template" value={template} onChange={(e) => setTemplate(e.target.value)} className="input">
                  <option value="auto">{brand.template === "auto" ? "Let AI choose" : `Brand default (${TEMPLATES[brand.template]?.label})`}</option>
                  {Object.entries(TEMPLATES).map(([id, t]) => (
                    <option key={id} value={id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {offline && (
            <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>The AI engine is offline. Start the backend and Ollama to generate with AI, or start with a blank canvas.</span>
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse gap-2 border-t border-line pt-6 sm:flex-row sm:justify-end">
            {!isText && (
              <button type="button" onClick={startBlank} className="btn btn-secondary btn-lg">
                Start blank
              </button>
            )}
            <button type="submit" disabled={(!fromIdea && !topic.trim()) || offline} className="btn btn-accent btn-lg">
              {fromIdea ? <WandSparkles size={16} /> : <Sparkles size={16} />}
              {fromIdea ? "Create from this idea" : "Research ideas"}
              {!fromIdea && <span className="kbd hidden border-white/20 bg-white/15 text-white/80 sm:inline">{MOD_KEY} Enter</span>}
            </button>
          </div>
        </form>
      ) : (
        <div className="animate-fade-in">
          <StepDots stage={stage} />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Pick an angle</h1>
          <p className="mt-1 text-sm text-muted">
            {ideas.length} ideas for <span className="font-medium text-ink">{topic}</span>, grounded in current sources. Save the others for later.
          </p>

          <div role="radiogroup" className="mt-6 flex flex-col gap-2.5">
            {ideas.map((idea, i) => {
              const active = selected === i;
              return (
                <div key={i} className={`flex gap-3 rounded-xl border bg-white p-4 transition ${active ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink/25"}`}>
                  <button type="button" role="radio" aria-checked={active} onClick={() => setSelected(i)} onDoubleClick={() => generate(i)} className="flex flex-1 gap-4 text-left">
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${active ? "border-ink bg-ink" : "border-subtle"}`}>
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">{idea.title}</span>
                      <span className="mt-1 block text-sm text-muted">{idea.angle}</span>
                      <span className="mt-2 block text-xs text-accent">{idea.reason}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => !saved[i] && bookmark(i)}
                    className={`btn btn-icon shrink-0 ${saved[i] ? "text-accent" : "btn-ghost"}`}
                    title={saved[i] ? "Saved to your backlog" : "Save to your ideas backlog"}
                    aria-label="Save idea"
                  >
                    {saved[i] ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6 sm:flex-row sm:items-center">
            <button type="button" onClick={() => setStage("brief")} className="btn btn-ghost">
              <ArrowLeft size={15} /> Back
            </button>
            <button type="button" onClick={bookmarkAll} disabled={Object.keys(saved).length === ideas.length} className="btn btn-ghost">
              <Bookmark size={14} /> Save all
            </button>
            <button type="button" onClick={handleResearch} className="btn btn-secondary sm:ml-auto">
              <RefreshCw size={14} /> New ideas
            </button>
            <button type="button" onClick={() => generate(selected)} disabled={selected === null} className="btn btn-accent btn-lg">
              <WandSparkles size={16} /> Create {isText ? TEXT_FORMATS[output].label : KINDS[kind].label.toLowerCase()}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
