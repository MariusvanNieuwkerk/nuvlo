"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PenLine, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

const LETTER_STYLES = [
  {
    card: "bg-amber-400/15 border-amber-400/40 hover:bg-amber-400/25",
    badge: "bg-amber-400 text-amber-950",
  },
  {
    card: "bg-sky-400/15 border-sky-400/40 hover:bg-sky-400/25",
    badge: "bg-sky-400 text-sky-950",
  },
  {
    card: "bg-emerald-400/15 border-emerald-400/40 hover:bg-emerald-400/25",
    badge: "bg-emerald-400 text-emerald-950",
  },
];

const LETTERS = ["A", "B", "C"];
const OWN_IDEA_MAX_LENGTH = 140;

export function ChoiceButtons({
  storyId,
  choices,
  heroName,
  chapterN,
}: {
  storyId: string;
  choices: string[];
  heroName?: string;
  // Het hoofdstuknummer waarop deze keuze hoort. Gaat mee naar de server als idempotentie-
  // sleutel: zo herkent de server een dubbele inzending (snelle dubbele tik / refresh) en
  // voegt hij nooit per ongeluk twee hoofdstukken toe (zie de choice-route).
  chapterN?: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownIdeaOpen, setOwnIdeaOpen] = useState(false);
  const [ownIdea, setOwnIdea] = useState("");

  async function choose(choice: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/choice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice, fromChapter: chapterN }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Er ging iets mis.");
      }
      // Bewust GEEN setPending(false) hier: het laadscherm blijft staan tot BookPager
      // (na router.refresh()) automatisch naar de nieuwe pagina springt en dit component
      // verdwijnt. Zo geen korte flikkering terug naar de oude keuzeknoppen.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er ging iets mis.");
      setPending(false);
    }
  }

  function submitOwnIdea() {
    const trimmed = ownIdea.trim();
    if (!trimmed) return;
    choose(trimmed);
  }

  // Sinds de gesplitste choice-flow wacht deze knop alleen nog op de TEKST van het nieuwe
  // hoofdstuk (fase A, ~10-20s) — niet meer op de illustratie. Die wordt daarna op de
  // achtergrond getekend terwijl het kind al leest (fase B, zie book-pager.tsx), en verschijnt
  // straks als beloning. Daarom is dit laadmoment nu kort en gaat het puur over het schrijven.
  // Zodra het antwoord binnen is roept choose() router.refresh() aan en springt BookPager
  // vanzelf naar de nieuwe bladzijde — er is dus geen extra klik nodig.
  if (pending) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-amber-400/40 bg-amber-400/10 p-6 text-center sm:gap-4 sm:rounded-3xl sm:p-8">
        <div className="relative flex size-12 items-center justify-center sm:size-14">
          <Loader2 className="size-12 animate-spin text-amber-500 sm:size-14" />
          <Sparkles className="absolute size-5 text-amber-600 sm:size-6" />
        </div>
        <p className="font-heading text-base font-bold text-amber-800 sm:text-lg dark:text-amber-200">
          {heroName ? `${heroName} bedenkt het vervolg…` : "Het vervolg wordt bedacht…"}
        </p>
        <p className="text-sm text-amber-800/70 sm:text-base dark:text-amber-100/70">
          De nieuwe bladzijde wordt geschreven — dat duurt maar even. De tekening komt er daarna
          vanzelf bij terwijl je leest.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {choices.map((choice, index) => {
          const style = LETTER_STYLES[index % LETTER_STYLES.length];
          return (
            <button
              key={choice}
              type="button"
              disabled={pending}
              onClick={() => choose(choice)}
              className={cn(
                "flex flex-col items-start gap-2.5 rounded-2xl border-2 p-4 text-left shadow-md transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none sm:gap-3 sm:rounded-3xl sm:p-5",
                style.card,
                pending && "opacity-70",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full font-heading text-base font-extrabold shadow-sm sm:size-11 sm:text-lg",
                  style.badge,
                )}
              >
                {LETTERS[index]}
              </span>
              <span className="text-base font-semibold text-foreground sm:text-lg">
                {choice.replace(/^[A-C]\.\s*/, "")}
              </span>
            </button>
          );
        })}
      </div>

      {ownIdeaOpen ? (
        <div className="flex flex-col gap-2.5 rounded-2xl border-2 border-violet-400/40 bg-violet-400/10 p-4 sm:gap-3 sm:rounded-3xl sm:p-5">
          <p className="text-sm font-semibold text-foreground/70 sm:text-base">
            Wat gebeurt er nu volgens jou?
          </p>
          <Textarea
            value={ownIdea}
            onChange={(e) => setOwnIdea(e.target.value)}
            maxLength={OWN_IDEA_MAX_LENGTH}
            placeholder="Bijv. Rens klimt in de boom en fluit naar het figuurtje..."
            disabled={pending}
            className="min-h-[70px] rounded-xl bg-background text-base sm:text-lg"
            autoFocus
          />
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={pending || !ownIdea.trim()}
              onClick={submitOwnIdea}
              className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 sm:px-5 sm:py-3 sm:text-base"
            >
              {pending ? "Het verhaal gaat verder…" : "Ga zo verder!"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setOwnIdeaOpen(false);
                setOwnIdea("");
              }}
              className="rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground/50 hover:text-foreground/80 sm:text-base"
            >
              Toch niet
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => setOwnIdeaOpen(true)}
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-400/50 bg-amber-400/10 p-3.5 text-sm font-semibold text-amber-900/80 transition-all hover:border-amber-400/80 hover:bg-amber-400/15 hover:text-amber-950 disabled:pointer-events-none sm:p-4 sm:text-base dark:text-amber-100/90 dark:hover:text-amber-50"
        >
          <PenLine className="size-4 sm:size-5" />
          Schrijf zelf wat er gebeurt
        </button>
      )}

      {error && (
        <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{error}</p>
      )}
    </div>
  );
}
