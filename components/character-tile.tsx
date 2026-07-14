"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Sparkles, Users, X } from "lucide-react";
import type { SavedCharacter } from "@/lib/types";

// Compact cirkel-tegel voor ÉÉN opgeslagen personage (held of bijfiguur), met een klein
// wegdruk-kruisje om het personage PERMANENT uit de bibliotheek te verwijderen. Dit is
// bewust een andere actie dan het "wegdrukken" van een nevenpersonage-suggestie op een
// lees-pagina (zie components/side-character-saver.tsx) — dat verbergt alleen een suggestie
// binnen één boek, terwijl dit kruisje de personage-bibliotheek-entry écht weggooit (de
// backend hiervoor, DELETE /api/characters/[id], bestond al; deze knop miste alleen nog).
//
// Client-component omdat verwijderen interactie + een bevestiging vereist. Na een succesvolle
// verwijdering verdwijnt de tegel meteen (lokale state) — geen page refresh nodig.
export function CharacterTile({ character }: { character: SavedCharacter }) {
  const router = useRouter();
  const [deleted, setDeleted] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (deleted) return null;

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`${character.name} verwijderen uit je personages? Dit kan niet ongedaan gemaakt worden.`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/characters/${character.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("verwijderen mislukte");
      setDeleted(true);
      router.refresh();
    } catch {
      setDeleting(false);
      window.alert("Verwijderen is niet gelukt. Probeer het nog eens.");
    }
  }

  const isHero = character.kind === "hero";
  const bookCount = character.sourceStoryIds.length;
  const title = isHero
    ? character.seriesNote
      ? `${character.name} — ${character.seriesNote}`
      : character.name
    : `Bijfiguur${bookCount > 0 ? ` — komt terug in ${bookCount === 1 ? "1 boek" : `${bookCount} boeken`}` : ""}`;

  const avatar = (
    <span
      className={
        isHero
          ? "relative size-16 shrink-0 overflow-hidden rounded-full bg-foreground/5 ring-2 ring-amber-300/60 transition-all group-hover:-translate-y-0.5 group-hover:ring-amber-400 group-hover:shadow-md group-hover:shadow-amber-400/20 sm:size-20"
          : "relative size-16 shrink-0 overflow-hidden rounded-full bg-foreground/5 ring-2 ring-foreground/10 sm:size-20"
      }
    >
      {character.portraitUrl ? (
        <Image
          src={character.portraitUrl}
          alt={character.name}
          fill
          className="object-cover transition-transform duration-200 group-hover:scale-105"
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
  );

  const nameLabel = (
    <span
      className={
        isHero
          ? "line-clamp-1 w-full text-center text-xs font-bold text-foreground sm:text-sm"
          : "line-clamp-1 w-full text-center text-xs font-bold text-foreground/70 sm:text-sm"
      }
    >
      {character.name}
    </span>
  );

  return (
    <div className={`group relative flex w-16 flex-col items-center gap-1.5 sm:w-20 ${deleting ? "opacity-40" : ""}`}>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        aria-label={`${character.name} verwijderen`}
        title="Verwijderen"
        className="absolute -top-1 -right-1 z-10 flex size-6 items-center justify-center rounded-full bg-white text-foreground/50 shadow-md ring-1 ring-foreground/10 transition-colors hover:bg-rose-100 hover:text-rose-600 active:scale-90 dark:bg-slate-800"
      >
        <X className="size-3.5" strokeWidth={2.5} />
      </button>
      {isHero ? (
        <Link href={`/nieuw-verhaal?held=${character.id}`} title={title} className="flex flex-col items-center gap-1.5">
          {avatar}
          {nameLabel}
        </Link>
      ) : (
        <div title={title} className="flex flex-col items-center gap-1.5">
          {avatar}
          {nameLabel}
        </div>
      )}
    </div>
  );
}
