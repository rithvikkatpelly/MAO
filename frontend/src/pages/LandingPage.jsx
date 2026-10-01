import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Download,
  Globe,
  LayoutTemplate,
  Palette,
  PenLine,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { Logo } from "../components/AppShell";
import { FitSlide } from "../components/SlideFrame";
import SlideStack, { SAMPLE_BRAND, SAMPLES } from "../components/SlideStack";
import { useAuth } from "../lib/auth";
import { KINDS, SIZES } from "../lib/formats";
import { TEMPLATES } from "../lib/templates";

const FEATURES = [
  { icon: Globe, title: "Live research", text: "Agents read current news and sources, then suggest angles worth posting today." },
  { icon: UserCheck, title: "You pick the idea", text: "Nothing is written until you choose the angle. You stay in control of every word." },
  { icon: PenLine, title: "Written in your voice", text: "Your tone, audience, and goals shape every hook, slide, and caption." },
  { icon: Palette, title: "Always on brand", text: "Upload your logo once. Your colors are pulled from it and applied everywhere." },
  { icon: LayoutTemplate, title: "Eight polished layouts", text: "Switch templates, fonts, colors, and sizes in one click, with a live preview." },
  { icon: Download, title: "Ready to post", text: "Export exact-size PNGs, a ZIP of every slide, or a PDF for LinkedIn documents." },
];

const STEPS = [
  { title: "Describe your topic", text: "Pick carousel, poster, or image and say what it is about." },
  { title: "Choose an angle", text: "Review research-backed ideas and pick the one you like." },
  { title: "Edit and export", text: "Tweak the copy and design, then download and post." },
];

function Header() {
  const { status } = useAuth();
  const signedIn = status === "signed-in";
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
        <Logo to="/" />
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          <a href="#features" className="hover:text-ink">
            Features
          </a>
          <a href="#how" className="hover:text-ink">
            How it works
          </a>
          <a href="#templates" className="hover:text-ink">
            Templates
          </a>
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link to="/app" className="btn btn-primary">
              Open studio <ArrowRight size={15} />
            </Link>
          ) : (
            <>
              <Link to="/signin" className="btn btn-ghost hidden sm:inline-flex">
                Sign in
              </Link>
              <Link to="/signin" className="btn btn-primary">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function SectionTitle({ eyebrow, title, text }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold tracking-wide text-accent uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h2>
      {text && <p className="mt-3 text-muted">{text}</p>}
    </div>
  );
}

