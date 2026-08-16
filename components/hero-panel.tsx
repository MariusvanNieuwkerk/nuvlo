"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Backpack } from "lucide-react";

// Toont de held zoals het kind hem NU kent: het huidige portret, de verzamelde voorwerpen, en
// — als het portret sinds de vorige sessie veranderd is — één keer een warm "kijk, [held] is
// veranderd sinds gisteren"-moment. Dat maakt de uitgestelde beloning (het pending-portret dat
// pas de volgende sessie zichtbaar wordt) eindelijk echt voelbaar: een reden om terug te komen.
// Geen "opslaan"-knop hier: de held is al de hoofdfiguur. Alleen nieuwe bijfiguren uit het
// verhaal mogen bewaard worden (zie SideCharacterSaver).
export function HeroPanel({
  storyId,
  heroName,
  portraitUrl,
  items,
  hasUnseenPortrait,
}: {
  storyId: string;
  heroName: string;
  portraitUrl: string | null;
  items: string[];
  hasUnseenPortrait: boolean;
}) {
  // Lokaal onthouden of we het "veranderd"-moment tonen. We starten met de serverwaarde en
  // laten hem staan zolang het component leeft, ook nadat we de server "gezien" gemeld hebben —
  // anders zou de mooie onthulling meteen weer verdwijnen.
  const [showReveal, setShowReveal] = useState(hasUnseenPortrait);
  const acknowledged = useRef(false);

  useEffect(() => {
    if (!hasUnseenPortrait || acknowledged.current) return;
    acknowledged.current = true;
    // Eén keer bevestigen dat het kind de verandering gezien heeft, zodat het niet opnieuw
    // verschijnt (niet zeurderig). Faalt dit netwerkverzoek, dan is dat geen ramp — het moment
    // komt dan hooguit nog een keer terug.
    fetch(`/api/stories/${storyId}/portrait-seen`, { method: "POST" }).catch(() => {});
  }, [hasUnseenPortrait, storyId]);

  if (!portraitUrl && items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {showReveal && portraitUrl && (
        <button
          type="button"
          onClick={() => setShowReveal(false)}
          className="reward-reveal flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 p-3 text-left sm:gap-4 sm:p-4"
        >
          <span className="relative size-14 shrink-0 overflow-hidden rounded-full ring-2 ring-primary/40 sm:size-16">
            <Image src={portraitUrl} alt={`${heroName} nu`} fill className="object-cover object-center" />
          </span>
          <div className="flex flex-col">
            <p className="flex items-center gap-1.5 font-heading text-sm font-bold text-primary sm:text-base dark:text-primary">
              <Sparkles className="size-4" />
              Kijk! {heroName} is veranderd sinds gisteren
            </p>
            <p className="text-xs text-foreground/60 sm:text-sm">
              Tik om te sluiten.
            </p>
          </div>
        </button>
      )}

      {/* Bewust GEEN kaart/kader hier (geen border, geen achtergrondvlak) — puur op de
          paginakleur, net zoals de rest van de pagina. */}
      <div className="flex items-center gap-3 sm:gap-4">
        {portraitUrl ? (
          <span className="relative size-12 shrink-0 overflow-hidden rounded-full ring-1 ring-foreground/10 sm:size-14">
            <Image src={portraitUrl} alt={heroName} fill className="object-cover object-center" />
          </span>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-bold text-foreground sm:text-base">{heroName}</p>
          {items.length > 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-foreground/60 sm:text-sm">
              <Backpack className="size-3.5 shrink-0 text-foreground/40 sm:size-4" />
              <span className="truncate">Verzameld: {items.join(", ")}</span>
            </p>
          ) : (
            <p className="text-xs text-foreground/50 sm:text-sm">Nog niets verzameld — lees verder!</p>
          )}
        </div>
      </div>
    </div>
  );
}
