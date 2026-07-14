import Link from "next/link";
import Image from "next/image";
import { Sparkles, Users, Plus, Moon } from "lucide-react";
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
      {/* Warme welkomstband — de visuele anker bovenaan. Een zachte gradient met een
          avond-/avontuur-thema (ster + maan), de begroeting prominent, en meteen een
          duidelijke primaire actie ("Nieuw avontuur"). Vult de volle breedte, zodat de
          pagina niet meer los en leeg voelt bovenaan. */}
      <section className="relative overflow-hidden rounded-3xl border border-amber-200/50 bg-gradient-to-br from-amber-50 via-orange-50/70 to-rose-50/50 p-5 shadow-sm sm:p-7 md:p-8 dark:border-amber-400/10 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-rose-950/10">
          {/* Decoratieve sterren-puntjes rechtsboven — een knipoog naar het avondritueel. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(1.5px_1.5px_at_82%_22%,theme(colors.amber.400/60),transparent),radial-gradient(1.2px_1.2px_at_92%_38%,theme(colors.amber.300/50),transparent),radial-gradient(1.5px_1.5px_at_72%_62%,theme(colors.amber.400/40),transparent)]"
          />
          <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-600 sm:size-12 dark:text-amber-300">
                <Moon className="size-5 sm:size-6" />
              </span>
              <div className="flex flex-col gap-0.5">
                <h1 className="font-heading text-3xl font-extrabold leading-tight text-foreground sm:text-4xl md:text-5xl">
                  Welkom terug
                </h1>
                <p className="text-base text-foreground/70 sm:text-lg">
                  Tijd voor een avondavontuur.
                </p>
              </div>
            </div>
            <Link
              href="/nieuw-verhaal"
              className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-base font-bold text-amber-950 shadow-md shadow-amber-500/20 transition-all hover:bg-amber-300 hover:shadow-lg active:scale-[0.98] sm:px-6 sm:py-3.5 sm:text-lg"
            >
              <Plus className="size-5" />
              Nieuw avontuur
            </Link>
          </div>
        </section>

        {/* Personages — een zachte "tray" die de volle breedte vult, met de label links en de
            cirkels er rechts los naast. Zo vult de rij de breedte natuurlijk en staan de
            portretjes niet meer alleen in een lege hoek. Helden klikbaar (start nieuw verhaal
            met die held vooringevuld); bijfiguren puur informatief. */}
        {hasCharacters && (
          <section className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-white/50 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5 dark:bg-white/5">
            <h2 className="flex shrink-0 items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wide text-foreground/50 sm:text-sm">
              <Sparkles className="size-3.5" />
              Mijn personages
            </h2>
            <div className="flex flex-wrap gap-3 sm:gap-4">
              {heroes.map((c) => (
                <HeroCharacterTile key={c.id} character={c} />
              ))}
              {sideCharacters.map((c) => (
                <SideCharacterTile key={c.id} character={c} />
              ))}
            </div>
          </section>
        )}

        {/* Boekenplank — verfijnde sectie-header met een klein accent-streepje, en een grid
            dat de breedte netjes vult met goed gevulde kaarten. */}
        <section className="flex flex-col gap-3 sm:gap-4">
          <h2 className="flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-wide text-foreground/50 sm:text-base">
            <span className="h-4 w-1 rounded-full bg-amber-400/70" aria-hidden />
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
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-amber-300/50 bg-amber-50/50 p-6 text-center sm:p-8 dark:bg-amber-400/5">
            <span className="text-4xl sm:text-5xl">📖</span>
            <p className="font-heading text-lg font-bold text-foreground sm:text-xl">
              Hier komt je eerste boek
            </p>
            <p className="max-w-md text-sm text-foreground/60 sm:text-base">
              Verzin samen een held en begin een avontuur — elk boek dat je maakt
              verschijnt hier op de plank.
            </p>
          </div>
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
