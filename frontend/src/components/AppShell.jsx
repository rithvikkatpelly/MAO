import { Link, NavLink, Outlet } from "react-router-dom";
import { ArrowUpRight, LayoutGrid, Palette, Plus, Sparkles } from "lucide-react";
import { useEngineStatus } from "../lib/engine";

const NAV = [
  { to: "/app", label: "Projects", icon: LayoutGrid, end: true },
  { to: "/app/new", label: "Create", icon: Plus },
  { to: "/app/brand", label: "Brand kit", icon: Palette },
];

export function Logo({ to = "/app" }) {
  return (
    <Link to={to} className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-white">
        <Sparkles size={15} />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-ink">Aurea Studio</span>
    </Link>
  );
}

function EngineBadge() {
  const { state, model } = useEngineStatus();
  const tone = { online: "bg-emerald-500", offline: "bg-red-500", checking: "bg-amber-400" }[state];
  const label = { online: "AI engine online", offline: "AI engine offline", checking: "Connecting" }[state];
  return (
    <div className="flex items-center gap-2 text-xs text-muted" title={model ? `Model: ${model}` : undefined}>
      <span className="relative flex h-2 w-2">
        {state === "online" && <span className={`absolute inset-0 animate-ping rounded-full ${tone} opacity-40`} />}
        <span className={`relative h-2 w-2 rounded-full ${tone}`} />
      </span>
      {label}
    </div>
  );
}

function NavItem({ to, label, icon: Icon, end, compact }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg text-sm font-medium transition ${compact ? "px-3 py-1.5" : "px-2.5 py-2"} ${
          isActive ? "bg-ink/[0.06] text-ink" : "text-muted hover:bg-ink/[0.04] hover:text-ink"
        }`
      }
    >
      <Icon size={16} />
      {label}
    </NavLink>
  );
}

export default function AppShell() {
  return (
    <div className="min-h-screen bg-paper lg:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-white px-3 py-4 lg:flex">
        <div className="px-2.5 pb-6">
          <Logo />
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
        <div className="mt-auto space-y-3 border-t border-line px-2.5 pt-4">
          <EngineBadge />
          <Link to="/" className="flex items-center gap-1 text-xs text-muted hover:text-ink">
            Aurea website <ArrowUpRight size={12} />
          </Link>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo />
          <EngineBadge />
        </div>
        <nav className="scrollbar-thin flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} compact />
          ))}
        </nav>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
