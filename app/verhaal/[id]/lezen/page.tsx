import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { BookPager } from "@/components/book-pager";
import { HeroPanel } from "@/components/hero-panel";
import { SideCharacterSaver } from "@/components/side-character-saver";
import { EditableStoryTitle } from "@/components/editable-story-title";
import { getAlreadySavedForStory, getDefaultChild, getStory } from "@/lib/storage";

// Altijd vers renderen: het verhaal groeit met elke keuze, dus nooit uit de cache tonen.
export const dynamic = "force-dynamic";

export default async function LezenPage({
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
        <p className="text-sm font-semibold text-foreground/50 sm:text-base">
          <EditableStoryTitle storyId={story.id} title={story.title} />
        </p>
        <h1 className="font-heading text-xl font-extrabold text-foreground sm:text-2xl md:text-3xl">
          {story.hero.name} in {story.hero.world}
        </h1>
      </div>

      {/* De held zoals het kind hem nu kent (portret + verzameling), plus het eventuele
          "veranderd sinds gisteren"-moment als de uitgestelde beloning net onthuld is. */}
      <HeroPanel
        storyId={story.id}
        heroName={story.hero.name}
        portraitUrl={story.character.portraitUrl}
        items={story.character.items}
        hasUnseenPortrait={Boolean(story.character.hasUnseenPortrait)}
        alreadySaved={heroSaved}
      />

      {/* Bekende nevenpersonages — elk met een kleine "Sla op als personage"-knop plus een
          wegdruk-kruisje. Weggedrukte personages tonen we hier niet meer (maar ze blijven wel
          in de illustraties van het verhaal), en eenmaal opgeslagen personages ook niet meer
          (zie getAlreadySavedForStory). */}
      {(() => {
        const suggesties = story.bible.sideCharacters.filter(
          (c) => !c.dismissed && !alreadySavedSideNames.has(c.name.toLowerCase()),
        );
        return suggesties.length > 0 ? (
          <SideCharacterSaver storyId={story.id} sideCharacters={suggesties} />
        ) : null;
      })()}

      {/* Begint altijd op de laatste (levende) pagina, maar het kind kan met
          vorige/volgende terugbladeren naar wat het al gelezen heeft. Keuzes maken kan
          alleen op die laatste pagina — daarvoor moet je eerst weer "Volgende" tikken. */}
      <BookPager
        chapters={story.chapters}
        initialChapterIndex={story.chapters.length - 1}
        finished={story.status === "klaar"}
        storyId={story.id}
        heroName={story.hero.name}
        heroEnemy={story.hero.enemy}
        variant="lezen"
      />

      <Link
        href={`/verhaal/${story.id}/boek`}
        className="mt-2 text-center text-sm font-semibold text-foreground/50 underline-offset-4 hover:text-foreground/80 hover:underline sm:text-base"
      >
        Bekijk mijn boek tot nu toe
      </Link>
    </PageShell>
  );
}
