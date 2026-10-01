import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { ArrowUpRight, CalendarDays, ChartColumn, ChevronsUpDown, ClipboardList, LayoutGrid, Lightbulb, LogOut, Palette, Plus, Sparkles } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useEngineStatus } from "../lib/engine";
import { Menu } from "./Menu";

const NAV = [
  { to: "/app", label: "Projects", icon: LayoutGrid, end: true },
  { to: "/app/new", label: "Create", icon: Plus },
  { to: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/app/ideas", label: "Ideas", icon: Lightbulb },
  { to: "/app/insights", label: "Insights", icon: ChartColumn },
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

function Avatar({ src, name, size = "h-7 w-7" }) {
  return src ? (
    <img src={src} alt="" className={`${size} shrink-0 rounded-full object-cover`} referrerPolicy="no-referrer" />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white`}>
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

function AccountMenu({ compact = false }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const photo = profile?.brand?.avatar || user.picture;

  return (
    <Menu
      align={compact ? "right" : "left"}
      width="w-60"
      up={!compact}
      trigger={({ toggle }) =>
        compact ? (
          <button onClick={toggle} className="rounded-full" aria-label="Account">
            <Avatar src={photo} name={user.name} />
          </button>
        ) : (
          <button onClick={toggle} className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition hover:bg-ink/[0.04]">
            <Avatar src={photo} name={user.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{user.name || "Account"}</span>
              <span className="block truncate text-xs text-subtle">{user.email}</span>
            </span>
            <ChevronsUpDown size={14} className="text-subtle" />
          </button>
        )
      }
      items={[
        { label: "Brand kit", icon: Palette, onClick: () => navigate("/app/brand") },
        { label: "Update questionnaire", icon: ClipboardList, onClick: () => navigate("/onboarding") },
        "divider",
        { label: "Sign out", icon: LogOut, onClick: () => navigate("/signout") },
      ]}
    />
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
        <div className="mt-auto space-y-3 border-t border-line pt-4">
          <div className="space-y-3 px-2.5">
            <EngineBadge />
            <Link to="/" className="flex items-center gap-1 text-xs text-muted hover:text-ink">
              Aurea website <ArrowUpRight size={12} />
            </Link>
          </div>
          <AccountMenu />
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo />
          <div className="flex items-center gap-3">
            <EngineBadge />
            <AccountMenu compact />
          </div>
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
