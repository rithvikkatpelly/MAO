import { Sparkles } from "lucide-react";

const SOCIALS = [
  {
    label: "GitHub",
    path: "M12 .5C5.73.5.98 5.24.98 11.52c0 4.94 3.2 9.13 7.65 10.6.56.1.76-.24.76-.54 0-.27-.01-1.15-.02-2.1-3.11.68-3.77-1.32-3.77-1.32-.5-1.28-1.23-1.62-1.23-1.62-1-.7.08-.68.08-.68 1.1.08 1.68 1.14 1.68 1.14.99 1.68 2.58 1.2 3.21.92.1-.72.38-1.2.7-1.47-2.48-.28-5.1-1.24-5.1-5.53 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.1-2.96 0 0 .95-.3 3.1 1.15a10.8 10.8 0 0 1 5.65 0c2.15-1.45 3.1-1.15 3.1-1.15.6 1.54.22 2.68.1 2.96.72.78 1.15 1.78 1.15 3 0 4.3-2.62 5.24-5.12 5.52.4.35.75 1.03.75 2.08 0 1.5-.01 2.71-.01 3.08 0 .3.2.65.76.54A11.03 11.03 0 0 0 23.02 11.5C23.02 5.24 18.27.5 12 .5Z",
  },
  {
    label: "X",
    path: "M18.24 2h3.4l-7.43 8.49L23 22h-6.85l-5.36-7.02L4.6 22H1.2l7.95-9.08L1 2h7.02l4.85 6.42L18.24 2Zm-1.2 18h1.88L7.05 3.9H5.03L17.04 20Z",
  },
  {
    label: "LinkedIn",
    path: "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM.5 8.98h4.96V23H.5V8.98ZM8.98 8.98h4.75v1.92h.07c.66-1.25 2.27-2.57 4.67-2.57 5 0 5.92 3.29 5.92 7.57V23h-4.96v-6.36c0-1.52-.03-3.47-2.11-3.47-2.12 0-2.44 1.65-2.44 3.36V23H8.98V8.98Z",
  },
];

const COLUMNS = [
  {
    title: "Product",
    links: ["Features", "Templates", "Pricing", "Changelog"],
  },
  {
    title: "Resources",
    links: ["Documentation", "API Reference", "Support", "Status"],
  },
  {
    title: "Company",
    links: ["About", "Blog", "Careers", "Contact"],
  },
];

export default function Footer() {
  return (
    <footer className="bg-navy-950 pb-10 pt-16 text-white">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-10 border-b border-white/10 pb-12 sm:grid-cols-5">
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-coral-500 text-white">
                <Sparkles size={18} />
              </span>
              <span className="text-lg font-bold">Aurea Studio</span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-white/50">
              An agentic AI content studio. Research, create, and download
              beautiful carousels.
            </p>
            <div className="mt-5 flex gap-3">
              {SOCIALS.map(({ label, path }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d={path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-white/90">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-white/50 transition hover:text-white"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="pt-8 text-center text-xs text-white/40">
          © {new Date().getFullYear()} Aurea Studio. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
