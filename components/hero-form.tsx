"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Compass,
  Fish,
  PawPrint,
  Rocket,
  Search,
  Sparkles,
  UserPlus,
  Users,
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

  // Alleen de helden laden zodra het kind voor "bestaande held" kiest — niet eerder (scheelt
  // een ongebruikte call). Herlaadt niet bij elke render: de effect-guard houdt dit op orde.
  useEffect(() => {
    if (mode !== "existing") return;
    if (characters.length > 0 || loadingCharacters) return;
    let cancelled = false;
    setLoadingCharacters(true);
    setCharactersError(null);
    fetch("/api/characters")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("laden mislukte"))))
      .then((data: { characters: SavedCharacter[] }) => {
        if (cancelled) return;
        // Élk opgeslagen personage (held óf bijfiguur) is kandidaat om een nieuw verhaal mee
        // te starten — een leuk nevenpersonage uit een vorig boek mag net zo goed de nieuwe
        // hoofdheld worden. Voorheen werden bijfiguren hier expres weggefilterd, wat de
        // klacht "ik kan alleen een held kiezen" verklaarde.
        const options = (data.characters ?? []).slice();
        setCharacters(options);
        // Eerste keer met initialCharacterId: meteen voorselecteren + formulier invullen.
        if (initialCharacterId && !initialApplied) {
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
      })
      .catch((err) => {
        if (cancelled) return;
        setCharactersError(err instanceof Error ? err.message : "laden mislukte");
      })
      .finally(() => {
        if (!cancelled) setLoadingCharacters(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, characters.length, loadingCharacters, initialCharacterId, initialApplied]);

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
          Voor welk kind is het boek?
        </h2>
        <p className="text-sm text-foreground/60 sm:text-base">
          Zo weten we wie de auteur is, en hoe moeilijk de zinnen moeten zijn.
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
            {loadingCharacters && (
              <p className="text-sm text-foreground/60">Personages laden…</p>
            )}
            {charactersError && (
              <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">
                {charactersError}
              </p>
            )}
            {!loadingCharacters && !charactersError && characters.length === 0 && (
              <p className="text-sm text-foreground/60">
                Nog geen opgeslagen personages. Verzin er hieronder zelf één, of sla een
                personage op vanuit een van je boeken (knop &quot;Sla op als personage&quot;).
              </p>
            )}
            {characters.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
                {characters.map((c) => {
                  const selected = selectedCharacterId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCharacter(c)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center transition-all active:scale-[0.97] sm:py-3.5",
                        selected
                          ? "border-amber-500 bg-amber-50/90 dark:bg-amber-400/15 shadow-md -translate-y-0.5"
                          : "border-amber-200/60 hover:border-amber-400/80 hover:shadow-sm bg-white/60 dark:bg-white/5",
                      )}
                    >
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-full ring-1 ring-foreground/10 bg-foreground/5">
                        {c.portraitUrl ? (
                          <Image
                            src={c.portraitUrl}
                            alt={c.name}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center">
                            <Sparkles className="size-5 text-foreground/40" />
                          </span>
                        )}
                      </span>
                      <span className="text-xs font-bold text-foreground sm:text-sm">{c.name}</span>
                      {/* Label zodat duidelijk is dat ook bijfiguren hier gekozen kunnen
                          worden als nieuwe hoofdheld — anders lijkt deze lijst per ongeluk
                          nog steeds "alleen helden". */}
                      <span className="text-[10px] font-semibold text-foreground/50 sm:text-xs">
                        {c.seriesNote ?? (c.kind === "side" ? "Bijfiguur" : "Held")}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </StepSection>

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
          : "Verzin het helemaal zelf — haar, kleuren, kleding, alles mag. Later, als je verder komt in het verhaal, unlock je nog nieuwe items voor je held."}
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
