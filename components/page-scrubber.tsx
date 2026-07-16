"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from "react";
import { cn } from "@/lib/utils";

type PageScrubberProps = {
  // 0-gebaseerde huidige bladzijde-index en het totaal aantal bladzijdes in het boek.
  current: number;
  total: number;
  // Bladzijde-indices waar een nieuw hoofdstuk begint — getoond als kleine streepjes op de
  // balk, net als de hoofdstuk-markers op een YouTube-voortgangsbalk.
  chapterStartIndices: number[];
  onSeek: (index: number) => void;
  className?: string;
};

// Een sleep-/tikbalk om snel door het hele boek te bladeren, zoals de voortgangsbalk onder een
// video: tik ergens op de balk om er meteen naartoe te springen, of sleep het bolletje. De
// hoofdstuk-streepjes geven een gevoel van "hier begint het volgende stukje verhaal" zonder dat
// het kind de geheime akte-structuur ziet. Bewust met Pointer Events (niet los muis/touch) zodat
// hetzelfde gedrag overal werkt — met touch-none + stopPropagation zodat de swipe-navigatie van
// BookPager niet per ongeluk ook meedoet terwijl je hier aan het slepen bent.
export function PageScrubber({ current, total, chapterStartIndices, onSeek, className }: PageScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || total <= 1) return;
      const rect = track.getBoundingClientRect();
      const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onSeek(Math.round(fraction * (total - 1)));
    },
    [total, onSeek],
  );

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    seekFromClientX(e.clientX);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    seekFromClientX(e.clientX);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    setDragging(false);
  }

  function stopTouch(e: ReactTouchEvent<HTMLDivElement>) {
    e.stopPropagation();
  }

  if (total <= 1) return null;

  const pct = (current / (total - 1)) * 100;

  return (
    <div className={cn("select-none", className)}>
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={stopTouch}
        onTouchEnd={stopTouch}
        role="slider"
        aria-label="Blader door het boek"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current + 1}
        className="relative flex h-6 w-full cursor-pointer touch-none items-center"
      >
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-500/80 via-cyan-500/80 to-primary/90"
            style={{ width: `${pct}%` }}
          />
          {chapterStartIndices.map(
            (idx) =>
              idx > 0 && (
                <span
                  key={idx}
                  className="absolute top-0 h-full w-px bg-background/60"
                  style={{ left: `${(idx / (total - 1)) * 100}%` }}
                />
              ),
          )}
        </div>
        <div
          className={cn(
            "absolute size-4 -translate-x-1/2 rounded-full bg-primary shadow-md ring-2 ring-white transition-transform dark:ring-slate-900",
            dragging && "scale-125",
          )}
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}
