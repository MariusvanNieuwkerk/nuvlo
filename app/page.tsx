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

  // Helden én bijfiguren tonen op Home — listCharacters sorteert al: helden vóór
  // bijfiguren, binnen elk op naam. Helden blijven klikbaar (start nieuw verhaal met
  // die held vooringevuld via ?held=ID). Bijfiguren zijn voor nu puur informatief
  // (niet-klikbaar) met een klein "komt voor in N boeken"-labeltje: zo zijn ze wel
  // zichtbaar en herkenbaar als terugkerende figuren, zonder dat we al een nieuwe
  // flow nodig hebben om een verhaal mét bijfiguur te starten.
  const heroes = characters.filter((c) => c.kind === "hero");
  const sideCharacters = characters.filter((c) => c.kind === "side");

  return (
    <PageShell showHomeLink={false} size="wide">
      <div className="flex flex-col gap-1 pt-1 sm:gap-2 sm:pt-2">
        <h1 className="font-heading text-3xl font-extrabold text-foreground sm:text-4xl md:text-5xl">
          Welkom terug
        </h1>
        <p className="text-base text-foreground/60 sm:text-lg">Tijd voor een avondavontuur.</p>
      </div>

      {(heroes.length > 0 || sideCharacters.length > 0) && (
        <section className="flex flex-col gap-2 sm:gap-2.5">
          <h2 className="font-heading text-sm font-bold tracking-wide text-foreground/50 uppercase sm:text-base">
            Mijn personages
          </h2>
          {/* Compacte cirkel-rij: alleen een portret-cirkel met de naam eronder, netjes
              naast elkaar (geen brede dozen met lege ruimte). Helden zijn klikbaar (start
              een nieuw verhaal met die held vooringevuld); bijfiguren tonen puur informatief. */}
          <div className="flex flex-wrap gap-2.5 sm:gap-3">
            {heroes.map((c) => (
              <HeroCharacterTile key={c.id} character={c} />
            ))}
            {sideCharacters.map((c) => (
              <SideCharacterTile key={c.id} character={c} />
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3 sm:gap-4">
        <h2 className="font-heading text-sm font-bold tracking-wide text-foreground/50 uppercase sm:text-base">
          Mijn boekenplank
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] sm:gap-4 lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
          <NewStoryTile />
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      </div>

      {stories.length === 0 && heroes.length === 0 && sideCharacters.length === 0 && (
        <Link
          href="/nieuw-verhaal"
          className="flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-4 text-lg font-bold text-amber-950 shadow-lg shadow-amber-500/20 transition-transform active:scale-[0.98] hover:bg-amber-300 sm:w-fit sm:px-8 sm:py-5 sm:text-xl"
        >
          ✨ Begin je eerste avontuur
        </Link>
      )}
    </PageShell>
  );
}

// Compact cirkel-item voor een opgeslagen held. Klikken start een nieuw verhaal met die held
// vooringevuld — de nieuw-verhaal-pagina leest het ?held=ID uit (zie HeroForm). Bewust klein:
// alleen een portret-cirkel + naam, geen brede doos eromheen.
function HeroCharacterTile({ character }: { character: SavedCharacter }) {
  return (
    <Link
      href={`/nieuw-verhaal?held=${character.id}`}
      title={character.seriesNote ? `${character.name} — ${character.seriesNote}` : character.name}
      className="group flex w-16 flex-col items-center gap-1.5 sm:w-20"
    >
      <span className="relative size-16 shrink-0 overflow-hidden rounded-full bg-foreground/5 ring-2 ring-amber-300/50 transition-all group-hover:-translate-y-0.5 group-hover:ring-amber-400/80 sm:size-20">
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

// Compact cirkel-item voor een bijfiguur. Niet klikbaar (start nog geen nieuw verhaal), maar
// wel zichtbaar als terugkerend figuur — dezelfde compacte vorm als een held, alleen met een
// gedemptere ring en het "bijfiguur / N boeken"-labeltje in de tooltip.
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
