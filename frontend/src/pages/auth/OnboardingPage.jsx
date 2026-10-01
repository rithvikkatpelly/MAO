import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Logo } from "../../components/AppShell";
import { BrandColors, ImageDrop, MarkChooser } from "../../components/brand";
import { ChoiceChips } from "../../components/controls";
import { SlideFrame } from "../../components/SlideFrame";
import { useToast } from "../../components/Toast";
import { updateProfile, useAuth } from "../../lib/auth";
import { makeSlide } from "../../lib/project";
import { DEFAULT_BRAND } from "../../lib/storage";

const ROLES = ["Creator", "Founder", "Marketer", "Coach or consultant", "Agency", "Small business"];
const PLATFORMS = ["LinkedIn", "Instagram", "X", "Threads", "TikTok", "YouTube", "Facebook", "Pinterest"];
const FREQUENCIES = ["Daily", "A few times a week", "Weekly", "A few times a month", "Just getting started"];
const CONTENT_TYPES = [
  "Educational tips",
  "How-to guides",
  "Personal stories",
  "Industry news",
  "Opinions and hot takes",
  "Case studies",
  "Product updates",
  "Behind the scenes",
  "Quotes and motivation",
  "Promotions and launches",
];
const FORMATS = ["Carousels", "Single image posts", "Posters and announcements", "Landscape images", "Stories"];
const TONES = ["Professional", "Friendly", "Bold", "Playful", "Inspirational", "Educational"];
const GOALS = ["Grow my audience", "Build authority", "Generate leads", "Drive sales", "Build a community", "Promote events"];

// A starting template that suits the voice they picked; changeable any time.
const TEMPLATE_FOR_TONE = {
  Professional: "midnight",
  Friendly: "minimal",
  Bold: "bold",
  Playful: "gradient",
  Inspirational: "quote",
  Educational: "grid",
};

const STEPS = [
  { title: "Tell us about you", subtitle: "This shows on your posts. You can change it later in your brand kit." },
  { title: "Your brand", subtitle: "Upload your logo and we will pull your brand colors from it." },
  { title: "Your social media", subtitle: "Where you post and who you are talking to." },
  { title: "Your content", subtitle: "So every draft sounds like you and fits what you already post." },
];

const EMPTY_SOCIAL = {
  role: "",
  platforms: [],
  primary_platform: "",
  profile_url: "",
  audience: "",
  frequency: "",
  content_types: [],
  formats: [],
  tone: "",
  goals: [],
  niche: "",
  avoid_words: [],
  example_posts: [],
};

