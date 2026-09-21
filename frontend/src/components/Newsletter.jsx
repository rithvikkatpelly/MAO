import { RefreshCw, Users, Star, MessageCircle } from "lucide-react";

const PERKS = [
  { icon: RefreshCw, title: "Reliable Updates", desc: "New agents and templates shipped regularly." },
  { icon: Users, title: "Built for Teams", desc: "Share brand context across your whole workspace." },
  { icon: Star, title: "5-Star Support", desc: "Real help from people who build the agents." },
  { icon: MessageCircle, title: "We Listen", desc: "Feature requests shape the roadmap." },
];

export default function Newsletter() {
  return (
    <section className="bg-navy-950 py-24 text-white">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Get early access to Aurea Studio
        </h2>
        <p className="mx-auto mt-3 max-w-md text-white/70">
          Join the waitlist for updates on new agents, templates, and
          integrations.
        </p>

        <form
          className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="email"
            required
            placeholder="Enter your email address"
            className="w-full rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm text-white placeholder:text-white/40 focus:border-coral-500 focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-coral-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-coral-600"
          >
            Subscribe
          </button>
        </form>

        <div className="mt-16 grid grid-cols-2 gap-8 border-t border-white/10 pt-14 sm:grid-cols-4">
          {PERKS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col items-center text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-coral-500">
                <Icon size={18} />
              </span>
              <h3 className="mt-4 text-sm font-semibold">{title}</h3>
              <p className="mt-1 text-xs text-white/50">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
