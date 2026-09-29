import { GalleryHorizontalEnd, Image, RectangleVertical } from "lucide-react";

export const SIZES = {
  portrait: { id: "portrait", label: "Portrait", ratio: "4:5", w: 1080, h: 1350, hint: "Instagram and LinkedIn feed" },
  square: { id: "square", label: "Square", ratio: "1:1", w: 1080, h: 1080, hint: "Works everywhere" },
  story: { id: "story", label: "Story", ratio: "9:16", w: 1080, h: 1920, hint: "Stories, Reels, TikTok" },
  landscape: { id: "landscape", label: "Landscape", ratio: "16:9", w: 1200, h: 675, hint: "X, YouTube, link previews" },
  poster: { id: "poster", label: "Poster", ratio: "A4", w: 1240, h: 1754, hint: "Print and PDF handouts" },
};

// `platform` is the backend pipeline profile used when generating with AI:
// it decides slide count (LinkedIn = 6-slide carousel, the others = one page).
export const KINDS = {
  carousel: {
    id: "carousel",
    label: "Carousel",
    icon: GalleryHorizontalEnd,
    description: "A swipeable multi-slide story",
    platform: "linkedin",
    defaultSize: "portrait",
    sizes: ["portrait", "square", "story"],
  },
  poster: {
    id: "poster",
    label: "Poster",
    icon: RectangleVertical,
    description: "One bold page for announcements and quotes",
    platform: "instagram",
    defaultSize: "portrait",
    sizes: ["portrait", "square", "story", "poster"],
  },
  image: {
    id: "image",
    label: "Image",
    icon: Image,
    description: "A landscape graphic for X, blogs and links",
    platform: "x",
    defaultSize: "landscape",
    sizes: ["landscape", "square", "portrait"],
  },
};

export function sizeOf(project) {
  return SIZES[project.size] ?? SIZES.portrait;
}

export const SLIDE_LIMIT = 20;
