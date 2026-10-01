import { useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import { useBrandKits } from "../../lib/brandkits";
import { deleteItem, saveItem, useItems } from "../../lib/items";
import { useToast } from "../Toast";

// Which brand kit (logo, colors, name) this project uses.
export function BrandKitSelect({ project, onDesign }) {
  const kits = useBrandKits();
  if (kits.length < 2) return null;
  const current = project.design.brandKitId || "primary";
  return (
    <select
      className="input"
      value={current}
      onChange={(e) => {
        const kit = kits.find((k) => k.id === e.target.value);
        onDesign({ brandKitId: kit.id, accent: kit.accent, ...(kit.font !== "auto" ? { font: kit.font } : {}) });
      }}
    >
      {kits.map((k) => (
        <option key={k.id} value={k.id}>
          {k.kit_name}
          {k.name ? ` (${k.name})` : ""}
        </option>
      ))}
    </select>
  );
}

const PRESET_KEYS = ["template", "accent", "font", "align", "showBrand", "showNumbers", "showArrow", "showCta"];

// Save the current design as a reusable template, or apply a saved one.
export function SavedTemplates({ project, onDesign }) {
  const toast = useToast();
  const { items: presets } = useItems("preset");
  const [name, setName] = useState("");

  async function save() {
    const design = Object.fromEntries(PRESET_KEYS.map((k) => [k, project.design[k]]));
    try {
      await saveItem("preset", { name: name.trim(), design });
      setName("");
      toast("Template saved");
    } catch (err) {
      toast(err.message, { tone: "error" });
    }
  }

  return (
    <div className="space-y-3">
      {presets.length > 0 && (
        <div className="space-y-1">
          {presets.map((p) => (
            <div key={p.id} className="group flex items-center gap-2 rounded-lg border border-line px-2 py-1.5">
              <span className="h-5 w-5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: p.design.accent }} />
              <button type="button" className="min-w-0 flex-1 truncate text-left text-sm text-ink hover:underline" onClick={() => onDesign(p.design)}>
                {p.name}
              </button>
              <button
                type="button"
                className="text-subtle opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                onClick={() => deleteItem("preset", p.id).catch((err) => toast(err.message, { tone: "error" }))}
                aria-label={`Delete ${p.name}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input className="input" placeholder="Name this design" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && save()} />
        <button type="button" className="btn btn-secondary shrink-0" disabled={!name.trim()} onClick={save}>
          <Bookmark size={14} /> Save
        </button>
      </div>
    </div>
  );
}
