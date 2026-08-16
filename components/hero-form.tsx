"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Compass,
  Fish,
  PawPrint,
  RefreshCw,
  Rocket,
  Search,
  Sparkles,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_IMAGE_STYLE_ID,
  IMAGE_STYLES,
  getImageStyleByHint,
  type ImageStyleId,
} from "@/lib/image-styles";
import { buildHeroRoster, type HeroRosterEntry } from "@/lib/hero-roster";
import { GENRE_LABELS, type Genre, type SavedCharacter, type Story } from "@/lib/types";
import { cn } from "@/lib/utils";
import { writeActiveHeroId } from "@/lib/active-hero";

const GENRE_ICON: Record<Genre, LucideIcon> = {
  avontuur: Compass,
  fantasie: Sparkles,
  ruimte: Rocket,
  onderwater: Fish,
  dieren: PawPrint,
  detective: Search,
};

type FormState = {
  authorName: string;
  name: string;
  age: string;
  world: string;
  genre: Genre | null;
  appearance: string;
  skills: string;
  styleId: ImageStyleId;
  goal: string;
  enemy: string;
  companions: string;
  freeform: string;
};

type StartMode = "new" | "existing";
type WizardStep = 1 | 2 | 3 | 4;

const INPUT_CARD =
  "bg-white/85 dark:bg-white/10 border-2 border-primary/35 shadow-sm focus-visible:border-primary focus-visible:ring-primary/40";

const COMPANION_PREVIEW = 6;

function uniqueCharactersByName(list: SavedCharacter[]): SavedCharacter[] {
  const byName = new Map<string, SavedCharacter>();
  for (const character of list) {
    const key = character.name.trim().toLowerCase();
    if (!key) continue;
    const previous = byName.get(key);
    if (!previous) {
      byName.set(key, character);
      continue;
    }
    const previousScore = (previous.portraitUrl ? 2 : 0) + (previous.createdAt >= character.createdAt ? 1 : 0);
    const nextScore = (character.portraitUrl ? 2 : 0) + (character.createdAt > previous.createdAt ? 1 : 0);
    if (nextScore > previousScore) byName.set(key, character);
  }
  return Array.from(byName.values());
}

function sortCharactersByName(list: SavedCharacter[]): SavedCharacter[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "nl", { sensitivity: "base" }));
}