export default function LandingPage() {
  const { status } = useAuth();
  const cta = status === "signed-in" ? "/app/new" : "/signin";

  return (
    <div className="min-h-screen bg-white text-ink">
      <Header />

      <main>
        {/* hero */}
        <section className="bg-dots border-b border-line">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:py-24">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-muted shadow-card">
                <Sparkles size={13} className="text-accent" /> AI content studio for creators
              </span>
              <h1 className="mt-6 text-4xl leading-[1.05] font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
                Carousels, posters, and images that sound like you.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted">
                Aurea researches your topic, writes in your voice, and designs on-brand slides. You review, tweak, and export in minutes.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to={cta} className="btn btn-accent btn-lg">
                  Get started free <ArrowRight size={16} />
                </Link>
                <a href="#how" className="btn btn-secondary btn-lg">
                  See how it works
                </a>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                {["Sign in with Google", "Your brand in two minutes", "PNG, ZIP, and PDF export"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <Check size={14} className="text-accent" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center">
              <SlideStack width={250} />
            </div>
          </div>
        </section>

        {/* formats */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {Object.values(KINDS).map((kind) => (
              <div key={kind.id} className="card p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <kind.icon size={19} />
                </span>
                <h3 className="mt-5 text-base font-semibold text-ink">{kind.label}</h3>
                <p className="mt-1 text-sm text-muted">{kind.description}</p>
                <p className="mt-4 flex flex-wrap gap-1.5">
                  {kind.sizes.map((id) => (
                    <span key={id} className="rounded-md bg-paper px-2 py-0.5 text-xs text-muted">
                      {SIZES[id].label} {SIZES[id].ratio}
                    </span>
                  ))}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* features */}
        <section id="features" className="scroll-mt-16 border-y border-line bg-paper py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <SectionTitle eyebrow="Features" title="Everything between an idea and a post" text="Research, writing, design, and export in one calm workspace." />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="card p-6">
                  <Icon size={20} className="text-ink" />
                  <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* how it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 sm:px-8">
          <SectionTitle eyebrow="How it works" title="Three steps. A few minutes." />
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="card relative p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">{i + 1}</span>
                <h3 className="mt-5 text-base font-semibold text-ink">{step.title}</h3>
                <p className="mt-1 text-sm text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* templates */}
        <section id="templates" className="scroll-mt-16 border-y border-line bg-paper py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <SectionTitle eyebrow="Templates" title="Designed to stop the scroll" text="Every layout adapts to your colors, fonts, and logo." />
            <div className="mt-12 grid grid-cols-2 gap-5 md:grid-cols-4">
              {SAMPLES.map((project) => (
                <figure key={project.design.template}>
                  <div className="relative aspect-[4/5] overflow-hidden rounded-lg shadow-card ring-1 ring-black/5">
                    <FitSlide project={project} slide={project.slides[0]} index={0} brand={SAMPLE_BRAND} className="absolute inset-0" />
                  </div>
                  <figcaption className="mt-2 text-sm text-muted">{TEMPLATES[project.design.template].label}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* brand setup */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-8 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold tracking-wide text-accent uppercase">Your brand</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Set it up once. Use it everywhere.</h2>
            <p className="mt-3 text-muted">A short questionnaire on your first sign-in teaches Aurea how you post.</p>
            <ul className="mt-6 space-y-3 text-sm text-ink">
              {[
                "Upload your logo and profile photo",
                "Brand colors extracted from your logo automatically",
                "Tell us your platforms, content, audience, and tone",
                "Every draft uses your voice and your look",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-6">
            <p className="field-label">Colors from your logo</p>
            <div className="flex gap-2">
              {["#4f46e5", "#f59e0b", "#0b1224", "#e0e7ff"].map((c, i) => (
                <span key={c} className="flex items-center gap-2 rounded-full border border-line py-1 pr-3 pl-1 text-xs text-muted">
                  <span className="h-6 w-6 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                  <span className="hidden font-mono uppercase sm:inline">{c}</span>
                  {i === 0 && <span className="font-medium text-ink">Primary</span>}
                </span>
              ))}
            </div>
            <p className="field-label mt-6">What do you post?</p>
            <div className="flex flex-wrap gap-2">
              {["Educational tips", "Personal stories", "Case studies", "Industry news"].map((c, i) => (
                <span key={c} className={`rounded-full border px-3 py-1 text-sm ${i < 2 ? "border-ink bg-ink text-white" : "border-line text-ink"}`}>
                  {c}
                </span>
              ))}
            </div>
            <p className="field-label mt-6">How should your posts sound?</p>
            <div className="flex flex-wrap gap-2">
              {["Professional", "Friendly", "Bold"].map((c, i) => (
                <span key={c} className={`rounded-full border px-3 py-1 text-sm ${i === 1 ? "border-ink bg-ink text-white" : "border-line text-ink"}`}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* call to action */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-ink px-8 py-14 text-center sm:px-16">
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(circle at 85% 0%, rgba(255,90,60,0.35), transparent 45%), radial-gradient(circle at 0% 100%, rgba(79,70,229,0.3), transparent 45%)" }}
            />
            <h2 className="relative text-3xl font-semibold tracking-tight text-white sm:text-4xl">Your next post is minutes away</h2>
            <p className="relative mx-auto mt-3 max-w-lg text-white/70">Sign in with Google, set up your brand, and create your first carousel today.</p>
            <Link to={cta} className="btn btn-accent btn-lg relative mt-8">
              Get started free <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:px-8">
          <Logo to="/" />
          <div className="flex gap-6">
            <a href="#features" className="hover:text-ink">
              Features
            </a>
            <a href="#templates" className="hover:text-ink">
              Templates
            </a>
            <Link to="/signin" className="hover:text-ink">
              Sign in
            </Link>
          </div>
          <p className="text-xs text-subtle">&copy; {new Date().getFullYear()} Aurea Studio</p>
        </div>
      </footer>
    </div>
  );
}
