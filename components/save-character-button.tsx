"use client";

import { useState } from "react";
import { Bookmark, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Kleine "Sla [naam] op als personage"-knop. POST naar /api/characters met fromStoryId +
// kind + naam (+ appearance/portraitUrl voor bijfiguren). Idempotent gedrag voelt het niet
// via de server (we hebben hier geen client-side zicht op de bestaande bibliotheek): na een
// succesvolle save gaat de knop naar een "Opgeslagen"-staat, zodat het kind niet per ongeluk
// dubbel opslaat door opnieuw te tikken. Fouten blijven klikbaar (opnieuw proberen).
export function SaveCharacterButton({
  storyId,
  kind,
  name,
  label,
  // Voor een bijfiguur: het gestructureerde appearance-object + de referenceImageUrl als
  // portret-anker. Voor een held: mag leeg — de server haalt die uit story.character.
  appearance,
  portraitUrl,
  className,
  size = "sm",
  // Optioneel: direct na een succesvolle save aanroepen — de aanroeper kan dit gebruiken om de
  // suggestie meteen te verbergen (net als bij wegdrukken), i.p.v. te wachten op een refresh.
  onSaved,
}: {
  storyId: string;
  kind: "hero" | "side";
  name: string;
  label?: string;
  appearance?: unknown;
  portraitUrl?: string | null;
  className?: string;
  size?: "sm" | "md";
  onSaved?: () => void;
}) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [errorText, setErrorText] = useState<string | null>(null);

  async function save() {
    setState("saving");
    setErrorText(null);
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromStoryId: storyId,
          kind,
          name,
          appearance,
          portraitUrl: portraitUrl ?? null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Opslaan mislukte");
      }
      setState("done");
      onSaved?.();
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "Opslaan mislukte");
      setState("error");
    }
  }

  const text = label ?? `Sla ${name} op als personage`;

  return (
    <button
      type="button"
      onClick={save}
      disabled={state === "saving" || state === "done"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-2 border-amber-300/60 bg-white/85 font-bold text-foreground transition-all active:scale-[0.97] disabled:cursor-default disabled:opacity-70 hover:border-amber-400/80 hover:shadow-sm dark:bg-white/10",
        size === "sm" ? "px-3 py-1.5 text-xs sm:text-sm" : "px-4 py-2.5 text-sm sm:text-base",
        state === "done" && "border-emerald-400/60 text-emerald-700 dark:text-emerald-300",
        className,
      )}
    >
      {state === "saving" ? (
        <Loader2 className="size-3.5 animate-spin sm:size-4" />
      ) : state === "done" ? (
        <Check className="size-3.5 sm:size-4" />
      ) : (
        <Bookmark className="size-3.5 sm:size-4" />
      )}
      {state === "done" ? `${name} opgeslagen` : text}
      {state === "error" && errorText && (
        <span className="ml-1 text-rose-600 dark:text-rose-300">{errorText}</span>
      )}
    </button>
  );
}
