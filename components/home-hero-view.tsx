"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Plus, Sparkles } from "lucide-react";
import { StoryCard } from "@/components/story-card";
import { readActiveHeroId, writeActiveHeroId } from "@/lib/active-hero";
import {
  buildHeroRoster,
  continueStoryForHero,
  pickDefaultHeroId,
  storiesForHero,
  type HeroRosterEntry,
} from "@/lib/hero-roster";
import type { SavedCharacter, Story } from "@/lib/types";
import { cn } from "@/lib/utils";

function storyHref(story: Story): string {
  return story.status === "klaar" ? `/verhaal/${story.id}/boek` : `/verhaal/${story.id}/lezen`;
}

function HeroPortrait({
  hero,
  size,
}: {
  hero: Pick<HeroRosterEntry, "name" | "portraitUrl">;
  size: "lg" | "sm";
}) {
  const dim = size === "lg" ? "size-36 sm:size-44" : "size-14 sm:size-16";
  return (
    <span
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full bg-foreground/5 ring-2 ring-amber-400/40",
        dim,
      )}
    >
      {hero.portraitUrl ? (
        <Image src={hero.portraitUrl} alt={hero.name} fill className="object-cover" sizes="176px" />
      ) : (
        <span className="flex size-full items-center justify-center bg-gradient-to-br from-amber-200/80 to-orange-100/60 dark:from-amber-400/20 dark:to-orange-400/10">
          <Sparkles className={cn("text-amber-700/70 dark:text-amber-200/80", size === "lg" ? "size-12" : "size-5")} />
        </span>
      )}
    </span>
  );
}

