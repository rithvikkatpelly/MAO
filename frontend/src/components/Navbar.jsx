import { Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

const LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#workflow" },
  { label: "Templates", href: "#templates" },
  { label: "Stack", href: "#stack" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-navy-950/5 bg-cream-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-coral-500 text-white">
            <Sparkles size={18} />
          </span>
          <span className="text-lg font-bold tracking-tight">Aurea Studio</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-navy-800/70 transition hover:text-navy-950"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href="#docs"
            className="text-sm font-semibold text-navy-800/70 hover:text-navy-950"
          >
            Documentation
          </a>
          <a
            href="#support"
            className="text-sm font-semibold text-navy-800/70 hover:text-navy-950"
          >
            Support
          </a>
          <Link
            to="/app"
            className="rounded-full bg-coral-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-coral-500/30 transition hover:bg-coral-600"
          >
            Start Free
          </Link>
        </div>

        <button
          className="text-navy-950 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-navy-950/5 bg-cream-50 px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-4">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-navy-800/70"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Link
              to="/app"
              className="mt-2 rounded-full bg-coral-500 px-5 py-2.5 text-center text-sm font-semibold text-white"
              onClick={() => setOpen(false)}
            >
              Start Free
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
