"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BookPage } from "@/components/book-page";
import { Illustration } from "@/components/illustration";
import { ChoiceButtons } from "@/components/choice-buttons";
import { ReadingProgress } from "@/components/reading-progress";
import { ItemUnlockCard } from "@/components/item-unlock-card";
import type { Chapter } from "@/lib/types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

type BookPagerProps = {
  chapters: Chapter[];
  // Op welk HOOFDSTUK het boek opent (index in chapters). We springen intern naar de eerste
  // leesbladzijde van dat hoofdstuk. Ontbreekt dit, dan opent het boek op het laatste hoofdstuk.
  initialChapterIndex?: number;
  finished: boolean;
  storyId: string;
  heroName: string;
  heroEnemy: string;
  // "lezen": laatste bladzijde toont keuzeknoppen (of de "boek af"-melding).
  // "boek": laatste bladzijde toont de "boek af"-melding, of een link om verder te lezen.
  variant: "lezen" | "boek";
};

// Eén platte leesbladzijde. Een hoofdstuk bestaat nu uit ~3 bladzijden (chapter.pages), en we
// bladeren door ALLE bladzijden van alle hoofdstukken achter elkaar — één bladzijde per keer,
// net als een echt boek. De illustratie hoort bij het hele hoofdstuk en wordt getoond op de
// EERSTE bladzijde ervan, als de "beloning" die je verdient door verder te lezen/te kiezen.
type ReadingPage = {
  chapterIndex: number;
  chapter: Chapter;
  pageInChapter: number;
  isChapterStart: boolean;
  isChapterEnd: boolean;
  text: string;
};

function buildReadingPages(chapters: Chapter[]): ReadingPage[] {
  const out: ReadingPage[] = [];
  chapters.forEach((chapter, chapterIndex) => {
    // Terugval: een (theoretisch) hoofdstuk zonder bladzijden mag nooit helemaal verdwijnen —
    // dan zou de bladwijzer niet meer kloppen. Oudere data is al door lib/storage.ts naar
    // pages gemigreerd, dus dit is puur een vangnet.
    const pages = chapter.pages?.length ? chapter.pages : [chapter.text ?? ""];
    pages.forEach((text, pageInChapter) => {
      out.push({
        chapterIndex,
        chapter,
        pageInChapter,
        isChapterStart: pageInChapter === 0,
        isChapterEnd: pageInChapter === pages.length - 1,
        text,
      });
    });
  });
  return out;
}

