"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { StoryCard } from "@/components/story-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readActiveHeroId, writeActiveHeroId } from "@/lib/active-hero";
import {
  buildHeroRoster,
  continueStoryForHero,
  pickDefaultHeroId,
  storiesForHero,
  type HeroRosterEntry,
} from "@/lib/hero-roster";
import type { Child, SavedCharacter, Story } from "@/lib/types";
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
        "relative flex shrink-0 overflow-hidden rounded-full bg-foreground/5 ring-2 ring-primary/40",
        dim,
      )}
    >
      {hero.portraitUrl ? (
        <Image src={hero.portraitUrl} alt={hero.name} fill className="object-cover" sizes="176px" />
      ) : (
        <span className="flex size-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 dark:from-primary/25 dark:to-primary/10">
          <Sparkles className={cn("text-primary/70 dark:text-primary/80", size === "lg" ? "size-12" : "size-5")} />
        </span>
      )}
    </span>
  );
}

const INPUT_CARD =
  "bg-white/85 dark:bg-white/10 border-2 border-primary/35 shadow-sm focus-visible:border-primary focus-visible:ring-primary/40";

export function HomeHeroView({
  stories,
  characters: initialCharacters,
  child: initialChild,
}: {
  stories: Story[];
  characters: SavedCharacter[];
  child: Child;
}) {
  const router = useRouter();
  const [characters, setCharacters] = useState(initialCharacters);
  const [child, setChild] = useState(initialChild);
  useEffect(() => {
    setCharacters(initialCharacters);
  }, [initialCharacters]);
  useEffect(() => {
    setChild(initialChild);
  }, [initialChild]);

  const roster = useMemo(() => buildHeroRoster(characters, stories), [characters, stories]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAppearance, setEditAppearance] = useState("");
  const [editAge, setEditAge] = useState("8");

  useEffect(() => {
    const preferred = readActiveHeroId();
    setActiveId(pickDefaultHeroId(roster, preferred));
    setReady(true);
  }, [roster]);

  function selectHero(id: string) {
    setActiveId(id);
    writeActiveHeroId(id);
    setEditing(false);
  }

  function openEditor(hero: HeroRosterEntry) {
    setEditName(hero.name);
    setEditAppearance(hero.appearanceFreeform);
    setEditAge(String(child.age));
    setEditError(null);
    setEditing(true);
  }

  async function saveHeroEdits(hero: HeroRosterEntry) {
    const name = editName.trim();
    const appearance = editAppearance.trim();
    const age = Number(editAge);
    if (!name || !appearance) {
      setEditError("Vul een naam en hoe de held eruitziet in.");
      return;
    }
    if (!Number.isFinite(age) || age < 4 || age > 14) {
      setEditError("Leesniveau (leeftijd) moet tussen 4 en 14 zijn.");
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      // Leesniveau is globaal (hoe moeilijk de zinnen worden).
      const childRes = await fetch("/api/child", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age, name: child.name }),
      });
      if (!childRes.ok) throw new Error("Leesniveau opslaan mislukte.");
      const childData = await childRes.json();
      setChild(childData.child);

      if (hero.savedCharacterId) {
        const res = await fetch(`/api/characters/${hero.savedCharacterId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, appearance }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Opslaan mislukte.");
        }
        const data = await res.json();
        const updated = data.character as SavedCharacter;
        setCharacters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        selectHero(updated.id);
      } else {
        // Story-held: eerst opslaan in de bibliotheek, dan kun je hem echt beheren.
        const res = await fetch("/api/characters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            kind: "hero",
            appearance,
            imageStyleHint: hero.imageStyleHint,
            portraitUrl: hero.portraitUrl,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Opslaan mislukte.");
        }
        const data = await res.json();
        const created = data.character as SavedCharacter;
        setCharacters((prev) => [...prev, created]);
        selectHero(created.id);
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Opslaan mislukte.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteActiveHero(hero: HeroRosterEntry) {
    if (!hero.savedCharacterId) {
      setEditError("Deze held zit alleen in boeken. Verwijder de boeken om hem te laten verdwijnen.");
      return;
    }
    if (
      !window.confirm(
        `${hero.name} verwijderen? Boeken blijven bestaan; alleen deze snelle held-keuze verdwijnt.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/characters/${hero.savedCharacterId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Verwijderen mislukte.");
      setCharacters((prev) => prev.filter((c) => c.id !== hero.savedCharacterId));
      setEditing(false);
      const next = roster.find((h) => h.id !== hero.id);
      if (next) selectHero(next.id);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Verwijderen mislukte.");
    } finally {
      setDeleting(false);
    }
  }

  const activeHero = roster.find((h) => h.id === activeId) ?? null;
  const heroStories = activeHero ? storiesForHero(stories, activeHero) : [];
  const continueStory = activeHero ? continueStoryForHero(stories, activeHero) : null;

  if (ready && roster.length === 0) {
    return (
      <div className="flex flex-col items-center gap-8 pt-4 text-center sm:gap-10 sm:pt-8">
        <div className="flex flex-col items-center gap-3">
          <span className="flex size-28 items-center justify-center rounded-full bg-primary/20 ring-2 ring-primary/30 sm:size-32">
            <Sparkles className="size-12 text-primary sm:size-14 dark:text-primary" />
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
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-7 py-4 text-lg font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-95 sm:px-9 sm:py-5 sm:text-xl"
        >
          <Plus className="size-6" strokeWidth={2.5} />
          Nieuw avontuur
        </Link>
      </div>
    );
  }

  if (!ready || !activeHero) {
    return <div className="min-h-[40vh]" aria-hidden />;
  }

  const continueLabel =
    continueStory?.status === "klaar" ? "Boek teruglezen" : "Verder lezen";
  const newAdventureHref = activeHero.savedCharacterId
    ? `/nieuw-verhaal?held=${encodeURIComponent(activeHero.savedCharacterId)}`
    : `/nieuw-verhaal?naam=${encodeURIComponent(activeHero.name)}`;

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <section className="flex flex-col items-center gap-4 text-center sm:gap-5">
        <button
          type="button"
          onClick={() => openEditor(activeHero)}
          aria-label={`${activeHero.name} bewerken`}
          className="group relative rounded-full transition-transform active:scale-95"
        >
          <HeroPortrait hero={activeHero} size="lg" />
          <span className="absolute bottom-1 right-1 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background transition-transform group-hover:scale-105 sm:size-10">
            <Pencil className="size-4 sm:size-5" strokeWidth={2.5} />
          </span>
        </button>
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-extrabold leading-tight text-foreground sm:text-4xl md:text-5xl">
            {activeHero.name}
          </h1>
        </div>

        {editing ? (
          <div className="w-full max-w-md rounded-2xl border border-foreground/10 bg-background/90 p-4 text-left shadow-lg sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-bold text-foreground sm:text-xl">
                Held bewerken
              </h2>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Sluiten"
                className="flex size-8 items-center justify-center rounded-full bg-foreground/5 text-foreground/50 hover:bg-foreground/10"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3 sm:gap-3.5">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-semibold text-foreground/80">Naam</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={40}
                  className={cn("h-11 rounded-xl text-base", INPUT_CARD)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-semibold text-foreground/80">
                  Hoe ziet de held eruit?
                </Label>
                <Textarea
                  value={editAppearance}
                  onChange={(e) => setEditAppearance(e.target.value)}
                  maxLength={250}
                  className={cn("min-h-[80px] rounded-xl text-base", INPUT_CARD)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-semibold text-foreground/80">
                  Leesniveau (leeftijd)
                </Label>
                <Input
                  type="number"
                  min={4}
                  max={14}
                  value={editAge}
                  onChange={(e) => setEditAge(e.target.value)}
                  className={cn("h-11 w-28 rounded-xl text-center text-base", INPUT_CARD)}
                />
                <p className="text-xs text-foreground/50">
                  Bepaalt hoe moeilijk de zinnen worden in nieuwe hoofdstukken.
                </p>
              </div>
              {editError && (
                <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{editError}</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  disabled={saving || deleting}
                  onClick={() => void saveHeroEdits(activeHero)}
                  className="h-12 flex-1 rounded-2xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90"
                >
                  {saving ? "Opslaan…" : "Opslaan"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving || deleting || !activeHero.savedCharacterId}
                  onClick={() => void deleteActiveHero(activeHero)}
                  className="h-12 rounded-2xl font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-300 dark:hover:bg-rose-400/10"
                >
                  <Trash2 className="size-4" />
                  {deleting ? "Bezig…" : "Verwijderen"}
                </Button>
              </div>
              {!activeHero.savedCharacterId && (
                <p className="text-xs text-foreground/50">
                  Opslaan bewaart deze held in je personages. Verwijderen kan daarna.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex w-full max-w-md flex-col gap-2.5 sm:gap-3">
            {continueStory ? (
              <Link
                href={storyHref(continueStory)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-95 sm:py-5 sm:text-xl"
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
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              <Plus className="size-5" strokeWidth={2.5} />
              Nieuw avontuur
            </Link>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 sm:gap-3.5">
        <h2 className="text-center text-sm font-semibold text-foreground/45 sm:text-base">
          Andere held
        </h2>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:justify-center sm:gap-4 sm:overflow-visible">
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
                  "flex w-16 shrink-0 flex-col items-center gap-1.5 rounded-2xl p-1 transition-all sm:w-20",
                  selected ? "opacity-100" : "opacity-70 hover:opacity-100",
                )}
              >
                <span
                  className={cn(
                    "rounded-full transition-shadow",
                    selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
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
            className="flex w-16 shrink-0 flex-col items-center gap-1.5 rounded-2xl p-1 opacity-70 transition-all hover:opacity-100 sm:w-20"
          >
            <span className="flex size-14 items-center justify-center rounded-full border-2 border-dashed border-primary/40 bg-primary/10 sm:size-16">
              <Plus className="size-6 text-primary dark:text-primary" strokeWidth={2.5} />
            </span>
            <span className="line-clamp-2 w-full text-center text-[11px] font-bold leading-tight text-foreground/55 sm:text-xs">
              Nieuw
            </span>
          </Link>
        </div>
      </section>

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
