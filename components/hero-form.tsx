"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
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

// Speelse, minimalistische lijn-iconen (lucide) per genre — één kleur (foreground), dikke ronde
// lijn. Vervangt de oude GENRE_EMOJI-map (zie lib/image-styles.ts voor de stijl-iconen).
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
  power: string;
  weakness: string;
  enemy: string;
  genre: Genre | null;
  appearance: string;
  styleId: ImageStyleId;
};

const EMPTY_FORM: FormState = {
  authorName: "",
  name: "",
  age: "8",
  world: "",
  power: "",
  weakness: "",
  enemy: "",
  genre: null,
  appearance: "",
  styleId: DEFAULT_IMAGE_STYLE_ID,
};

// Vak-stijl voor invoervelden: eigen kaart-achtergrond i.p.v. doorzichtige input — daardoor
// vallen de velden niet meer weg op de crème site-achtergrond en voelt elk veld als "echt vak".
const INPUT_CARD =
  "bg-white/85 dark:bg-white/10 border-2 border-amber-300/60 shadow-sm focus-visible:border-amber-500 focus-visible:ring-amber-400/40";

type StartMode = "new" | "existing";

export function HeroForm({ initialCharacterId }: { initialCharacterId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Personagens-bibliotheek: keuze bovenaan "bestaande held" vs "nieuwe held".
  // Bij "bestaande" vullen we naam + uiterlijk + stijl in vanuit de bibliotheek; de
  // per-verhaal-velden (wereld, kracht, zwakte, tegenstander, genre) blijven vrij.
  const [mode, setMode] = useState<StartMode>(initialCharacterId ? "existing" : "new");
  const [characters, setCharacters] = useState<SavedCharacter[]>([]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [charactersError, setCharactersError] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    initialCharacterId ?? null,
  );
  // Wordt gezet zodra we het personage-object van initialCharacterId hebben opgehaald —
  // dan vullen we het formulier eenmalig in. Vlaggetje voorkomt dat een latere gebruikers-
  // selectie overschreven wordt door een herhaal-effect.
  const [initialApplied, setInitialApplied] = useState(false);
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null);
  const initialAppliedRef = useRef(initialApplied);
  initialAppliedRef.current = initialApplied;

  // Bijfiguren die mogen terugkeren in dit NIEUWE verhaal — los van de held-keuze hierboven.
  // Je kunt dus tegelijk een held kiezen (bestaand of nieuw) ÉN één of meer bestaande
  // bijfiguren aanvinken; die twee keuzes staan niet meer in dezelfde lijst.
  const [selectedSideCharacterIds, setSelectedSideCharacterIds] = useState<string[]>([]);

  // Haalt de personagens-bibliotheek op. Met een harde timeout (AbortController): zonder dat
  // bleef "Personages laden…" bij een trage/vastgelopen verbinding eeuwig staan, zonder
  // foutmelding of een manier om het opnieuw te proberen — dat voelde voor een kind aan als
  // "het werkt niet". Na de timeout (of een echte netwerkfout) tonen we nu een duidelijke
  // melding MET een "Opnieuw proberen"-knop.
  const loadCharacters = useCallback(async () => {
    setLoadingCharacters(true);
    setCharactersError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch("/api/characters", { signal: controller.signal });
      if (!res.ok) throw new Error("laden mislukte");
      const data: { characters: SavedCharacter[] } = await res.json();
      // Élk opgeslagen personage (held óf bijfiguur) is kandidaat om een nieuw verhaal mee te
      // starten — een leuk nevenpersonage uit een vorig boek mag net zo goed de nieuwe
      // hoofdheld worden.
      const options = (data.characters ?? []).slice();
      setCharacters(options);
      // Eerste keer met initialCharacterId: meteen voorselecteren + formulier invullen.
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

  // De personagens-bibliotheek is nu voor TWEE dingen nodig — de held-keuze (alleen zichtbaar
  // bij mode "existing") én de bijfiguren-keuze (altijd zichtbaar, ook bij een nieuwe held) —
  // dus laden we hem altijd meteen bij het openen van dit formulier, één keer.
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
      // Probeer de stijl-tegel te vinden die bij het opgeslagen imageStyleHint hoort — zo
      // staat de juiste tegel meteen voor-gevuld en kan het kind die (indien gewenst) nog
      // veranderen.getImageStyleByHint heeft een veilige terugval naar "default".
      styleId: getImageStyleByHint(c.imageStyleHint).id,
    }));
    // Als dit personage net nog als bijfiguur aangevinkt stond, mag het niet ALSNOG dubbel
    // als bijfiguur meegegeven worden nu het de held is.
    setSelectedSideCharacterIds((prev) => prev.filter((x) => x !== c.id));
  }

  function switchMode(next: StartMode) {
    setMode(next);
    if (next === "new") {
      // Terug naar "verzin zelf" — agenda leegmaken maar naam/leeftijd van het kind behouden
      // (dat zijn geen held-eigenschappen, dat is van het kind zelf).
      setSelectedCharacterId(null);
      setForm((prev) => ({ ...EMPTY_FORM, authorName: prev.authorName, age: prev.age }));
    }
  }

  // Geldigheid: bij "bestaande" moet een personage gekozen zijn; de appearance is dan al
  // ingevuld vanuit de bibliotheek en hoeft niet opnieuw getypt. Bij "nieuwe" blijft de
  // appearance een verplicht veld.
  const baseValid =
    form.authorName.trim() &&
    form.name.trim() &&
    form.world.trim() &&
    form.power.trim() &&
    form.weakness.trim() &&
    form.enemy.trim() &&
    form.genre &&
    Number(form.age) >= 4 &&
    Number(form.age) <= 14;
  const appearanceValid = mode === "existing" ? Boolean(selectedCharacterId) : form.appearance.trim().length > 0;
  const isValid = Boolean(baseValid && appearanceValid);

  // "Bestaand personage" toont alleen helden/hoofdpersonages — een bijfiguur als nieuwe held
  // kiezen kon eerder wel, maar bleek verwarrend naast de apart bijfiguren-keuze hieronder.
  const heroCandidates = characters.filter((c) => c.kind === "hero");
  // De bijfiguren-keuze toont juist alleen bijfiguren — helemaal los van welke held gekozen is.
  const sideCandidates = characters.filter((c) => c.kind === "side");

  // Gedeelde laad-/foutstatus voor de personagens-bibliotheek — hergebruikt door zowel de
  // held-tegels (alleen zichtbaar bij "bestaand personage") als de bijfiguren-tegels
  // (altijd zichtbaar), zodat een mislukte/langzame lading maar op één plek uitgelegd wordt.
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) {
      setError("Vul alle velden in (ook je eigen naam) en kies een leeftijd tussen 4 en 14.");
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
            power: form.power.trim(),
            weakness: form.weakness.trim(),
            enemy: form.enemy.trim(),
            genre: form.genre,
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
      router.push(`/verhaal/${data.story.id}/lezen`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er ging iets mis.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8 sm:gap-10">
      {/* ────────── Vooraf: naam + leeftijd van het kind (geen stap — gaat over het kind, niet
          over de held). Compact bovenaan, daarna beginnen de genummerde stappen pas. De naam
          hier is de ECHTE naam van het kind (de "auteur" op de boekenplank) — dat is iets
          anders dan de naam van de held in stap 2, die mag gewoon verzonnen zijn. ────────── */}
      <section className="flex flex-col gap-2.5 sm:gap-3">
        <h2 className="font-heading text-lg font-bold text-foreground/80 sm:text-xl">
          Wat is jouw naam en leeftijd?
        </h2>
        <p className="text-sm text-foreground/60 sm:text-base">
          Zo weten we wie dit boek geschreven heeft, en hoe we de zinnen moeten schrijven.
        </p>
        <div className="flex flex-wrap gap-4">
          <Field label="Naam van het kind">
            <Input
              value={form.authorName}
              onChange={(e) => update("authorName", e.target.value)}
              placeholder="Bijv. Rens"
              maxLength={30}
              className={cn("h-12 w-40 rounded-xl text-base sm:h-14 sm:w-48 sm:text-lg", INPUT_CARD)}
            />
          </Field>
          <Field label="Leeftijd van het kind">
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

      {/* ────────── Stap 1 · Kies een begin ────────── */}
      <StepSection badge={1} title="Kies een begin" subtitle="Neem je een held mee uit je personages, of verzin een nieuwe?">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <ModeButton
            active={mode === "existing"}
            onClick={() => switchMode("existing")}
            icon={Users}
            label="Bestaand personage"
            hint="Uit mijn personages"
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
          <div className="flex flex-col gap-2.5 rounded-2xl border-2 border-amber-300/60 bg-white/85 p-3 shadow-sm sm:p-4 dark:bg-white/10">
            {renderLoadStatus()}
            {!loadingCharacters && !charactersError && heroCandidates.length === 0 && (
              <p className="text-sm text-foreground/60">
                Nog geen opgeslagen helden. Verzin er hieronder zelf één, of sla een held op
                vanuit een van je boeken (knop &quot;Sla op als personage&quot;).
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
      </StepSection>

      {/* ────────── Bijfiguren die mogen terugkeren — los van de held-keuze hierboven, en
          daarom altijd zichtbaar (ook bij een gloednieuwe held). Meerdere tegels mogen
          tegelijk aangetikt staan. Elke aangevinkte bijfiguur krijgt bij het aanmaken
          gegarandeerd een eigen plaatje (zie app/api/stories/route.ts). ────────── */}
      <section className="flex flex-col gap-2.5 sm:gap-3">
        <h2 className="font-heading text-lg font-bold text-foreground sm:text-xl">
          Bijfiguren die terugkomen{" "}
          <span className="font-body text-sm font-normal text-foreground/50">(optioneel)</span>
        </h2>
        <p className="text-sm text-foreground/60 sm:text-base">
          Tik personages aan die ook in dit verhaal mogen meespelen. Ze krijgen gegarandeerd een
          eigen plaatje.
        </p>
        {renderLoadStatus()}
        {!loadingCharacters && !charactersError && sideCandidates.length === 0 && (
          <p className="text-sm text-foreground/60">
            Nog geen opgeslagen bijfiguren. Sla een leuk nevenpersonage op vanuit een van je
            boeken (knop &quot;Sla op als personage&quot;) om hem hier later te kunnen kiezen.
          </p>
        )}
        {sideCandidates.length > 0 && (
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
        )}
      </section>

      {/* ────────── Stap 2 · Wie is je held? (naam, wereld, kracht, zwakte, tegenstander) ────────── */}
      <StepSection
        badge={2}
        title="Wie is je held?"
        subtitle={mode === "existing"
          ? "De naam komt uit je personages. De wereld, kracht, zwakte en tegenstander kies je per verhaal."
          : "Verzin samen een naam en een wereld. Kracht, zwakte en tegenstander maken het verhaal spannend."}
      >
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          <Field label="Naam van je held">
            <Input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Bijv. Finn"
              maxLength={30}
              className={cn("h-12 rounded-xl text-base sm:h-14 sm:text-lg", INPUT_CARD)}
            />
          </Field>

          <Field label="In welke wereld speelt het verhaal?">
            <Input
              value={form.world}
              onChange={(e) => update("world", e.target.value)}
              placeholder="Bijv. Sterrenwoud"
              maxLength={40}
              className={cn("h-12 rounded-xl text-base sm:h-14 sm:text-lg", INPUT_CARD)}
            />
          </Field>

          <Field label="Superkracht">
            <Input
              value={form.power}
              onChange={(e) => update("power", e.target.value)}
              placeholder="Bijv. praten met dieren"
              maxLength={40}
              className={cn("h-12 rounded-xl text-base sm:h-14 sm:text-lg", INPUT_CARD)}
            />
          </Field>

          <Field label="Zwakte">
            <Input
              value={form.weakness}
              onChange={(e) => update("weakness", e.target.value)}
              placeholder="Bijv. bang in het donker"
              maxLength={40}
              className={cn("h-12 rounded-xl text-base sm:h-14 sm:text-lg", INPUT_CARD)}
            />
          </Field>

          <Field label="Tegenstander">
            <Input
              value={form.enemy}
              onChange={(e) => update("enemy", e.target.value)}
              placeholder="Bijv. de Schaduwwolf"
              maxLength={40}
              className={cn("h-12 rounded-xl text-base sm:h-14 sm:text-lg", INPUT_CARD)}
            />
          </Field>
        </div>
      </StepSection>

      {/* ────────── Stap 3 · Hoe ziet je held eruit? (appearance textarea) ────────── */}
      <StepSection
        badge={3}
        title="Hoe ziet je held eruit?"
        subtitle={mode === "existing"
          ? "Dit uiterlijk komt uit je personages — je kunt het hier nog aanpassen voor dit verhaal."
          : "Verzin het helemaal zelf — haar, kleuren, kleding, alles mag."}
      >
        <Textarea
          value={form.appearance}
          onChange={(e) => update("appearance", e.target.value)}
          placeholder="Bijv. groene krullen, een cape vol sterren en een staart als een vos..."
          maxLength={250}
          className={cn("min-h-[100px] rounded-xl text-base sm:min-h-[120px] sm:text-lg", INPUT_CARD)}
        />
      </StepSection>

      {/* ────────── Stap 4 · Kies een tekenstijl ────────── */}
      <StepSection
        badge={4}
        title="Kies een tekenstijl"
        subtitle="In welke stijl moeten de plaatjes van je held getekend worden?"
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
                  "bg-white/85 dark:bg-white/10 shadow-sm",
                  selected
                    ? "border-amber-500 bg-amber-50/90 dark:bg-amber-400/15 shadow-md -translate-y-0.5"
                    : "border-amber-300/60 hover:border-amber-400/80 hover:shadow-md",
                )}
              >
                {/* swatch als zacht kleur-accent achter het lijn-icoon (geen vak-vul meer) */}
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

      {/* ────────── Stap 5 · Welk genre? ────────── */}
      <StepSection
        badge={5}
        title="Welk genre?"
        subtitle="Het genre bepaalt de sfeer van het hele boek."
      >
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
                    ? "border-amber-500 bg-amber-50/90 dark:bg-amber-400/15 text-amber-700 dark:text-amber-200 shadow-md -translate-y-0.5"
                    : "border-amber-300/60 text-foreground/80 hover:border-amber-400/80 hover:shadow-md",
                )}
              >
                <Icon className="size-7 sm:size-8" strokeWidth={2.5} />
                {label}
              </button>
            );
          })}
        </div>
      </StepSection>

      {error && (
        <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{error}</p>
      )}

      <Button
        type="submit"
        disabled={!isValid || submitting}
        className="h-14 rounded-2xl bg-amber-400 text-lg font-bold text-amber-950 hover:bg-amber-300 disabled:opacity-50 sm:h-16 sm:text-xl"
      >
        {submitting ? "Het verhaal begint…" : "Begin het avontuur ✨"}
      </Button>
    </form>
  );
}

