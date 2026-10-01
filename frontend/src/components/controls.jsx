import { useState } from "react";
import { Check, X } from "lucide-react";
import { ACCENT_SWATCHES, isHex } from "../lib/color";
import { cleanHashtag } from "../lib/text";

export function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1.5">
      <span>
        <span className="block text-sm text-ink">{label}</span>
        {description && <span className="block text-xs text-subtle">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-ink" : "bg-ink/15"}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? "translate-x-4" : ""}`} />
      </button>
    </label>
  );
}

export function Segmented({ value, onChange, options, size = "md" }) {
  return (
    <div className="flex rounded-lg bg-ink/[0.05] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          title={o.title}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md font-medium transition ${
            size === "sm" ? "h-7 text-xs" : "h-8 text-sm"
          } ${value === o.value ? "bg-white text-ink shadow-card" : "text-muted hover:text-ink"}`}
        >
          {o.icon && <o.icon size={14} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ColorPicker({ value, onChange }) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setDraft(value);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {ACCENT_SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Use color ${c}`}
            className={`flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 transition hover:scale-110 ${
              value.toLowerCase() === c ? "ring-2 ring-ink" : ""
            }`}
            style={{ background: c }}
          >
            {value.toLowerCase() === c && <Check size={13} className="text-white mix-blend-difference" strokeWidth={3} />}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-line" style={{ background: value }}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom color" />
        </label>
        <input
          className="input font-mono uppercase"
          value={draft}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
            setDraft(v);
            if (isHex(v)) onChange(v.toLowerCase());
          }}
          onBlur={() => setDraft(value)}
        />
      </div>
    </div>
  );
}

export function TagInput({ value, onChange, placeholder = "Add a hashtag" }) {
  const [draft, setDraft] = useState("");

  function commit(raw) {
    const tags = raw.split(/[\s,]+/).map(cleanHashtag).filter(Boolean);
    const next = [...new Set([...value, ...tags])];
    if (next.length !== value.length) onChange(next);
    setDraft("");
  }

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-white p-1.5 focus-within:border-ink/40 focus-within:ring-4 focus-within:ring-ink/5">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-paper py-0.5 pr-1 pl-2 text-xs font-medium text-ink">
          #{tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} className="rounded text-subtle hover:text-ink" aria-label={`Remove ${tag}`}>
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "," || e.key === " ") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft && commit(draft)}
        placeholder={value.length ? "" : placeholder}
        className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-subtle"
      />
    </div>
  );
}

export function CharCount({ value, limit }) {
  const over = limit && value.length > limit;
  return (
    <span className={`text-[11px] tabular-nums ${over ? "font-medium text-red-600" : "text-subtle"}`}>
      {value.length}
      {limit ? ` / ${limit}` : ""}
    </span>
  );
}

// Textarea that grows with its content.
export function AutoTextarea({ className = "", minRows = 2, ...props }) {
  return (
    <textarea
      {...props}
      rows={minRows}
      className={`input resize-none [field-sizing:content] ${className}`}
      style={{ minHeight: `${minRows * 1.5 + 1}rem` }}
    />
  );
}

// Pill choices. `multiple` makes value an array; otherwise a single string.
export function ChoiceChips({ options, value, onChange, multiple = false, max }) {
  const selected = multiple ? value : [value];
  function toggle(option) {
    if (!multiple) return onChange(option === value ? "" : option);
    if (value.includes(option)) return onChange(value.filter((v) => v !== option));
    if (max && value.length >= max) return;
    onChange([...value, option]);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(option)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition ${
              active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/30"
            }`}
          >
            {active && multiple && <Check size={13} strokeWidth={2.5} />}
            {option}
          </button>
        );
      })}
    </div>
  );
}