export function HomeHeroView({
  stories,
  characters,
}: {
  stories: Story[];
  characters: SavedCharacter[];
}) {
  const roster = useMemo(() => buildHeroRoster(characters, stories), [characters, stories]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const preferred = readActiveHeroId();
    setActiveId(pickDefaultHeroId(roster, preferred));
    setReady(true);
  }, [roster]);

  function selectHero(id: string) {
    setActiveId(id);
    writeActiveHeroId(id);
  }

  const activeHero = roster.find((h) => h.id === activeId) ?? null;
  const heroStories = activeHero ? storiesForHero(stories, activeHero) : [];
  const continueStory = activeHero ? continueStoryForHero(stories, activeHero) : null;

  // Nog geen helden en geen boeken: rustige eerste start.
  if (ready && roster.length === 0) {
    return (
      <div className="flex flex-col items-center gap-8 pt-4 text-center sm:gap-10 sm:pt-8">
        <div className="flex flex-col items-center gap-3">
          <span className="flex size-28 items-center justify-center rounded-full bg-amber-400/20 ring-2 ring-amber-400/30 sm:size-32">
            <Sparkles className="size-12 text-amber-600 sm:size-14 dark:text-amber-300" />
          </span>
          <h1 className="font-heading text-3xl font-extrabold text-foreground sm:text-4xl">
            Wie is jouw held?
          </h1>
          <p className="max-w-md text-base text-foreground/60 sm:text-lg">
            Verzin een held en begin je eerste avontuur. Jij leest, jij kiest, jij bouwt het verhaal.
          </p>
        </div>
        <Link
          href="/nieuw-verhaal"
          className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-7 py-4 text-lg font-bold text-amber-950 transition-all hover:bg-amber-300 active:scale-95 sm:px-9 sm:py-5 sm:text-xl"
        >
          <Plus className="size-6" strokeWidth={2.5} />
          Nieuw avontuur
        </Link>
      </div>
    );
  }

  // Voorkom flikkeren vóór localStorage gelezen is.
  if (!ready || !activeHero) {
    return <div className="min-h-[40vh]" aria-hidden />;
  }

  const continueLabel =
    continueStory?.status === "klaar" ? "Boek teruglezen" : "Verder lezen";
  const newAdventureHref = activeHero.savedCharacterId
    ? `/nieuw-verhaal?held=${encodeURIComponent(activeHero.savedCharacterId)}`
    : "/nieuw-verhaal";

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      {/* Held in het midden — één compositie, geen dashboard. */}
      <section className="flex flex-col items-center gap-4 text-center sm:gap-5">
        <HeroPortrait hero={activeHero} size="lg" />
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-extrabold leading-tight text-foreground sm:text-4xl md:text-5xl">
            {activeHero.name}
          </h1>
          {activeHero.worldHint && (
            <p className="text-base text-foreground/55 sm:text-lg">{activeHero.worldHint}</p>
          )}
        </div>

        <div className="flex w-full max-w-md flex-col gap-2.5 sm:gap-3">
          {continueStory ? (
            <Link
              href={storyHref(continueStory)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-6 py-4 text-lg font-bold text-amber-950 transition-all hover:bg-amber-300 active:scale-95 sm:py-5 sm:text-xl"
            >
              <BookOpen className="size-5 sm:size-6" strokeWidth={2.5} />
              {continueLabel}
            </Link>
          ) : null}
          <Link
            href={newAdventureHref}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-base font-bold transition-all active:scale-95 sm:text-lg",
              continueStory
                ? "bg-foreground/10 text-foreground/85 hover:bg-foreground/15"
                : "bg-amber-400 text-amber-950 hover:bg-amber-300",
            )}
          >
            <Plus className="size-5" strokeWidth={2.5} />
            Nieuw avontuur
          </Link>
        </div>
      </section>

      {/* Wissel-rij: andere helden + nieuwe held. */}
      <section className="flex flex-col gap-3 sm:gap-3.5">
        <h2 className="text-center text-sm font-semibold text-foreground/45 sm:text-base">
          Andere held
        </h2>
        <div className="flex flex-wrap items-start justify-center gap-3 sm:gap-4">
          {roster.map((hero) => {
            const selected = hero.id === activeHero.id;
            return (
              <button
                key={hero.id}
                type="button"
                onClick={() => selectHero(hero.id)}
                aria-pressed={selected}
                aria-label={`Kies ${hero.name}`}
                className={cn(
                  "flex w-16 flex-col items-center gap-1.5 rounded-2xl p-1 transition-all sm:w-20",
                  selected ? "opacity-100" : "opacity-70 hover:opacity-100",
                )}
              >
                <span
                  className={cn(
                    "rounded-full transition-shadow",
                    selected && "ring-2 ring-amber-400 ring-offset-2 ring-offset-background",
                  )}
                >
                  <HeroPortrait hero={hero} size="sm" />
                </span>
                <span
                  className={cn(
                    "line-clamp-2 w-full text-center text-[11px] font-bold leading-tight sm:text-xs",
                    selected ? "text-foreground" : "text-foreground/55",
                  )}
                >
                  {hero.name}
                </span>
              </button>
            );
          })}
          <Link
            href="/nieuw-verhaal"
            aria-label="Nieuwe held"
            className="flex w-16 flex-col items-center gap-1.5 rounded-2xl p-1 opacity-70 transition-all hover:opacity-100 sm:w-20"
          >
            <span className="flex size-14 items-center justify-center rounded-full border-2 border-dashed border-amber-400/60 bg-amber-400/10 sm:size-16">
              <Plus className="size-6 text-amber-700 dark:text-amber-300" strokeWidth={2.5} />
            </span>
            <span className="line-clamp-2 w-full text-center text-[11px] font-bold leading-tight text-foreground/55 sm:text-xs">
              Nieuw
            </span>
          </Link>
        </div>
      </section>

      {/* Boeken van deze held — secundair, onder de held. */}
      <section className="flex flex-col gap-3 sm:gap-4">
        <h2 className="text-center font-heading text-base font-semibold text-foreground/70 sm:text-lg">
          Boeken van {activeHero.name}
        </h2>
        {heroStories.length === 0 ? (
          <p className="text-center text-sm text-foreground/50 sm:text-base">
            Nog geen boek — tik op{" "}
            <span className="font-semibold text-foreground/70">Nieuw avontuur</span> om te beginnen.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {heroStories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
