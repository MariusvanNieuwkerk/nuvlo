import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { BookPager } from "@/components/book-pager";
import { HeroPanel } from "@/components/hero-panel";
import { SideCharacterSaver } from "@/components/side-character-saver";
import { EditableStoryTitle } from "@/components/editable-story-title";
import { getAlreadySavedForStory, getDefaultChild, getStory } from "@/lib/storage";

// Altijd vers renderen: het verhaal groeit met elke keuze, dus nooit uit de cache tonen.
export const dynamic = "force-dynamic";

export default async function MijnBoekPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const story = await getStory(id);
  if (!story) notFound();

  const child = await getDefaultChild();
  const { heroSaved, sideNames: alreadySavedSideNames } = await getAlreadySavedForStory(
    child.id,
    story.id,
  );

  return (
    <PageShell size="wide">
      <div className="flex flex-col gap-0.5 sm:gap-1">
        <p className="text-sm font-semibold text-foreground/50 sm:text-base">Mijn boek</p>
        <h1 className="font-heading text-2xl font-extrabold text-foreground sm:text-3xl md:text-4xl">
          <EditableStoryTitle storyId={story.id} title={story.title} />
        </h1>
      </div>

      <HeroPanel
        storyId={story.id}
        heroName={story.hero.name}
        portraitUrl={story.character.portraitUrl}
        items={story.character.items}
        hasUnseenPortrait={Boolean(story.character.hasUnseenPortrait)}
        alreadySaved={heroSaved}
      />

      {/* Ook op de boek-pagina: bekende nevenpersonages met een "Sla op als personage"-knop en
          een wegdruk-kruisje. Weggedrukte personages verbergen we hier (ze blijven wel in de
          illustraties van het verhaal), en eenmaal opgeslagen personages ook niet meer. */}
      {(() => {
        const suggesties = story.bible.sideCharacters.filter(
          (c) => !c.dismissed && !alreadySavedSideNames.has(c.name.toLowerCase()),
        );
        return suggesties.length > 0 ? (
          <SideCharacterSaver storyId={story.id} sideCharacters={suggesties} />
        ) : null;
      })()}

      <BookPager
        chapters={story.chapters}
        finished={story.status === "klaar"}
        storyId={story.id}
        heroName={story.hero.name}
        heroEnemy={story.hero.enemy}
        variant="boek"
      />
    </PageShell>
  );
}
