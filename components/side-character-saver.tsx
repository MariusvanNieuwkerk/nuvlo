"use client";

import { useState } from "react";
import Image from "next/image";
import { Sparkles, X } from "lucide-react";
import { SaveCharacterButton } from "@/components/save-character-button";

// Toont de bekende nevenpersonages met per stuk een "Sla op als personage"-knop én een klein
// wegdruk-kruisje. Wegdrukken verbergt het personage meteen (optimistisch) en onthoudt dat op
// de server (POST /dismiss-side-character), zodat het niet terugkomt bij een volgende keer. Het
// personage blijft wél in de illustraties — we verbergen alleen de suggestie.
//
// Client-component omdat wegdrukken interactie + state vereist; de pagina geeft alleen de
// nog-niet-weggedrukte personages door (dismissed-filter gebeurt server-side).
export type SideCharacterItem = {
  name: string;
  appearance: unknown;
  referenceImageUrl: string | null;
};

export function SideCharacterSaver({
  storyId,
  sideCharacters,
}: {
  storyId: string;
  sideCharacters: SideCharacterItem[];
}) {
  // Namen die net weggedrukt zijn — meteen verbergen, terwijl de server-call op de achtergrond
  // loopt (bij een netwerkfout komt het personage na een refresh gewoon terug, geen crash).
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visible = sideCharacters.filter((c) => !hidden.has(c.name));
  if (visible.length === 0) return null;

  function dismiss(name: string) {
    setHidden((prev) => new Set(prev).add(name));
    void fetch(`/api/stories/${storyId}/dismiss-side-character`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => {
      // Stil falen: de suggestie blijft lokaal verborgen; bij een refresh verschijnt hij weer.
    });
  }

  // Na een succesvolle "Sla op als personage": de suggestie meteen verbergen, i.p.v. te
  // wachten tot een volgende paginalading (dan filtert de server hem alsnog eruit, zie
  // app/verhaal/[id]/lezen/page.tsx — maar dat voelt in dezelfde sessie nog steeds traag aan).
  function hideAfterSave(name: string) {
    setHidden((prev) => new Set(prev).add(name));
  }

  return (
    <section className="flex flex-col gap-2 rounded-2xl border-2 border-amber-300/60 bg-white/85 p-3 shadow-sm sm:p-4 dark:bg-white/10">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-foreground/50 sm:text-sm">
        <Sparkles className="size-3.5" />
        Bekende nevenpersonages
      </p>
      <ul className="flex flex-col gap-2">
        {visible.map((c) => (
          <li
            key={c.name}
            className="flex items-center gap-3 rounded-xl bg-foreground/5 p-2 sm:p-2.5"
          >
            <span className="relative size-10 shrink-0 overflow-hidden rounded-full bg-foreground/5 ring-1 ring-foreground/10 sm:size-12">
              {c.referenceImageUrl ? (
                <Image
                  src={c.referenceImageUrl}
                  alt={c.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 40px, 48px"
                />
              ) : (
                <span className="flex size-full items-center justify-center">
                  <Sparkles className="size-4 text-foreground/40" />
                </span>
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="truncate text-sm font-bold text-foreground sm:text-base">{c.name}</p>
              {typeof c.appearance === "object" &&
                c.appearance !== null &&
                "freeform" in (c.appearance as Record<string, unknown>) && (
                  <p className="truncate text-xs text-foreground/60 sm:text-sm">
                    {String((c.appearance as Record<string, unknown>).freeform)}
                  </p>
                )}
            </div>
            <SaveCharacterButton
              storyId={storyId}
              kind="side"
              name={c.name}
              appearance={c.appearance}
              portraitUrl={c.referenceImageUrl}
              onSaved={() => hideAfterSave(c.name)}
            />
            <button
              type="button"
              onClick={() => dismiss(c.name)}
              aria-label={`${c.name} wegdrukken`}
              title="Wegdrukken"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground/40 transition-colors hover:bg-foreground/10 hover:text-foreground/70 active:scale-95"
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
