"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { GENRE_LABELS, type Genre, type SavedCharacter } from "@/lib/types";
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
  styleId: ImageStyleId;
};

type StartMode = "new" | "existing";
type WizardStep = 1 | 2 | 3;

const INPUT_CARD =
  "bg-white/85 dark:bg-white/10 border-2 border-amber-300/60 shadow-sm focus-visible:border-amber-500 focus-visible:ring-amber-400/40";

export function HeroForm({
  initialCharacterId,
  initialAuthorName,
  initialAge,
}: {
  initialCharacterId?: string;
  initialAuthorName?: string;
  initialAge?: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(initialCharacterId ? 2 : 1);
  const [form, setForm] = useState<FormState>({
    authorName: initialAuthorName?.trim() || "",
    name: "",
    age: String(initialAge && initialAge >= 4 && initialAge <= 14 ? initialAge : 8),
    world: "",
    genre: null,
    appearance: "",
    styleId: DEFAULT_IMAGE_STYLE_ID,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<StartMode>(initialCharacterId ? "existing" : "new");
  const [characters, setCharacters] = useState<SavedCharacter[]>([]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [charactersError, setCharactersError] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    initialCharacterId ?? null,
  );
  const [initialApplied, setInitialApplied] = useState(false);
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null);
  const initialAppliedRef = useRef(initialApplied);
  initialAppliedRef.current = initialApplied;

  const [selectedSideCharacterIds, setSelectedSideCharacterIds] = useState<string[]>([]);
  const [showSidePick, setShowSidePick] = useState(false);

  const loadCharacters = useCallback(async () => {
    setLoadingCharacters(true);
    setCharactersError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch("/api/characters", { signal: controller.signal });
      if (!res.ok) throw new Error("laden mislukte");
      const data: { characters: SavedCharacter[] } = await res.json();
      const options = (data.characters ?? []).slice();
      setCharacters(options);
      if (initialCharacterId && !initialAppliedRef.current) {
        const found = options.find((c) => c.id === initialCharacterId);
        if (found) {
          setSelectedCharacterId(found.id);
          setForm((prev) => ({
            ...prev,
            name: found.name,
            appearance: found.appearance.freeform,
            styleId: getImageStyleByHint(found.imageStyleHint).id,
          }));
        }
        setInitialApplied(true);
      }
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      setCharactersError(
        timedOut
          ? "Het laden duurt te lang. Controleer je internet en probeer het opnieuw."
          : "Laden mislukte. Probeer het opnieuw.",
      );
    } finally {
      clearTimeout(timeout);
      setLoadingCharacters(false);
    }
  }, [initialCharacterId]);

  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadCharacters();
  }, [loadCharacters]);

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
      if (!res.ok) throw new Error("verwijderen mislukte");
      setCharacters((prev) => prev.filter((x) => x.id !== c.id));
      setSelectedSideCharacterIds((prev) => prev.filter((x) => x !== c.id));
      if (selectedCharacterId === c.id) {
        setSelectedCharacterId(null);
        setForm((prev) => ({ ...prev, name: "", appearance: "" }));
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

  function selectCharacter(c: SavedCharacter) {
    setSelectedCharacterId(c.id);
    setForm((prev) => ({
      ...prev,
      name: c.name,
      appearance: c.appearance.freeform,
      styleId: getImageStyleByHint(c.imageStyleHint).id,
    }));
    setSelectedSideCharacterIds((prev) => prev.filter((x) => x !== c.id));
  }

  function switchMode(next: StartMode) {
    setMode(next);
    setError(null);
    if (next === "new") {
      setSelectedCharacterId(null);
      setForm((prev) => ({
        ...prev,
        name: "",
        appearance: "",
        styleId: DEFAULT_IMAGE_STYLE_ID,
      }));
    }
  }

  const heroCandidates = characters.filter((c) => c.kind === "hero");
  const sideCandidates = characters.filter((c) => c.kind === "side");

  const childValid =
    form.authorName.trim().length > 0 && Number(form.age) >= 4 && Number(form.age) <= 14;
  const step1Valid =
    childValid &&
    (mode === "existing"
      ? Boolean(selectedCharacterId)
      : form.name.trim().length > 0 && form.appearance.trim().length > 0);
  const step2Valid = form.world.trim().length > 0 && Boolean(form.genre);
  const canSubmit = step1Valid && step2Valid;

  function goNext() {
    setError(null);
    if (step === 1) {
      if (!step1Valid) {
        setError(
          mode === "existing"
            ? "Kies een held, en vul je naam en leeftijd in."
            : "Vul je naam, leeftijd, heldennaam en hoe je held eruitziet in.",
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
    }
  }

  function goBack() {
    setError(null);
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step !== 3) {
      goNext();
      return;
    }
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
            // Kracht/zwakte/vijand vult de server in per genre — UX vraagt ze niet meer.
          },
          age: Number(form.age),
          appearance: form.appearance.trim(),
          styleId: form.styleId,
          existingCharacterId: selectedCharacterId ?? undefined,
          existingSideCharacterIds:
            selectedSideCharacterIds.length > 0 ? selectedSideCharacterIds : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Er ging iets mis.");
      }
      const data = await res.json();
      if (selectedCharacterId) {
        writeActiveHeroId(selectedCharacterId);
      } else {
        writeActiveHeroId(`name:${form.name.trim().toLowerCase()}`);
      }
      router.push(`/verhaal/${data.story.id}/lezen`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er ging iets mis.");
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
    <form onSubmit={onSubmit} className="flex flex-col gap-6 sm:gap-8">
      <StepDots current={step} />

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
                hint="Uit je personages"
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
                {!loadingCharacters && !charactersError && heroCandidates.length === 0 && (
                  <p className="text-sm text-foreground/60">
                    Nog geen opgeslagen helden. Kies &quot;Nieuwe held&quot;, of sla een held op
                    vanuit een boek.
                  </p>
                )}
                {heroCandidates.length > 0 && (
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3">
                    {heroCandidates.map((c) => (
                      <CharacterOptionTile
                        key={c.id}
                        character={c}
                        selected={selectedCharacterId === c.id}
                        onToggle={() => selectCharacter(c)}
                        onDelete={() => void handleDeleteCharacter(c)}
                        deleting={deletingCharacterId === c.id}
                      />
                    ))}
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
                          ? "border-amber-500 bg-amber-50/90 text-amber-700 shadow-md -translate-y-0.5 dark:bg-amber-400/15 dark:text-amber-200"
                          : "border-amber-300/60 text-foreground/80 hover:border-amber-400/80 hover:shadow-md",
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

          {sideCandidates.length > 0 && (
            <section className="flex flex-col gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setShowSidePick((v) => !v)}
                className="text-left text-sm font-semibold text-foreground/70 underline-offset-2 hover:underline sm:text-base"
              >
                {showSidePick ? "Bijfiguren verbergen" : "Neem iemand mee? (optioneel)"}
                {selectedSideCharacterIds.length > 0 && !showSidePick
                  ? ` · ${selectedSideCharacterIds.length} gekozen`
                  : ""}
              </button>
              {showSidePick && (
                <>
                  <p className="text-sm text-foreground/60">
                    Tik personages aan die ook mogen meespelen.
                  </p>
                  {renderLoadStatus()}
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3">
                    {sideCandidates.map((c) => (
                      <CharacterOptionTile
                        key={c.id}
                        character={c}
                        selected={selectedSideCharacterIds.includes(c.id)}
                        onToggle={() => toggleSideCharacter(c.id)}
                        onDelete={() => void handleDeleteCharacter(c)}
                        deleting={deletingCharacterId === c.id}
                      />
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      )}

      {step === 3 && (
        <StepSection
          badge={3}
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
                      ? "-translate-y-0.5 border-amber-500 bg-amber-50/90 shadow-md dark:bg-amber-400/15"
                      : "border-amber-300/60 hover:border-amber-400/80 hover:shadow-md",
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
        {step < 3 ? (
          <Button
            type="button"
            onClick={goNext}
            className="h-14 flex-1 rounded-2xl bg-amber-400 text-lg font-bold text-amber-950 hover:bg-amber-300 sm:h-16 sm:text-xl"
          >
            Verder
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={!canSubmit || submitting}
            className="h-14 flex-1 rounded-2xl bg-amber-400 text-lg font-bold text-amber-950 hover:bg-amber-300 disabled:opacity-50 sm:h-16 sm:text-xl"
          >
            {submitting ? "Het verhaal begint…" : "Begin het avontuur ✨"}
          </Button>
        )}
      </div>
    </form>
  );
}

function StepDots({ current }: { current: WizardStep }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-label={`Stap ${current} van 3`}>
      {([1, 2, 3] as WizardStep[]).map((n) => (
        <span
          key={n}
          className={cn(
            "h-2 rounded-full transition-all",
            n === current ? "w-8 bg-amber-400" : "w-2 bg-foreground/15",
          )}
        />
      ))}
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
            ? "-translate-y-0.5 border-amber-500 bg-amber-50/90 shadow-md dark:bg-amber-400/15"
            : "border-amber-200/60 bg-white/60 hover:border-amber-400/80 hover:shadow-sm dark:bg-white/5",
        )}
      >
        <span className="relative size-16 shrink-0 overflow-hidden rounded-full bg-foreground/5 ring-2 ring-foreground/10 sm:size-20">
          {character.portraitUrl ? (
            <Image
              src={character.portraitUrl}
              alt={character.name}
              fill
              className="object-cover"
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
          ? "-translate-y-0.5 border-amber-500 bg-amber-50/90 text-amber-700 shadow-md dark:bg-amber-400/15 dark:text-amber-200"
          : "border-amber-300/60 text-foreground/80 hover:border-amber-400/80 hover:shadow-md",
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
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-extrabold text-amber-950 sm:h-7 sm:w-7 sm:text-base">
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
