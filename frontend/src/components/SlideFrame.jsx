import { useLayoutEffect, useRef, useState } from "react";
import { sizeOf } from "../lib/formats";
import { SlideCanvas } from "../lib/templates";

// A slide scaled down to `width` px, keeping its native aspect ratio.
export function SlideFrame({ project, slide, index, brand, width, className = "" }) {
  const { w, h } = sizeOf(project);
  const scale = width / w;
  return (
    <div className={`relative shrink-0 overflow-hidden ${className}`} style={{ width, height: h * scale }}>
      <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <SlideCanvas project={project} slide={slide} index={index} brand={brand} />
      </div>
    </div>
  );
}

// A slide scaled to fit inside its parent box (both dimensions).
export function FitSlide({ project, slide, index, brand, padding = 0, className = "", frameClassName = "" }) {
  const ref = useRef(null);
  const [box, setBox] = useState(null);
  const { w, h } = sizeOf(project);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const width = box ? Math.max(40, Math.min(box.width - padding * 2, ((box.height - padding * 2) * w) / h)) : 0;

  return (
    <div ref={ref} className={`flex min-h-0 min-w-0 items-center justify-center ${className}`}>
      {box && <SlideFrame project={project} slide={slide} index={index} brand={brand} width={width} className={frameClassName} />}
    </div>
  );
}
