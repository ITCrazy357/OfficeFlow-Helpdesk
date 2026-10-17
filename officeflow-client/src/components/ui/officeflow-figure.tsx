"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/components/ui/utils";

type Figure = "hub" | "drawer" | "loupe" | "cabinet";

/** Decorative Hairline figures load on approach and never autoplay in a work queue. */
export function OfficeFlowFigure({ kind = "hub", className }: { kind?: Figure; className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let figure: { destroy(): void; update(options: { intensity: number }): void } | undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      element.inert = media.matches;
      element.style.pointerEvents = media.matches ? "none" : "";
      figure?.update({ intensity: media.matches ? 0 : 0.35 });
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      void import("@lucasmarkes/hairline").then((library) => {
        if (disposed) return;
        figure = library[kind](element, { intensity: media.matches ? 0 : 0.35, play: false });
        updateMotion();
      }).catch(() => { /* The reserved illustration space is optional. */ });
    }, { rootMargin: "120px" });
    observer.observe(element);
    media.addEventListener("change", updateMotion);
    updateMotion();
    return () => {
      disposed = true;
      observer.disconnect();
      media.removeEventListener("change", updateMotion);
      figure?.destroy();
    };
  }, [kind]);

  return <div ref={host} aria-hidden="true" className={cn("officeflow-figure", className)} />;
}
