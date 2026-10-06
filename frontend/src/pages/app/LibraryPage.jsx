import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarClock, Copy, FolderOpen, Loader2, MoreHorizontal, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../../components/Dialog";
import { Menu } from "../../components/Menu";
import { FitSlide } from "../../components/SlideFrame";
import { Segmented } from "../../components/controls";
import { useToast } from "../../components/Toast";
import { resolveBrand, useBrandKits } from "../../lib/brandkits";
import { KINDS, STUDIO_FORMATS, TEXT_FORMATS, isStudioKind, kindMeta, sizeOf } from "../../lib/formats";
import { outputToText } from "../../lib/outputs";
import { blankProject, blankStudioProject } from "../../lib/project";
import { deleteProject, duplicateProject, insertProject, useBrand, useProjectsState } from "../../lib/storage";
import { relativeTime } from "../../lib/time";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "carousel", label: "Carousels" },
  { value: "poster", label: "Posters" },
  { value: "image", label: "Images" },
  { value: "thumbnail", label: "Thumbnails" },
  { value: "deck", label: "Slides" },
  { value: "infographic", label: "Infographics" },
  { value: "text", label: "Text" },
];

function TextThumb({ project }) {
  const format = TEXT_FORMATS[project.textFormat] ?? TEXT_FORMATS.linkedin_post;
  const text = outputToText(project.textFormat, project.outputs?.[project.textFormat]);
  return (
    <div className="absolute inset-4 overflow-hidden rounded-md bg-white p-4 shadow-card">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-accent">
        <format.icon size={12} /> {format.label}
      </p>
      <p className="mt-2 line-clamp-6 text-xs leading-relaxed whitespace-pre-line text-muted">{text || "Nothing written yet."}</p>
    </div>
  );
}

function ProjectCard({ project, brand, onDelete }) {
  const navigate = useNavigate();
  const toast = useToast();
  const isText = project.kind === "text";
  const kind = isText ? TEXT_FORMATS[project.textFormat] ?? TEXT_FORMATS.linkedin_post : kindMeta(project.kind);
  const size = sizeOf(project);

  return (
    <div className="group card relative overflow-hidden transition hover:shadow-pop">
      <Link to={isStudioKind(project.kind) ? `/app/visual/${project.id}` : `/app/p/${project.id}`} className="block" aria-label={`Open ${project.title}`}>
        <div className="bg-dots relative aspect-[4/3] border-b border-line">
          {isText ? (
            <TextThumb project={project} />
          ) : (
            <FitSlide project={project} slide={project.slides[0]} index={0} brand={brand} padding={18} className="absolute inset-0" frameClassName="rounded-md shadow-card" />
          )}
          {project.scheduledAt && (
            <span className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-medium text-ink shadow-card backdrop-blur">
              <CalendarClock size={11} className="text-accent" />
              {new Date(project.scheduledAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
          {!isText && project.slides.length > 1 && (
            <span className="absolute bottom-2.5 left-2.5 rounded-md bg-ink/80 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
              {project.slides.length} {project.kind === "infographic" ? "pages" : "slides"}
            </span>
          )}
        </div>
        <div className="px-4 py-3">
          <p className="truncate pr-8 text-sm font-medium text-ink">{project.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-subtle">
            <kind.icon size={12} />
            {kind.label}
            {!isText && (
              <>
                <span aria-hidden>·</span>
                {size.ratio}
              </>
            )}
            <span aria-hidden>·</span>
            Edited {relativeTime(project.updatedAt)}
          </p>
        </div>
      </Link>
      <div className="absolute right-2 bottom-2.5">
        <Menu
          trigger={({ toggle, open }) => (
            <button
              onClick={toggle}
              className={`btn btn-ghost btn-icon transition ${open ? "bg-ink/5 text-ink" : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100"}`}
              aria-label="Project actions"
            >
              <MoreHorizontal size={16} />
            </button>
          )}
          width="w-44"
          items={[
            { label: "Open", icon: FolderOpen, onClick: () => navigate(`/app/p/${project.id}`) },
            {
              label: "Duplicate",
              icon: Copy,
              onClick: () => {
                try {
                  duplicateProject(project.id);
                  toast("Project duplicated");
                } catch (err) {
                  toast(err.message, { tone: "error" });
                }
              },
            },
            "divider",
            { label: "Delete", icon: Trash2, danger: true, onClick: () => onDelete(project) },
          ]}
        />
      </div>
    </div>
  );
}

function QuickStart() {
  const navigate = useNavigate();
  const brand = useBrand();
  const toast = useToast();

  function startBlank(kind) {
    try {
      const studio = isStudioKind(kind);
      const project = insertProject(studio ? blankStudioProject(kind, brand) : blankProject(kind, brand));
      navigate(studio ? `/app/visual/${project.id}` : `/app/p/${project.id}`);
    } catch (err) {
      toast(err.message, { tone: "error" });
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Link to="/app/new" className="group flex flex-col justify-between rounded-2xl bg-ink p-4 text-white transition hover:bg-navy-800 md:col-span-1">
        <Sparkles size={18} className="text-accent" />
        <div className="mt-8">
          <p className="text-sm font-semibold">Create with AI</p>
          <p className="mt-0.5 text-xs text-white/60">Research, write, and design</p>
        </div>
      </Link>
      {[...Object.values(KINDS), ...Object.values(STUDIO_FORMATS)].map((kind) => (
        <button key={kind.id} onClick={() => startBlank(kind.id)} className="card flex flex-col justify-between p-4 text-left transition hover:border-ink/20 hover:shadow-pop">
          <kind.icon size={18} className="text-muted" />
          <div className="mt-8">
            <p className="text-sm font-semibold text-ink">Blank {kind.label.toLowerCase()}</p>
            <p className="mt-0.5 text-xs text-subtle">{kind.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function LibraryPage() {
  const { status, items: projects } = useProjectsState();
  const kits = useBrandKits();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [pendingDelete, setPendingDelete] = useState(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter(
      (p) => (filter === "all" || p.kind === filter) && (!q || p.title.toLowerCase().includes(q) || p.slides.some((s) => s.headline.toLowerCase().includes(q))),
    );
  }, [projects, query, filter]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Projects</h1>
          <p className="mt-1 text-sm text-muted">Carousels, posters, and images you have made.</p>
        </div>
        <Link to="/app/new" className="btn btn-primary">
          <Plus size={16} /> New project
        </Link>
      </div>

      <div className="mt-8">
        <QuickStart />
      </div>

      {projects.length > 0 && (
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative sm:w-72">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" className="input pl-9" aria-label="Search projects" />
          </div>
          <div className="sm:w-[34rem]">
            <Segmented value={filter} onChange={setFilter} options={FILTERS} size="sm" />
          </div>
        </div>
      )}

      {status === "loading" ? (
        <div className="mt-16 flex justify-center text-subtle">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Sparkles size={20} />
          </span>
          <h2 className="mt-4 text-base font-semibold text-ink">No projects yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Describe a topic and Aurea will research it, write the copy, and design ready-to-post slides.
          </p>
          <Link to="/app/new" className="btn btn-accent mt-6">
            <Sparkles size={15} /> Create your first post
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted">No projects match your search.</p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => (
            <ProjectCard key={p.id} project={p} brand={resolveBrand(kits, p.design?.brandKitId)} onDelete={setPendingDelete} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this project?"
        description={pendingDelete ? `"${pendingDelete.title}" will be removed permanently.` : ""}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          deleteProject(pendingDelete.id);
          setPendingDelete(null);
          toast("Project deleted");
        }}
      />
    </div>
  );
}