// Eén tegel in een personage-kiesgrid — gebruikt voor zowel de held-keuze (in dat geval
// werkt onToggle als "kies dit als held") als de bijfiguren-keuze (onToggle vinkt aan/uit).
// line-clamp-2 + een gereserveerde minimumhoogte voorkomen dat lange namen (zoals "Het
// Kauwgomballen Monster") afgekapt worden of de rest van het rooster scheeftrekken.
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
            ? "border-amber-500 bg-amber-50/90 dark:bg-amber-400/15 shadow-md -translate-y-0.5"
            : "border-amber-200/60 hover:border-amber-400/80 hover:shadow-sm bg-white/60 dark:bg-white/5",
        )}
      >
        <span className="relative size-16 shrink-0 overflow-hidden rounded-full ring-2 ring-foreground/10 bg-foreground/5 sm:size-20">
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
        {/* Label zodat duidelijk is dat ook bijfiguren hier gekozen kunnen worden als nieuwe
            hoofdheld — anders lijkt deze lijst per ongeluk nog steeds "alleen helden". */}
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
        "bg-white/85 dark:bg-white/10 shadow-sm",
        active
          ? "border-amber-500 bg-amber-50/90 dark:bg-amber-400/15 text-amber-700 dark:text-amber-200 shadow-md -translate-y-0.5"
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
          {subtitle && (
            <p className="text-sm text-foreground/60 sm:text-base">{subtitle}</p>
          )}
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
