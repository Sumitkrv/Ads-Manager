import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ProductTour as ProductTourDefinition } from "../onboarding/tours";
import { saveProductTourProgress } from "../api/onboarding";

type Props = {
  tour: ProductTourDefinition;
  workspaceId?: string;
  token: string;
  startIndex?: number;
  onSaveProgress?: (input: { tourId: string; stepIndex: number; status: "running" | "skipped" | "completed" }) => Promise<unknown>;
  onClose: () => void;
};
type Position = { top: number; left: number; width: number; height: number };

const targetSelector = (id: string) => '[data-tour-id="' + id + '"]';
function visibleTarget(id: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(targetSelector(id))).find((element) => element.getClientRects().length > 0) ?? null;
}
function reducedMotion(): boolean {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return true; }
}

export function ProductTour({ tour, workspaceId, token, startIndex = 0, onSaveProgress, onClose }: Props) {
  const [stepIndex, setStepIndex] = useState(Math.min(startIndex, tour.steps.length - 1));
  const [position, setPosition] = useState<Position | null>(null);
  const [notice, setNotice] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const originalFocus = useRef<HTMLElement | null>(null);
  const sequence = useRef(0);
  const step = tour.steps[stepIndex] ?? { target: "", title: tour.title, body: "" };
  const motionReduced = reducedMotion();

  const save = useCallback((index: number, status: "running" | "skipped" | "completed") => {
    const request = onSaveProgress
      ? onSaveProgress({ tourId: tour.id, stepIndex: index, status })
      : workspaceId
        ? saveProductTourProgress(token, { tourId: tour.id, workspaceId, stepIndex: index, status })
        : Promise.reject(new Error("Tour progress storage is unavailable."));
    void request
      .catch(() => setNotice("Tour progress could not sync. The walkthrough remains usable."));
  }, [onSaveProgress, token, tour.id, workspaceId]);

  const skip = useCallback(() => {
    save(stepIndex, "skipped");
    onClose();
  }, [onClose, save, stepIndex]);

  const finish = useCallback(() => {
    save(stepIndex, "completed");
    onClose();
  }, [onClose, save, stepIndex]);

  const advance = useCallback((direction: number) => {
    const next = stepIndex + direction;
    if (next < 0) return;
    if (next >= tour.steps.length) { finish(); return; }
    setNotice("");
    setStepIndex(next);
    save(next, "running");
  }, [finish, save, stepIndex, tour.steps.length]);

  useEffect(() => {
    originalFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    save(stepIndex, "running");
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      originalFocus.current?.focus({ preventScroll: true });
    };
    // A new overlay instance is a new tour run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    let active = true;
    let retries = 0;
    const currentSequence = ++sequence.current;
    const locate = () => {
      if (!active || currentSequence !== sequence.current) return;
      const element = visibleTarget(step.target);
      if (!element) {
        if (retries++ < 5) {
          window.setTimeout(locate, 220);
          return;
        }
        setPosition(null);
        setNotice("This part of the page is unavailable. Moving to the next tour step.");
        window.setTimeout(() => { if (active && currentSequence === sequence.current) advance(1); }, 500);
        return;
      }
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: motionReduced ? "auto" : "smooth" });
      const rect = element.getBoundingClientRect();
      setPosition({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    };
    const update = () => {
      const element = visibleTarget(step.target);
      if (!element) { setPosition(null); return; }
      const rect = element.getBoundingClientRect();
      setPosition({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };
    locate();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      active = false;
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      sequence.current += 1;
    };
  }, [advance, motionReduced, step.target]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); skip(); }
      else if (event.key === "ArrowRight") { event.preventDefault(); advance(1); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); advance(-1); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [advance, skip]);

  const left = Math.max(16, Math.min(position?.left ?? 16, window.innerWidth - 376));
  const below = (position?.top ?? 0) + (position?.height ?? 0) + 270 < window.innerHeight;
  const top = position ? (below ? position.top + position.height + 14 : Math.max(12, position.top - 250)) : 16;
  return <>
    {position && <div aria-hidden="true" className="pointer-events-none fixed z-[79] rounded-xl border-2 border-electric-bright shadow-[0_0_0_9999px_rgba(4,8,16,.66),0_0_24px_rgba(94,136,255,.55)]" style={{ top: position.top - 4, left: position.left - 4, width: position.width + 8, height: position.height + 8, transition: motionReduced ? "none" : "all 180ms ease-out" }} />}
    <div aria-live="polite" className="sr-only" role="status">{notice}</div>
    <div aria-labelledby="tour-step-title" aria-modal="false" className="fixed z-[80] w-[min(360px,calc(100vw-32px))] rounded-2xl border border-stroke bg-popover text-popover-foreground shadow-2xl" ref={dialogRef} role="dialog" style={{ top, left }}>
      <div className="flex items-center justify-between gap-3 border-b border-stroke px-4 py-3">
        <div><p className="text-[9px] font-semibold tracking-[.16em] text-electric-bright">{tour.title.toUpperCase()}</p><p className="mt-1 text-[10px] text-slate-500">Step {stepIndex + 1} of {tour.steps.length}</p></div>
        <button aria-label="Skip product tour" className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-surface-hover hover:text-foreground" onClick={skip} type="button">Skip</button>
      </div>
      <div className="p-4">
        <h2 className="text-sm font-semibold" id="tour-step-title" ref={headingRef} tabIndex={-1}>{step.title}</h2>
        <p className="mt-2 text-xs leading-5 text-slate-500">{step.body}</p>
        {notice && <p className="mt-3 text-[10px] text-amber-700 dark:text-amber-200">{notice}</p>}
        <div className="mt-5 flex items-center justify-between gap-2">
          <button className="rounded-lg border border-stroke px-3 py-2 text-[11px] text-foreground disabled:opacity-40" disabled={stepIndex === 0} onClick={() => advance(-1)} type="button">Previous</button>
          <div className="flex gap-1.5" aria-hidden="true">{tour.steps.map((item, index) => <span className={"size-1.5 rounded-full " + (index === stepIndex ? "bg-electric-bright" : "bg-slate-600")} key={item.target} />)}</div>
          <button className="rounded-lg bg-electric-bright px-3 py-2 text-[11px] font-semibold text-slate-950 hover:bg-primary-hover" onClick={() => advance(1)} type="button">{stepIndex === tour.steps.length - 1 ? "Finish" : "Next"}</button>
        </div>
      </div>
    </div>
  </>;
}
