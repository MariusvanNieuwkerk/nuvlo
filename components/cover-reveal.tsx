"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";

export function CoverReveal({
  storyId,
  title,
  heroName,
  coverUrl,
}: {
  storyId: string;
  title: string;
  heroName: string;
  coverUrl: string | null;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [waitingLong, setWaitingLong] = useState(false);

  const makeCover = useCallback(async () => {
    if (coverUrl || inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(`/api/stories/${storyId}/chapters/1/image`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      const url =
        (data.story?.coverUrl as string | null | undefined) ??
        (data.story?.chapters?.[0]?.imageUrl as string | null | undefined);
      if (url) {
        router.refresh();
      } else {
        inFlight.current = false;
      }
    } catch {
      inFlight.current = false;
    }
  }, [coverUrl, router, storyId]);

  useEffect(() => {
    void makeCover();
  }, [makeCover]);

  useEffect(() => {
    if (coverUrl) return;
    const retry = window.setInterval(() => {
      if (!inFlight.current) void makeCover();
    }, 12000);
    const longWait = window.setTimeout(() => setWaitingLong(true), 25000);
    return () => {
      window.clearInterval(retry);
      window.clearTimeout(longWait);
    };
  }, [coverUrl, makeCover]);

  const readHref = `/verhaal/${storyId}/lezen`;

  return (
    <div className="flex flex-col items-center gap-6 sm:gap-8">
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground/50 sm:text-base">Jouw boek</p>
        <h1 className="font-heading text-2xl font-extrabold text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-1 text-base text-foreground/60 sm:text-lg">met {heroName}</p>
      </div>

      <div className="relative aspect-[3/4] w-full max-w-xs overflow-hidden rounded-3xl border-2 border-primary/25 bg-primary/10 shadow-lg sm:max-w-sm">
        {coverUrl ? (
          <Image src={coverUrl} alt={`Kaft van ${title}`} fill className="object-cover" priority />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="text-5xl" aria-hidden>
              📖
            </span>
            <p className="text-base font-bold text-foreground/70 sm:text-lg">
              De kaft wordt getekend…
            </p>
            <p className="text-sm text-foreground/50">Even wachten, dan mag je lezen.</p>
          </div>
        )}
      </div>

      {coverUrl ? (
        <Link
          href={readHref}
          className="inline-flex min-h-16 w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] sm:max-w-sm sm:text-xl"
        >
          <BookOpen className="size-5" strokeWidth={2.5} />
          Begin met lezen
        </Link>
      ) : waitingLong ? (
        <Link
          href={readHref}
          className="text-center text-base font-bold text-foreground/60 underline-offset-2 hover:underline sm:text-lg"
        >
          Toch alvast lezen
        </Link>
      ) : null}
    </div>
  );
}