function Question({ label, hint, children, optional }) {
  return (
    <div>
      <p className="text-sm font-medium text-ink">
        {label} {optional && <span className="font-normal text-subtle">(optional)</span>}
      </p>
      {hint && <p className="mt-0.5 text-xs text-subtle">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Preview({ brand }) {
  const project = useMemo(
    () => ({
      kind: "carousel",
      size: "portrait",
      cta: "Follow for more",
      slides: [makeSlide({ kicker: "Your first post", headline: "Every post, on brand, in minutes", body: "Your colors, your mark, and your voice on every slide." })],
      design: {
        template: brand.template === "auto" ? "midnight" : brand.template,
        accent: brand.accent,
        font: brand.font,
        align: "left",
        showBrand: true,
        showNumbers: false,
        showArrow: false,
        showCta: false,
      },
    }),
    [brand.template, brand.accent, brand.font],
  );
  return (
    <div className="flex flex-col items-center">
      <SlideFrame project={project} slide={project.slides[0]} index={0} brand={brand} width={300} className="rounded-md shadow-pop" />
      <p className="mt-4 text-xs text-subtle">Live preview</p>
    </div>
  );
}

export default function OnboardingPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [brand, setBrand] = useState(() => {
    const saved = { ...DEFAULT_BRAND, ...profile?.brand };
    return {
      ...saved,
      name: profile?.brand?.name || user?.name || "",
      handle: saved.handle === DEFAULT_BRAND.handle ? "" : saved.handle,
      mark: saved.logo ? saved.mark : saved.avatar ? "avatar" : "initials",
    };
  });
  const [social, setSocial] = useState(() => ({ ...EMPTY_SOCIAL, ...profile?.social }));

  const setB = (patch) => setBrand((b) => ({ ...b, ...patch }));
  const setS = (patch) => setSocial((s) => ({ ...s, ...patch }));

  const canContinue = [
    brand.name.trim().length > 0 && social.role,
    true,
    social.platforms.length > 0 && social.niche.trim().length > 0,
    social.content_types.length > 0 && social.tone,
  ][step];

  function withDefaults() {
    const primary = social.primary_platform && social.platforms.includes(social.primary_platform) ? social.primary_platform : social.platforms[0] ?? "";
    const template = brand.template === "auto" && TEMPLATE_FOR_TONE[social.tone] ? TEMPLATE_FOR_TONE[social.tone] : brand.template;
    return {
      brand: { ...brand, name: brand.name.trim(), handle: brand.handle.trim(), template },
      social: { ...social, primary_platform: primary, profile_url: social.profile_url.trim(), audience: social.audience.trim(), niche: social.niche.trim() },
    };
  }

  async function next() {
    const last = step === STEPS.length - 1;
    const payload = withDefaults();
    if (!last) {
      setStep(step + 1);
      updateProfile(payload).catch(() => {}); // progress autosave; the final step retries
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ ...payload, onboarded: true });
      toast("Your brand is ready");
      navigate("/app/new", { replace: true });
    } catch (err) {
      toast(`Could not save: ${err.message}`, { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo to="/" />
        <Link to="/signout" className="text-xs text-muted hover:text-ink">
          Sign out
        </Link>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 sm:px-8 lg:grid-cols-[1fr_360px]">
        <main className="card p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted">
              Step {step + 1} of {STEPS.length}
            </span>
            <div className="flex flex-1 gap-1.5">
              {STEPS.map((_, i) => (
                <span key={i} className={`h-1 flex-1 rounded-full transition ${i <= step ? "bg-accent" : "bg-ink/10"}`} />
              ))}
            </div>
          </div>

          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink">{STEPS[step].title}</h1>
          <p className="mt-1 text-sm text-muted">{STEPS[step].subtitle}</p>

          <div key={step} className="animate-fade-in mt-8 space-y-8">
            {step === 0 && (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Question label="Name on your posts">
                    <input className="input" value={brand.name} maxLength={60} onChange={(e) => setB({ name: e.target.value })} placeholder="Your name or brand" />
                  </Question>
                  <Question label="Handle" optional>
                    <input className="input" value={brand.handle} maxLength={40} onChange={(e) => setB({ handle: e.target.value })} placeholder="@yourhandle" />
                  </Question>
                </div>
                <Question label="Profile photo" optional>
                  <ImageDrop kind="avatar" value={brand.avatar} onChange={({ dataUrl }) => setB({ avatar: dataUrl, mark: brand.logo ? brand.mark : "avatar" })} onRemove={() => setB({ avatar: "", mark: brand.mark === "avatar" ? "initials" : brand.mark })} />
                </Question>
                <Question label="Which best describes you?">
                  <ChoiceChips options={ROLES} value={social.role} onChange={(role) => setS({ role })} />
                </Question>
              </>
            )}

            {step === 1 && (
              <>
                <Question label="Logo" optional hint="Skip this if you post under your own name. You can add it later.">
                  <ImageDrop
                    kind="logo"
                    value={brand.logo}
                    onChange={({ dataUrl, palette }) =>
                      setB({ logo: dataUrl, palette, accent: palette[0] ?? brand.accent, secondary: palette[1] ?? "", mark: "logo" })
                    }
                    onRemove={() => setB({ logo: "", palette: [], mark: brand.avatar ? "avatar" : "initials" })}
                  />
                </Question>
                <Question label="Brand colors">
                  <BrandColors palette={brand.palette} accent={brand.accent} secondary={brand.secondary} onChange={setB} />
                </Question>
                <Question label="Show on your slides">
                  <MarkChooser brand={brand} onChange={(mark) => setB({ mark })} />
                </Question>
              </>
            )}

            {step === 2 && (
              <>
                <Question label="Where do you post?" hint="Pick all that apply.">
                  <ChoiceChips multiple options={PLATFORMS} value={social.platforms} onChange={(platforms) => setS({ platforms })} />
                </Question>
                {social.platforms.length > 1 && (
                  <Question label="Your main platform">
                    <ChoiceChips options={social.platforms} value={social.primary_platform} onChange={(primary_platform) => setS({ primary_platform })} />
                  </Question>
                )}
                <Question label="What is your niche?" hint="What you post about, in a few words. Trend watch uses this too.">
                  <input className="input" maxLength={120} value={social.niche} onChange={(e) => setS({ niche: e.target.value })} placeholder="e.g. personal finance for freelancers" />
                </Question>
                <Question label="Link to your main profile" optional>
                  <input className="input" type="url" value={social.profile_url} maxLength={300} onChange={(e) => setS({ profile_url: e.target.value })} placeholder="https://www.linkedin.com/in/you" />
                </Question>
                <Question label="Who is your audience?" optional hint="For example: early stage founders, new runners, small bakery owners.">
                  <textarea className="input resize-none" rows={2} maxLength={300} value={social.audience} onChange={(e) => setS({ audience: e.target.value })} />
                </Question>
                <Question label="How often do you post?" optional>
                  <ChoiceChips options={FREQUENCIES} value={social.frequency} onChange={(frequency) => setS({ frequency })} />
                </Question>
              </>
            )}

            {step === 3 && (
              <>
                <Question label="What kind of content do you post?" hint="Pick up to five.">
                  <ChoiceChips multiple max={5} options={CONTENT_TYPES} value={social.content_types} onChange={(content_types) => setS({ content_types })} />
                </Question>
                <Question label="Which formats do you use most?" optional>
                  <ChoiceChips multiple options={FORMATS} value={social.formats} onChange={(formats) => setS({ formats })} />
                </Question>
                <Question label="How should your posts sound?">
                  <ChoiceChips options={TONES} value={social.tone} onChange={(tone) => setS({ tone })} />
                </Question>
                <Question label="What are your goals?" optional>
                  <ChoiceChips multiple options={GOALS} value={social.goals} onChange={(goals) => setS({ goals })} />
                </Question>
                <Question label="Words you never use" optional hint="Separate with commas. The AI will avoid them.">
                  <input
                    className="input"
                    placeholder="e.g. synergy, hustle, game changer"
                    defaultValue={social.avoid_words.join(", ")}
                    onBlur={(e) => setS({ avoid_words: e.target.value.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean).slice(0, 30) })}
                  />
                </Question>
                <Question label="Paste a post you are proud of" optional hint="The AI learns your voice from it. It never copies it.">
                  <textarea
                    className="input resize-y"
                    rows={4}
                    maxLength={2000}
                    value={social.example_posts[0] ?? ""}
                    onChange={(e) => setS({ example_posts: e.target.value.trim() ? [e.target.value, ...social.example_posts.slice(1)] : social.example_posts.slice(1) })}
                  />
                </Question>
              </>
            )}
          </div>

          <div className="mt-10 flex items-center gap-2 border-t border-line pt-6">
            {step > 0 && (
              <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>
                <ArrowLeft size={15} /> Back
              </button>
            )}
            {step === 1 && (
              <button className="btn btn-ghost ml-auto" onClick={next}>
                Skip for now
              </button>
            )}
            <button className={`btn btn-accent btn-lg ${step === 1 ? "" : "ml-auto"}`} disabled={!canContinue || saving} onClick={next}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : step === STEPS.length - 1 ? <Check size={16} /> : null}
              {step === STEPS.length - 1 ? "Finish and start creating" : "Continue"}
              {step < STEPS.length - 1 && <ArrowRight size={16} />}
            </button>
          </div>
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-8">
            <Preview brand={brand} />
          </div>
        </aside>
      </div>
    </div>
  );
}
