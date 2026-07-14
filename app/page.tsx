import Link from "next/link";
import Image from "next/image";
import { Sparkles, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { StoryCard } from "@/components/story-card";
import { NewStoryTile } from "@/components/new-story-tile";
import { listCharacters, listStories } from "@/lib/storage";
import type { SavedCharacter } from "@/lib/types";

// Altijd vers renderen: de boekenplank leest live uit Supabase. Zonder dit prerendert
// Next de pagina bij de build, waardoor verwijderde/nieuwe boeken pas na een redeploy
// zichtbaar worden (verwijderen "werkt" dan schijnbaar niet).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [stories, characters] = await Promise.all([
    listStories(),
    listCharacters(),
  ]);

  const heroes = characters.filter((c) => c.kind === "hero");
  const sideCharacters = characters.filter((c) => c.kind === "side");
  const hasCharacters = heroes.length > 0 || sideCharacters.length > 0;
  const isEmpty = stories.length === 0 && !hasCharacters;

  return (
    <PageShell showHomeLink={false} size="wide">
      {/* Kalm, gecentreerd welkom — geen brede kaart, geen icoon, geen dubbele knop.
          De enige ingang om iets nieuws te maken is de "Nieuw verhaal"-tegel op de plank,
          zodat er nooit twee paden naar dezelfde actie zijn. */}
      <section className="flex flex-col items-center gap-2 pt-1 text-center sm:pt-2">
        <h1 className="font-heading text-3xl font-extrabold leading-tight text-foreground sm:text-4xl md:text-5xl">
          Welkom terug
        </h1>
        <p className="text-base text-foreground/60 sm:text-lg">
          Tijd voor een avondavontuur.
        </p>
      </section>

      {/* Personages — een rustige, gecentreerde rij cirkels. Geen brede tray met lege
          ruimte; de label compact erboven. Helden klikbaar (start nieuw verhaal met die
          held vooringevuld via ?held=ID); bijfiguren puur informatief. */}
      {hasCharacters && (
        <section className="flex flex-col items-center gap-3">
          <h2 className="flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wide text-foreground/50 sm:text-sm">
            <Sparkles className="size-3.5" />
            Mijn personages
          </h2>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            {heroes.map((c) => (
              <HeroCharacterTile key={c.id} character={c} />
            ))}
            {sideCharacters.map((c) => (
              <SideCharacterTile key={c.id} character={c} />
            ))}
          </div>
        </section>
      )}

      {/* Boekenplank — schoon sectie-header + grid dat de breedte netjes vult. De
          "Nieuw verhaal"-tegel is de énige plek om een nieuw boek te beginnen. */}
      <section className="flex flex-col gap-3 sm:gap-4">
        <h2 className="text-center font-heading text-sm font-bold uppercase tracking-wide text-foreground/50 sm:text-base">
          Mijn boekenplank
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          <NewStoryTile />
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      </section>

      {isEmpty && (
        <p className="text-center text-sm text-foreground/50 sm:text-base">
          Tik op{" "}
          <span className="font-semibold text-foreground/70">Nieuw verhaal</span>{" "}
          om je eerste avontuur te beginnen.
        </p>
      )}
    </PageShell>
  );
}

// Compact cirkel-item voor een opgeslagen held. Klikken start een nieuw verhaal met die held
// vooringevuld — de nieuw-verhaal-pagina leest het ?held=ID uit (zie HeroForm).
function HeroCharacterTile({ character }: { character: SavedCharacter }) {
  return (
    <Link
      href={`/nieuw-verhaal?held=${character.id}`}
      title={character.seriesNote ? `${character.name} — ${character.seriesNote}` : character.name}
      className="group flex w-16 flex-col items-center gap-1.5 sm:w-20"
    >
      <span className="relative size-16 shrink-0 overflow-hidden rounded-full bg-foreground/5 ring-2 ring-amber-300/60 transition-all group-hover:-translate-y-0.5 group-hover:ring-amber-400 group-hover:shadow-md group-hover:shadow-amber-400/20 sm:size-20">
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
            <Sparkles className="size-6 text-foreground/40 sm:size-7" />
          </span>
        )}
      </span>
      <span className="line-clamp-1 w-full text-center text-xs font-bold text-foreground sm:text-sm">
        {character.name}
      </span>
    </Link>
  );
}

// Compact cirkel-item voor een bijfiguur. Niet klikbaar, wel zichtbaar als terugkerend figuur.
function SideCharacterTile({ character }: { character: SavedCharacter }) {
  const bookCount = character.sourceStoryIds.length;
  const title = `Bijfiguur — komt terug in ${bookCount === 1 ? "1 boek" : `${bookCount} boeken`}`;
  return (
    <div
      className="flex w-16 flex-col items-center gap-1.5 sm:w-20"
      title={bookCount > 0 ? title : "Bijfiguur"}
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
            <Users className="size-6 text-foreground/40 sm:size-7" />
          </span>
        )}
      </span>
      <span className="line-clamp-1 w-full text-center text-xs font-bold text-foreground/70 sm:text-sm">
        {character.name}
      </span>
    </div>
  );
}
