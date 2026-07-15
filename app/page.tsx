import { BookOpen } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { StoryCard } from "@/components/story-card";
import { NewStoryTile } from "@/components/new-story-tile";
import { listStories } from "@/lib/storage";

// Altijd vers renderen: de boekenplank leest live uit Supabase. Zonder dit prerendert
// Next de pagina bij de build, waardoor verwijderde/nieuwe boeken pas na een redeploy
// zichtbaar worden (verwijderen "werkt" dan schijnbaar niet).
export const dynamic = "force-dynamic";

// Bewust simpel gehouden: alleen welkom + boekenplank. De personage-bibliotheek (hoofd- en
// nevenpersonages bekijken, kiezen en verwijderen) staat sinds kort in het "nieuw verhaal"-
// formulier (zie components/hero-form.tsx) — die is de logische plek waar je toch al met je
// personages aan het werk bent, in plaats van hier dubbel te tonen.
export default async function HomePage() {
  const stories = await listStories();
  const isEmpty = stories.length === 0;

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

      {/* Boekenplank — schoon sectie-header + grid dat de breedte netjes vult. De
          "Nieuw verhaal"-tegel is de énige plek om een nieuw boek te beginnen. */}
      <section className="flex flex-col gap-3 sm:gap-4">
        <h2 className="mx-auto inline-flex items-center gap-2 rounded-full bg-teal-400/15 px-4 py-1.5 font-heading text-base font-semibold text-teal-800 sm:text-lg dark:bg-teal-300/10 dark:text-teal-200">
          <BookOpen className="size-4 sm:size-5" />
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