export function HeroForm({
  initialCharacterId,
  initialHeroName,
  initialAuthorName,
  initialAge,
  initialStories = [],
}: {
  initialCharacterId?: string;
  initialHeroName?: string;
  initialAuthorName?: string;
  initialAge?: number;
  // Zelfde bron als home: boeken + bibliotheek → ook helden die alleen in boeken bestaan
  // (zoals "Papa") verschijnen onder "Bestaande held".
  initialStories?: Story[];
}) {
  const router = useRouter();
  const startWithExisting = Boolean(initialCharacterId || initialHeroName);
  const [step, setStep] = useState<WizardStep>(startWithExisting ? 2 : 1);
  const [form, setForm] = useState<FormState>({
    authorName: initialAuthorName?.trim() || "",
    name: "",
    age: String(initialAge && initialAge >= 4 && initialAge <= 14 ? initialAge : 8),
    world: "",
    genre: null,
    appearance: "",
    skills: "",
    styleId: DEFAULT_IMAGE_STYLE_ID,
    goal: "",
    enemy: "",
    companions: "",
    freeform: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<StartMode>(startWithExisting ? "existing" : "new");
  const [characters, setCharacters] = useState<SavedCharacter[]>([]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [charactersError, setCharactersError] = useState<string | null>(null);
  // Roster-id: opgeslagen character-id OF "name:papa" voor story-helden.
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(
    initialCharacterId ?? null,
  );
  const [initialApplied, setInitialApplied] = useState(false);
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null);
  const initialAppliedRef = useRef(initialApplied);
  initialAppliedRef.current = initialApplied;

  const [selectedSideCharacterIds, setSelectedSideCharacterIds] = useState<string[]>([]);
  const [companionQuery, setCompanionQuery] = useState("");
  const [showAllHeroCompanions, setShowAllHeroCompanions] = useState(false);
  const [showAllFriendCompanions, setShowAllFriendCompanions] = useState(false);

  const heroRoster = useMemo(
    () => buildHeroRoster(characters, initialStories),
    [characters, initialStories],
  );

  function applyRosterEntry(entry: HeroRosterEntry) {
    setSelectedRosterId(entry.id);
    setForm((prev) => ({
      ...prev,
      name: entry.name,
      appearance: entry.appearanceFreeform,
      skills: entry.skills,
      styleId: getImageStyleByHint(entry.imageStyleHint).id,
      // Wereld mag alvast uit het vorige boek komen — kind kan het in stap 2 nog wijzigen.
      world: prev.world || entry.worldHint || "",
    }));
    if (entry.savedCharacterId) {
      setSelectedSideCharacterIds((prev) => prev.filter((x) => x !== entry.savedCharacterId));
    }
  }

  const loadCharacters = useCallback(async () => {
    setLoadingCharacters(true);
    setCharactersError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch("/api/characters", { signal: controller.signal });
      if (!res.ok) throw new Error("Laden is mislukt.");
      const data: { characters: SavedCharacter[] } = await res.json();
      const options = (data.characters ?? []).slice();
      setCharacters(options);
      if (!initialAppliedRef.current && (initialCharacterId || initialHeroName)) {
        const roster = buildHeroRoster(options, initialStories);
        const found = initialCharacterId
          ? roster.find((h) => h.id === initialCharacterId || h.savedCharacterId === initialCharacterId)
          : roster.find(
              (h) => h.name.trim().toLowerCase() === initialHeroName!.trim().toLowerCase(),
            );
        if (found) {
          setSelectedRosterId(found.id);
          setForm((prev) => ({
            ...prev,
            name: found.name,
            appearance: found.appearanceFreeform,
            skills: found.skills,
            styleId: getImageStyleByHint(found.imageStyleHint).id,
            world: prev.world || found.worldHint || "",
          }));
        }
        setInitialApplied(true);
      }
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      setCharactersError(
        timedOut
          ? "Het laden duurt te lang. Controleer je internet en probeer het opnieuw."
          : "Laden is mislukt. Probeer het opnieuw.",
      );
    } finally {
      clearTimeout(timeout);
      setLoadingCharacters(false);
    }
  }, [initialCharacterId, initialHeroName, initialStories]);

  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadCharacters();
  }, [loadCharacters]);

  // Story-helden staan al in initialStories — ook zonder API-lading meteen toepassen.
  useEffect(() => {
    if (initialAppliedRef.current) return;
    if (!initialHeroName || initialCharacterId) return;
    if (characters.length > 0) return; // wacht op loadCharacters-pad
    const roster = buildHeroRoster([], initialStories);
    const found = roster.find(
      (h) => h.name.trim().toLowerCase() === initialHeroName.trim().toLowerCase(),
    );
    if (found) {
      applyRosterEntry(found);
      setInitialApplied(true);
    }
  }, [initialHeroName, initialCharacterId, initialStories, characters.length]);

  function toggleSideCharacter(id: string) {
    setSelectedSideCharacterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleDeleteCharacter(c: SavedCharacter) {
    if (!window.confirm(`${c.name} verwijderen uit je personages? Dit kan niet ongedaan gemaakt worden.`)) {
      return;
    }
    setDeletingCharacterId(c.id);
    try {
      const res = await fetch(`/api/characters/${c.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Verwijderen is mislukt.");
      setCharacters((prev) => prev.filter((x) => x.id !== c.id));
      setSelectedSideCharacterIds((prev) => prev.filter((x) => x !== c.id));
      if (selectedRosterId === c.id) {
        setSelectedRosterId(null);
        setForm((prev) => ({ ...prev, name: "", appearance: "", skills: "" }));
      }
    } catch {
      window.alert("Verwijderen is niet gelukt. Probeer het nog eens.");
    } finally {
      setDeletingCharacterId(null);
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function switchMode(next: StartMode) {
    setMode(next);
    setError(null);
    if (next === "new") {
      setSelectedRosterId(null);
      setForm((prev) => ({
        ...prev,
        name: "",
        appearance: "",
        skills: "",
        world: "",
        styleId: DEFAULT_IMAGE_STYLE_ID,
      }));
    } else if (step === 4) {
      setStep(3);
    }
  }

  const selectedEntry = heroRoster.find((h) => h.id === selectedRosterId) ?? null;
  const selectedCharacterId = selectedEntry?.savedCharacterId ?? null;
  const companionGroups = useMemo(() => {
    const unique = uniqueCharactersByName(
      characters.filter((c) => c.id !== selectedCharacterId),
    );
    const query = companionQuery.trim().toLowerCase();
    const visible = query
      ? unique.filter((c) => c.name.toLowerCase().includes(query))
      : unique;
    return {
      heroes: sortCharactersByName(visible.filter((c) => c.kind === "hero")),
      friends: sortCharactersByName(visible.filter((c) => c.kind !== "hero")),
    };
  }, [characters, selectedCharacterId, companionQuery]);

  const childValid =
    form.authorName.trim().length > 0 && Number(form.age) >= 4 && Number(form.age) <= 14;
  const step1Valid =
    childValid &&
    (mode === "existing"
      ? Boolean(selectedRosterId && form.name.trim() && form.appearance.trim())
      : form.name.trim().length > 0 && form.appearance.trim().length > 0);
  const step2Valid = form.world.trim().length > 0 && Boolean(form.genre);
  const canSubmit = step1Valid && step2Valid;
  // Bestaande held: stijl hoort al bij het personage, geen tegel meer. Nieuwe held: stap 4.
  const usingExistingHero = Boolean(selectedRosterId);
  const lastStep: WizardStep = usingExistingHero ? 3 : 4;

  function goNext() {
    setError(null);
    if (step === 1) {
      if (!step1Valid) {
        setError(
          mode === "existing"
            ? "Kies een held, en vul je naam en leeftijd in."
            : "Vul je naam, leeftijd, de naam van je held en hoe je held eruitziet in.",
        );
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!step2Valid) {
        setError("Kies een wereld en een genre.");
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3 && !usingExistingHero) {
      setStep(4);
    }
  }

  function goBack() {
    setError(null);
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
    if (step === 4) setStep(3);
  }

  async function startAdventure() {
    if (step !== lastStep || submitting) return;
    if (!canSubmit) {
      setError("Nog niet alles is ingevuld.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: form.authorName.trim(),
          hero: {
            name: form.name.trim(),
            world: form.world.trim(),
            genre: form.genre,
            power: form.skills.trim() || undefined,
          },
          age: Number(form.age),
          appearance: form.appearance.trim(),
          styleId: selectedCharacterId ? undefined : form.styleId,
          existingCharacterId: selectedCharacterId ?? undefined,
          existingSideCharacterIds:
            selectedSideCharacterIds.length > 0 ? selectedSideCharacterIds : undefined,
          outline: {
            goal: form.goal.trim(),
            enemy: form.enemy.trim(),
            companions: form.companions.trim(),
            freeform: form.freeform.trim(),
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Het verhaal is niet gelukt. Tik nog eens op de knop.",
        );
      }
      const data = await res.json();
      if (selectedRosterId) {
        writeActiveHeroId(selectedRosterId);
      } else {
        writeActiveHeroId(`name:${form.name.trim().toLowerCase()}`);
      }
      router.push(`/verhaal/${data.story.id}/lezen`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Het verhaal is niet gelukt. Tik nog eens op de knop.",
      );
      setSubmitting(false);
    }
  }

  function renderLoadStatus() {
    if (loadingCharacters) {
      return <p className="text-sm text-foreground/60">Personages laden…</p>;
    }
    if (charactersError) {
      return (
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{charactersError}</p>
          <button
            type="button"
            onClick={loadCharacters}
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1.5 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-200 active:scale-95 dark:bg-rose-400/15 dark:text-rose-200"
          >
            <RefreshCw className="size-3.5" />
            Opnieuw proberen
          </button>
        </div>
      );
    }
    return null;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
      }}
      className="flex flex-col gap-6 sm:gap-8"
    >
      <StepDots current={step} total={lastStep} />

      {step === 1 && (
        <div className="flex flex-col gap-6 sm:gap-8">
          <section className="flex flex-col gap-2.5 sm:gap-3">
            <h2 className="font-heading text-xl font-bold text-foreground sm:text-2xl">
              Wie ben jij?
            </h2>
            <p className="text-sm text-foreground/60 sm:text-base">
              Je naam komt op het boek. Je leeftijd bepaalt hoe de zinnen geschreven worden.
            </p>
            <div className="flex flex-wrap gap-4">
              <Field label="Jouw naam">
                <Input
                  value={form.authorName}
                  onChange={(e) => update("authorName", e.target.value)}
                  placeholder="Bijv. Rens"
                  maxLength={30}
                  className={cn("h-12 w-40 rounded-xl text-base sm:h-14 sm:w-48 sm:text-lg", INPUT_CARD)}
                />
              </Field>
              <Field label="Leeftijd">
                <Input
                  type="number"
                  min={4}
                  max={14}
                  value={form.age}
                  onChange={(e) => update("age", e.target.value)}
                  className={cn("h-12 w-24 rounded-xl text-center text-base sm:h-14 sm:w-28 sm:text-lg", INPUT_CARD)}
                />
              </Field>
            </div>
          </section>

          <StepSection
            badge={1}
            title="Wie is je held?"
            subtitle="Neem een held mee, of verzin een nieuwe."
          >
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <ModeButton
                active={mode === "existing"}
                onClick={() => switchMode("existing")}
                icon={Users}
                label="Bestaande held"
                hint="Uit je boeken"
              />
              <ModeButton
                active={mode === "new"}
                onClick={() => switchMode("new")}
                icon={UserPlus}
                label="Nieuwe held"
                hint="Zelf verzinnen"
              />
            </div>

            {mode === "existing" && (
              <div className="flex flex-col gap-2.5">
                {renderLoadStatus()}
                {!loadingCharacters && !charactersError && heroRoster.length === 0 && (
                  <p className="text-sm text-foreground/60">
                    Nog geen helden. Kies &quot;Nieuwe held&quot; om te beginnen.
                  </p>
                )}
                {heroRoster.length > 0 && (
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3">
                    {heroRoster.map((entry) => {
                      const saved = entry.savedCharacterId
                        ? characters.find((c) => c.id === entry.savedCharacterId)
                        : null;
                      return (
                        <RosterHeroTile
                          key={entry.id}
                          entry={entry}
                          selected={selectedRosterId === entry.id}
                          onToggle={() => applyRosterEntry(entry)}
                          onDelete={
                            saved
                              ? () => void handleDeleteCharacter(saved)
                              : undefined
                          }
                          deleting={Boolean(
                            entry.savedCharacterId &&
                              deletingCharacterId === entry.savedCharacterId,
                          )}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {mode === "new" && (
              <div className="flex flex-col gap-4 sm:gap-5">
                <Field label="Naam van je held">
                  <Input
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Bijv. Finn"
                    maxLength={30}
                    className={cn("h-12 rounded-xl text-base sm:h-14 sm:text-lg", INPUT_CARD)}
                  />
                </Field>
                <Field label="Hoe ziet je held eruit?">
                  <Textarea
                    value={form.appearance}
                    onChange={(e) => update("appearance", e.target.value)}
                    placeholder="Bijv. groene krullen, een cape vol sterren..."
                    maxLength={250}
                    className={cn("min-h-[88px] rounded-xl text-base sm:min-h-[100px] sm:text-lg", INPUT_CARD)}
                  />
                </Field>
                <Field label="Superkrachten of skills (mag leeg)">
                  <Textarea
                    value={form.skills}
                    onChange={(e) => update("skills", e.target.value)}
                    placeholder="Bijv. supersterk, of heel goed bouwen"
                    maxLength={200}
                    className={cn("min-h-[72px] rounded-xl text-base sm:min-h-[88px] sm:text-lg", INPUT_CARD)}
                  />
                </Field>
              </div>
            )}
          </StepSection>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-6 sm:gap-8">
          <StepSection
            badge={2}
            title={`Avontuur voor ${form.name || "je held"}`}
            subtitle="Kies waar het speelt, en welke sfeer het boek krijgt."
          >
            <Field label="In welke wereld speelt het?">
              <Input
                value={form.world}
                onChange={(e) => update("world", e.target.value)}
                placeholder="Bijv. Sterrenwoud"
                maxLength={40}
                className={cn("h-12 rounded-xl text-base sm:h-14 sm:text-lg", INPUT_CARD)}
              />
            </Field>

            <div className="flex flex-col gap-2.5 sm:gap-3">
              <p className="text-sm font-semibold text-foreground/80 sm:text-base">Welk genre?</p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                {Object.entries(GENRE_LABELS).map(([value, label]) => {
                  const Icon = GENRE_ICON[value as Genre];
                  const selected = form.genre === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => update("genre", value as Genre)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-4 text-sm font-bold transition-all active:scale-[0.97] sm:gap-2 sm:py-5 sm:text-base",
                        "bg-white/85 dark:bg-white/10 shadow-sm",
                        selected
                          ? "border-primary bg-primary/10 text-primary shadow-md -translate-y-0.5 dark:bg-primary/15 dark:text-primary"
                          : "border-primary/35 text-foreground/80 hover:border-primary/60 hover:shadow-md",
                      )}
                    >
                      <Icon className="size-7 sm:size-8" strokeWidth={2.5} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </StepSection>
        </div>
      )}

      {step === 3 && (
        <StepSection
          badge={3}
          title="Jouw verhaal"
          subtitle="Vul in wat je wilt. Wat je opschrijft, gebeurt in het verhaal. De rest verzinnen we."
        >
          <Field label={`Wat wil ${form.name.trim() || "de held"}?`}>
            <Input
              value={form.goal}
              onChange={(e) => update("goal", e.target.value)}
              placeholder="Bijv. het gouden zwaard terugvinden"
              maxLength={200}
              className={cn("h-12 rounded-xl text-base sm:h-14 sm:text-lg", INPUT_CARD)}
            />
          </Field>
          <Field label="Wie is de boef?">
            <Input
              value={form.enemy}
              onChange={(e) => update("enemy", e.target.value)}
              placeholder="Bijv. een dief in het woud"
              maxLength={200}
              className={cn("h-12 rounded-xl text-base sm:h-14 sm:text-lg", INPUT_CARD)}
            />
          </Field>
          <div className="flex flex-col gap-2.5 sm:gap-3">
            <p className="text-sm font-semibold text-foreground/80 sm:text-base">
              Wie gaat er mee?
            </p>
            <p className="text-sm text-foreground/60">
              Tik wie je al kent. Of typ zelf iemand.
            </p>
            {renderLoadStatus()}
            {(companionGroups.heroes.length > 0 || companionGroups.friends.length > 0) && (
              <Input
                value={companionQuery}
                onChange={(e) => setCompanionQuery(e.target.value)}
                placeholder="Zoek een naam"
                maxLength={40}
                className={cn("h-11 rounded-xl text-base sm:h-12 sm:text-lg", INPUT_CARD)}
              />
            )}
            <CompanionGroup
              title="Helden"
              characters={companionGroups.heroes}
              expanded={showAllHeroCompanions || companionQuery.trim().length > 0}
              allowCollapse={companionQuery.trim().length === 0}
              onToggleExpand={() => setShowAllHeroCompanions((v) => !v)}
              selectedIds={selectedSideCharacterIds}
              onToggle={toggleSideCharacter}
              onDelete={(c) => void handleDeleteCharacter(c)}
              deletingId={deletingCharacterId}
            />
            <CompanionGroup
              title="Vrienden"
              characters={companionGroups.friends}
              expanded={showAllFriendCompanions || companionQuery.trim().length > 0}
              allowCollapse={companionQuery.trim().length === 0}
              onToggleExpand={() => setShowAllFriendCompanions((v) => !v)}
              selectedIds={selectedSideCharacterIds}
              onToggle={toggleSideCharacter}
              onDelete={(c) => void handleDeleteCharacter(c)}
              deletingId={deletingCharacterId}
            />
            <Input
              value={form.companions}
              onChange={(e) => update("companions", e.target.value)}
              placeholder="Bijv. Verity, ze kan kleuren toveren"
              maxLength={250}
              className={cn("h-12 rounded-xl text-base sm:h-14 sm:text-lg", INPUT_CARD)}
            />
          </div>
          <Field label="Vertel zelf hoe het verhaal gaat">
            <Textarea
              value={form.freeform}
              onChange={(e) => update("freeform", e.target.value)}
              placeholder="Schrijf hier alles wat je nog wilt. Dit mag ook leeg blijven."
              maxLength={800}
              className={cn("min-h-[120px] rounded-xl text-base sm:min-h-[140px] sm:text-lg", INPUT_CARD)}
            />
          </Field>
        </StepSection>
      )}

      {step === 4 && (
        <StepSection
          badge={4}
          title="Kies een tekenstijl"
          subtitle="In welke stijl moeten de plaatjes getekend worden?"
        >
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {IMAGE_STYLES.map((style) => {
              const Icon = style.icon;
              const selected = form.styleId === style.id;
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => update("styleId", style.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-4 text-center text-xs font-bold transition-all active:scale-[0.97] sm:gap-2 sm:py-5 sm:text-sm",
                    "bg-white/85 shadow-sm dark:bg-white/10",
                    selected
                      ? "-translate-y-0.5 border-primary bg-primary/10 shadow-md dark:bg-primary/15"
                      : "border-primary/35 hover:border-primary/60 hover:shadow-md",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-full sm:size-11",
                      style.swatch,
                    )}
                  >
                    <Icon className="size-6 text-foreground sm:size-7" strokeWidth={2.5} />
                  </span>
                  <span className="text-slate-800 dark:text-slate-100">{style.label}</span>
                </button>
              );
            })}
          </div>
        </StepSection>
      )}

      {error && (
        <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{error}</p>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
        {step > 1 && (
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            disabled={submitting}
            className="h-12 rounded-2xl text-base font-bold text-foreground/70 sm:h-14 sm:flex-none sm:px-5"
          >
            <ChevronLeft className="size-5" />
            Terug
          </Button>
        )}
        {step < lastStep ? (
          <button
            type="button"
            onClick={goNext}
            className="min-h-16 w-full rounded-2xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] sm:min-h-16 sm:flex-1 sm:text-xl"
          >
            Verder
          </button>
        ) : (
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={() => void startAdventure()}
            className="min-h-16 w-full rounded-2xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 sm:min-h-16 sm:flex-1 sm:text-xl"
          >
            {submitting ? "Even geduld, het verhaal wordt geschreven…" : "Begin het avontuur ✨"}
          </button>
        )}
      </div>
    </form>
  );
}

function StepDots({ current, total }: { current: WizardStep; total: WizardStep }) {
  const steps = (total === 3 ? [1, 2, 3] : [1, 2, 3, 4]) as WizardStep[];
  return (
    <div className="flex items-center justify-center gap-2" aria-label={`Stap ${current} van ${total}`}>
      {steps.map((n) => (
        <span
          key={n}
          className={cn(
            "h-2 rounded-full transition-all",
            n === current ? "w-8 bg-primary" : "w-2 bg-foreground/15",
          )}
        />
      ))}
    </div>
  );
}

function RosterHeroTile({
  entry,
  selected,
  onToggle,
  onDelete,
  deleting,
}: {
  entry: HeroRosterEntry;
  selected: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  deleting: boolean;
}) {
  return (
    <div className={cn("group relative", deleting && "opacity-40")}>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          disabled={deleting}
          aria-label={`${entry.name} verwijderen`}
          title="Verwijderen uit personages"
          className="absolute -top-1.5 -right-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-white text-foreground/50 shadow-md ring-1 ring-foreground/10 transition-colors hover:bg-rose-100 hover:text-rose-600 active:scale-90 dark:bg-slate-800"
        >
          <X className="size-3.5" strokeWidth={2.5} />
        </button>
      )}
      <button
        type="button"
        onClick={onToggle}
        disabled={deleting}
        title={entry.name}
        className={cn(
          "flex w-full flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center transition-all active:scale-[0.97] sm:py-3.5",
          selected
            ? "-translate-y-0.5 border-primary bg-primary/10 shadow-md dark:bg-primary/15"
            : "border-primary/25 bg-white/60 hover:border-primary/60 hover:shadow-sm dark:bg-white/5",
        )}
      >
        <span className="relative size-16 shrink-0 overflow-hidden rounded-full bg-foreground/5 ring-2 ring-foreground/10 sm:size-20">
          {entry.portraitUrl ? (
            <Image
              src={entry.portraitUrl}
              alt={entry.name}
              fill
              className="object-cover object-top"
              sizes="(max-width: 640px) 64px, 80px"
            />
          ) : (
            <span className="flex size-full items-center justify-center">
              <Sparkles className="size-6 text-foreground/40 sm:size-7" />
            </span>
          )}
        </span>
        <span className="line-clamp-2 min-h-[2.1em] w-full text-xs font-bold leading-tight text-foreground sm:text-sm">
          {entry.name}
        </span>
        <span className="text-[10px] font-semibold text-foreground/50 sm:text-xs">
          {entry.savedCharacterId ? "Held" : "Uit boek"}
        </span>
      </button>
    </div>
  );
}

function CompanionGroup({
  title,
  characters,
  expanded,
  allowCollapse,
  onToggleExpand,
  selectedIds,
  onToggle,
  onDelete,
  deletingId,
}: {
  title: string;
  characters: SavedCharacter[];
  expanded: boolean;
  allowCollapse: boolean;
  onToggleExpand: () => void;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onDelete: (character: SavedCharacter) => void;
  deletingId: string | null;
}) {
  if (characters.length === 0) return null;

  const selected = characters.filter((c) => selectedIds.includes(c.id));
  const rest = characters.filter((c) => !selectedIds.includes(c.id));
  const preview = [...selected, ...rest].slice(0, COMPANION_PREVIEW);
  const visible = expanded ? characters : preview;
  const hiddenCount = characters.length - preview.length;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold uppercase tracking-wide text-foreground/50 sm:text-sm">
        {title}
      </p>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {visible.map((c) => (
          <CharacterOptionTile
            key={c.id}
            character={c}
            selected={selectedIds.includes(c.id)}
            onToggle={() => onToggle(c.id)}
            onDelete={() => onDelete(c)}
            deleting={deletingId === c.id}
          />
        ))}
      </div>
      {allowCollapse && hiddenCount > 0 && (
        <button
          type="button"
          onClick={onToggleExpand}
          className="self-start text-sm font-semibold text-primary underline-offset-2 hover:underline"
        >
          {expanded ? "Minder tonen" : `Nog ${hiddenCount} erbij`}
        </button>
      )}
    </div>
  );
}

function CharacterOptionTile({
  character,
  selected,
  onToggle,
  onDelete,
  deleting,
}: {
  character: SavedCharacter;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const isHero = character.kind === "hero";
  return (
    <div className={cn("group relative", deleting && "opacity-40")}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        disabled={deleting}
        aria-label={`${character.name} verwijderen`}
        title="Verwijderen"
        className="absolute -top-1.5 -right-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-white text-foreground/50 shadow-md ring-1 ring-foreground/10 transition-colors hover:bg-rose-100 hover:text-rose-600 active:scale-90 dark:bg-slate-800"
      >
        <X className="size-3.5" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={onToggle}
        disabled={deleting}
        title={character.name}
        className={cn(
          "flex w-full flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center transition-all active:scale-[0.97] sm:py-3.5",
          selected
            ? "-translate-y-0.5 border-primary bg-primary/10 shadow-md dark:bg-primary/15"
            : "border-primary/25 bg-white/60 hover:border-primary/60 hover:shadow-sm dark:bg-white/5",
        )}
      >
        <span className="relative size-16 shrink-0 overflow-hidden rounded-full bg-foreground/5 ring-2 ring-foreground/10 sm:size-20">
          {character.portraitUrl ? (
            <Image
              src={character.portraitUrl}
              alt={character.name}
              fill
              className="object-cover object-top"
              sizes="(max-width: 640px) 64px, 80px"
            />
          ) : (
            <span className="flex size-full items-center justify-center">
              {isHero ? (
                <Sparkles className="size-6 text-foreground/40 sm:size-7" />
              ) : (
                <Users className="size-6 text-foreground/40 sm:size-7" />
              )}
            </span>
          )}
        </span>
        <span className="line-clamp-2 min-h-[2.1em] w-full text-xs font-bold leading-tight text-foreground sm:text-sm">
          {character.name}
        </span>
        <span className="text-[10px] font-semibold text-foreground/50 sm:text-xs">
          {character.seriesNote ?? (isHero ? "Held" : "Bijfiguur")}
        </span>
      </button>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-4 text-sm font-bold transition-all active:scale-[0.97] sm:gap-2 sm:py-5 sm:text-base",
        "bg-white/85 shadow-sm dark:bg-white/10",
        active
          ? "-translate-y-0.5 border-primary bg-primary/10 text-primary shadow-md dark:bg-primary/15 dark:text-primary"
          : "border-primary/35 text-foreground/80 hover:border-primary/60 hover:shadow-md",
      )}
    >
      <Icon className="size-7 sm:size-8" strokeWidth={2.5} />
      <span>{label}</span>
      <span className="text-[11px] font-medium opacity-70 sm:text-xs">{hint}</span>
    </button>
  );
}

function StepBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground sm:h-7 sm:w-7 sm:text-base">
      {children}
    </span>
  );
}

function StepSection({
  badge,
  title,
  subtitle,
  children,
}: {
  badge: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 sm:gap-4">
      <div className="flex items-start gap-2.5">
        <StepBadge>{badge}</StepBadge>
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-xl font-bold text-foreground sm:text-2xl">{title}</h2>
          {subtitle && <p className="text-sm text-foreground/60 sm:text-base">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 sm:gap-2">
      <Label className="text-sm font-semibold text-foreground/80 sm:text-base">{label}</Label>
      {children}
    </div>
  );
}
