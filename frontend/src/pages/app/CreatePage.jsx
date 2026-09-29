import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, RefreshCw, Sparkles, WandSparkles } from "lucide-react";
import PipelineProgress from "../../components/PipelineProgress";
import { useToast } from "../../components/Toast";
import { describeError, generateContent, researchIdeas } from "../../lib/api";
import { refreshEngineStatus, useEngineStatus } from "../../lib/engine";
import { KINDS, SIZES } from "../../lib/formats";
import { MOD_KEY } from "../../lib/keys";
import { blankProject, projectFromResult } from "../../lib/project";
import { insertProject, useBrand } from "../../lib/storage";
import { TEMPLATES } from "../../lib/templates";

const RESEARCH_RUN = {
  title: "Researching your topic",
  subtitle: "Searching the web and news for fresh, timely angles.",
  steps: [{ node: "research", label: "Researching topic", detail: "Reading the top sources, then drafting content ideas" }],
};

const GENERATE_RUN = {
  title: "Building your post",
  subtitle: "Your agents are researching, writing, and designing. This usually takes a few minutes.",
  steps: [
    { node: "deep_research", label: "Deep research", detail: "Gathering facts and sources for your idea", parallel: true },
    { node: "brand_context", label: "Brand and platform context", detail: "Pulling tone, audience, and format rules", parallel: true },
    { node: "content", label: "Writing copy", detail: "Drafting slides, caption, and call to action" },
    { node: "design", label: "Designing slides", detail: "Choosing a layout for your content" },
  ],
};

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

export default function CreatePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const brand = useBrand();
  const engine = useEngineStatus();

  const [stage, setStage] = useState("brief"); // brief | ideas
  const [kind, setKind] = useState("carousel");
  const [size, setSize] = useState(KINDS.carousel.defaultSize);
  const [template, setTemplate] = useState("auto");
  const [topic, setTopic] = useState("");
  const [threadId, setThreadId] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [run, setRun] = useState(null);
  const [progress, setProgress] = useState({});
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const offline = engine.state === "offline";

  function chooseKind(id) {
    setKind(id);
    if (!KINDS[id].sizes.includes(size)) setSize(KINDS[id].defaultSize);
  }

  async function runPipeline(start, config) {
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setProgress({});
    setRun({ config, startedAt: Date.now() });
    try {
      return await start((event) => {
        const at = Date.now();
        setProgress((prev) => ({
          ...prev,
          [event.node]:
            event.status === "running" ? { status: "running", startedAt: at } : { ...prev[event.node], status: "done", endedAt: at },
        }));
      }, controller.signal);
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
    if (!topic.trim() || run) return;
    const data = await runPipeline(
      (onStep, signal) => researchIdeas({ topic: topic.trim(), platform: KINDS[kind].platform }, onStep, signal),
      RESEARCH_RUN,
    );
    if (data) {
      setThreadId(data.thread_id);
      setIdeas(data.ideas);
      setSelected(0);
      setStage("ideas");
    }
  }

  async function handleGenerate() {
    if (selected === null || run) return;
    const data = await runPipeline((onStep, signal) => generateContent({ threadId, ideaIndex: selected }, onStep, signal), GENERATE_RUN);
    if (!data) return;
    try {
      const project = insertProject(projectFromResult({ result: data, idea: ideas[selected], topic, kind, size, brand, template }));
      toast("Your post is ready to edit");
      navigate(`/app/p/${project.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  function startBlank() {
    try {
      const draft = blankProject(kind, brand, size);
      if (template !== "auto") draft.design.template = template;
      const project = insertProject(draft);
      navigate(`/app/p/${project.id}`);
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
          <p className="mt-1 text-sm text-muted">Aurea researches your topic, writes the copy, and designs it. You stay in control of every word.</p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Object.values(KINDS).map((k) => {
              const active = kind === k.id;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => chooseKind(k.id)}
                  aria-pressed={active}
                  className={`relative rounded-xl border bg-white p-4 text-left transition ${
                    active ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink/25"
                  }`}
                >
                  <k.icon size={18} className={active ? "text-accent" : "text-muted"} />
                  <p className="mt-3 text-sm font-semibold text-ink">{k.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{k.description}</p>
                  {active && (
                    <span className="absolute top-3 right-3 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-white">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

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

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="field-label">Size</p>
              <div className="flex flex-col gap-1.5">
                {KINDS[kind].sizes.map((id) => {
                  const s = SIZES[id];
                  const active = size === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSize(id)}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                        active ? "border-ink bg-white" : "border-transparent hover:bg-white"
                      }`}
                    >
                      <SizeShape size={s} active={active} />
                      <span className="flex-1 text-sm text-ink">
                        {s.label} <span className="text-subtle">{s.ratio}</span>
                      </span>
                      <span className="text-xs text-subtle">{s.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label htmlFor="template" className="field-label">
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
              <p className="mt-2 text-xs text-subtle">You can switch templates, colors, and fonts any time in the editor.</p>
            </div>
          </div>

          {offline && (
            <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                The AI engine is offline. Start the backend and Ollama to generate with AI, or start with a blank canvas.
              </span>
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse gap-2 border-t border-line pt-6 sm:flex-row sm:justify-end">
            <button type="button" onClick={startBlank} className="btn btn-secondary btn-lg">
              Start blank
            </button>
            <button type="submit" disabled={!topic.trim() || offline} className="btn btn-accent btn-lg">
              <Sparkles size={16} /> Research ideas
              <span className="kbd hidden border-white/20 bg-white/15 text-white/80 sm:inline">{MOD_KEY} Enter</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="animate-fade-in">
          <StepDots stage={stage} />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Pick an angle</h1>
          <p className="mt-1 text-sm text-muted">
            {ideas.length} ideas for <span className="font-medium text-ink">{topic}</span>, grounded in current sources.
          </p>

          <div role="radiogroup" className="mt-6 flex flex-col gap-2.5">
            {ideas.map((idea, i) => {
              const active = selected === i;
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelected(i)}
                  onDoubleClick={handleGenerate}
                  className={`flex gap-4 rounded-xl border bg-white p-4 text-left transition ${
                    active ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink/25"
                  }`}
                >
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${active ? "border-ink bg-ink" : "border-subtle"}`}>
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{idea.title}</span>
                    <span className="mt-1 block text-sm text-muted">{idea.angle}</span>
                    <span className="mt-2 block text-xs text-accent">{idea.reason}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6 sm:flex-row sm:items-center">
            <button type="button" onClick={() => setStage("brief")} className="btn btn-ghost">
              <ArrowLeft size={15} /> Back
            </button>
            <button type="button" onClick={handleResearch} className="btn btn-secondary sm:ml-auto">
              <RefreshCw size={14} /> New ideas
            </button>
            <button type="button" onClick={handleGenerate} disabled={selected === null} className="btn btn-accent btn-lg">
              <WandSparkles size={16} /> Create {KINDS[kind].label.toLowerCase()}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