// Bladert door alle leesbladzijden van het boek, één per keer, met vorige/volgende-knoppen,
// swipe en pijltjestoetsen. De illustratie van een hoofdstuk verschijnt als beloning op de
// eerste bladzijde ervan (met een zachte onthul-animatie, zie .reward-reveal in globals.css).
// Alles wat onder de bladzijde verschijnt (keuzeknoppen, "boek af"-melding) leeft hier binnen,
// zodat we geen functies als props vanuit een server component hoeven door te geven (dat mag
// niet in React Server Components).
export function BookPager({
  chapters,
  initialChapterIndex,
  finished,
  storyId,
  heroName,
  heroEnemy,
  variant,
}: BookPagerProps) {
  const router = useRouter();
  const pages = useMemo(() => buildReadingPages(chapters), [chapters]);
  const maxIndex = Math.max(0, pages.length - 1);

  // Fase B van de choice-flow, client-side aangestuurd. De choice-route (fase A) slaat een
  // hoofdstuk eerst met alleen tekst op (imagePending: true) en keert meteen terug, zodat het
  // kind vrijwel direct kan lezen. Hier triggeren we daarna het aparte image-endpoint dat het
  // zware beeldwerk op de achtergrond doet, en verversen we de pagina zodra het plaatje er is
  // (dan speelt de reward-reveal-onthulling, zie hieronder). Dit gebeurt hier — niet in
  // ChoiceButtons — omdat BookPager blijft bestaan over refreshes heen en zo elk pending
  // hoofdstuk oppakt, ongeacht hóé het ontstond. Een functie als prop van de server-component
  // doorgeven mag niet (RSC-regel), dus we regelen de fetch volledig client-side.
  const triggeredRef = useRef<Set<number>>(new Set());
  const pendingChapterN = useMemo(() => {
    const pendingChapter = chapters.find((c) => c.imagePending && !c.imageUrl);
    return pendingChapter?.n ?? null;
  }, [chapters]);

  useEffect(() => {
    if (pendingChapterN === null) return;
    // Guard tegen dubbel triggeren: hetzelfde hoofdstuk maar één keer aanstoten (het endpoint is
    // óók idempotent, maar zo voorkomen we zelfs de overbodige fetch bij een tussentijdse render).
    if (triggeredRef.current.has(pendingChapterN)) return;
    triggeredRef.current.add(pendingChapterN);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/stories/${storyId}/chapters/${pendingChapterN}/image`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("image endpoint faalde");
        // Het beeld staat nu op de server: verversen zodat het plaatje binnenkomt en onthuld wordt.
        if (!cancelled) router.refresh();
      } catch {
        // Mislukt (bv. netwerk): guard vrijgeven zodat een volgende render/refresh opnieuw mag
        // proberen. De placeholder blijft ondertussen gewoon staan (geen crash voor het kind).
        triggeredRef.current.delete(pendingChapterN);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingChapterN, storyId, router]);

  // De platte index van de eerste bladzijde van een hoofdstuk — voor de startpositie en de
  // automatische sprong naar een net gegenereerd hoofdstuk.
  const firstPageOfChapter = useCallback(
    (chapterIndex: number): number => {
      const idx = pages.findIndex((p) => p.chapterIndex === chapterIndex);
      return idx === -1 ? 0 : idx;
    },
    [pages],
  );

  const [index, setIndex] = useState(() => {
    const lastChapter = Math.max(0, chapters.length - 1);
    const startChapter = clamp(initialChapterIndex ?? lastChapter, 0, lastChapter);
    const flat = pages.findIndex((p) => p.chapterIndex === startChapter);
    return clamp(flat === -1 ? maxIndex : flat, 0, maxIndex);
  });

  const touchStartX = useRef<number | null>(null);
  const prevChapterCount = useRef(chapters.length);

  const current = pages[clamp(index, 0, maxIndex)] ?? pages[0];
  const isFirst = index === 0;
  const isLast = index === maxIndex;

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => clamp(i + delta, 0, maxIndex));
    },
    [maxIndex],
  );

  // Nadat een keuze is gemaakt, ververst de server-component de data (router.refresh() in
  // ChoiceButtons) — dan komt hier een langere chapters-lijst binnen. We springen dan naar de
  // EERSTE bladzijde van het nieuwe hoofdstuk, zodat de onthulde beloning-illustratie én de
  // nieuwe leestekst vanzelf in beeld komen (het kind hoeft niet zelf "Volgende" te zoeken).
  useEffect(() => {
    if (chapters.length > prevChapterCount.current) {
      setIndex(firstPageOfChapter(chapters.length - 1));
    }
    prevChapterCount.current = chapters.length;
  }, [chapters.length, firstPageOfChapter]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const active = document.activeElement;
      const isTyping =
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLInputElement ||
        active?.getAttribute("contenteditable") === "true";
      if (isTyping) return;

      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go]);

  function onTouchStart(e: TouchEvent<HTMLDivElement>) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 50) return; // te kleine sleepbeweging, geen echte "swipe"
    go(delta < 0 ? 1 : -1);
  }

  return (
    <div
      className="flex flex-col gap-4 sm:gap-5"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Kindvriendelijke voortgang bovenaan: hoe ver ben ik in mijn boek. Rustig en warm,
          nooit iets over de geheime akte-structuur. */}
      <ReadingProgress chaptersDone={chapters.length} finished={finished} />

      {/* De beloning: de illustratie van dit hoofdstuk, alleen op de eerste bladzijde. De key
          op hoofdstuk-niveau zorgt dat de onthul-animatie opnieuw speelt telkens als je een
          (ander) hoofdstuk binnenkomt — bv. na een keuze, of bij terugbladeren. */}
      {current.isChapterStart && (
        <div
          key={`reward-${current.chapterIndex}-${current.chapter.imageUrl ? "img" : "pending"}`}
          className="reward-reveal mx-auto w-full max-w-2xl"
        >
          <Illustration
            imageUrl={current.chapter.imageUrl}
            pending={current.chapter.imagePending && !current.chapter.imageUrl}
            alt={`Illustratie van hoofdstuk ${current.chapter.n}`}
          />
        </div>
      )}

      {/* Verdiende-voorwerp-moment: alleen op de eerste bladzijde van het hoofdstuk waarin het
          kind iets ge-unlockt heeft. */}
      {current.isChapterStart && current.chapter.unlockedItem && (
        <div className="mx-auto w-full max-w-2xl">
          <ItemUnlockCard item={current.chapter.unlockedItem} />
        </div>
      )}

      <BookPage label={`Hoofdstuk ${current.chapter.n}`}>{current.text}</BookPage>

      {/* De gemaakte keuze tonen we onder de LAATSTE bladzijde van een hoofdstuk (daar hoort ze
          bij), niet onder elke tussenbladzijde. */}
      {current.isChapterEnd && current.chapter.chosen && (
        <p className="rounded-xl bg-foreground/5 px-4 py-2.5 text-sm text-foreground/70 sm:text-base">
          <span className="font-semibold text-foreground/90">Gekozen: </span>
          {current.chapter.chosen}
        </p>
      )}

      {pages.length > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={isFirst}
            aria-label="Vorige pagina"
            className="flex items-center gap-1 rounded-full bg-foreground/10 px-3.5 py-2.5 text-sm font-bold text-foreground/80 transition-all hover:bg-foreground/20 active:scale-95 disabled:pointer-events-none disabled:opacity-30 sm:gap-1.5 sm:px-5 sm:py-3 sm:text-base"
          >
            <ChevronLeft className="size-4 sm:size-5" />
            Vorige
          </button>
          <p className="text-sm font-semibold text-foreground/50 sm:text-base">
            Pagina {index + 1} van {pages.length}
          </p>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={isLast}
            aria-label="Volgende pagina"
            className="flex items-center gap-1 rounded-full bg-foreground/10 px-3.5 py-2.5 text-sm font-bold text-foreground/80 transition-all hover:bg-foreground/20 active:scale-95 disabled:pointer-events-none disabled:opacity-30 sm:gap-1.5 sm:px-5 sm:py-3 sm:text-base"
          >
            Volgende
            <ChevronRight className="size-4 sm:size-5" />
          </button>
        </div>
      )}

      {/* Keuzes/finale verschijnen alleen op de allerlaatste bladzijde van het boek — dat is de
          laatste bladzijde van het laatste (levende) hoofdstuk, waar de cliffhanger staat. */}
      {isLast && (
        <BookPagerFooter
          variant={variant}
          finished={finished}
          storyId={storyId}
          heroName={heroName}
          heroEnemy={heroEnemy}
          choices={current.chapter.choices}
          chapterN={current.chapter.n}
        />
      )}
    </div>
  );
}

function BookPagerFooter({
  variant,
  finished,
  storyId,
  heroName,
  heroEnemy,
  choices,
  chapterN,
}: {
  variant: "lezen" | "boek";
  finished: boolean;
  storyId: string;
  heroName: string;
  heroEnemy: string;
  choices: string[];
  chapterN: number;
}) {
  if (finished) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6 text-center sm:gap-3 sm:p-8">
        <span className="text-4xl sm:text-5xl">🏆</span>
        <p className="font-heading text-lg font-bold text-amber-800 sm:text-xl dark:text-amber-200">
          {variant === "lezen" ? "Het boek is af — wat een avontuur!" : "Boek af!"}
        </p>
        {variant === "boek" ? (
          <p className="text-sm text-amber-800/80 sm:text-base dark:text-amber-100/80">
            {heroName} heeft {heroEnemy} overwonnen. Wat een verhaal!
          </p>
        ) : (
          <Link
            href={`/verhaal/${storyId}/boek`}
            className="rounded-2xl bg-amber-400 px-5 py-3 text-base font-bold text-amber-950 hover:bg-amber-300 sm:px-7 sm:py-4 sm:text-lg"
          >
            Lees het hele boek terug
          </Link>
        )}
      </div>
    );
  }

  if (variant === "boek") {
    return (
      <Link
        href={`/verhaal/${storyId}/lezen`}
        className="rounded-2xl bg-amber-400 px-5 py-4 text-center text-lg font-bold text-amber-950 hover:bg-amber-300 sm:py-5 sm:text-xl"
      >
        Verder lezen ✨
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <p className="text-center text-sm font-semibold text-foreground/50 sm:text-base">
        Wat doet {heroName} nu?
      </p>
      <ChoiceButtons storyId={storyId} choices={choices} heroName={heroName} chapterN={chapterN} />
    </div>
  );
}
