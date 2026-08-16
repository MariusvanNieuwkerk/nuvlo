import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { BookPager } from "@/components/book-pager";
import { HeroPanel } from "@/components/hero-panel";
import { EditableStoryTitle } from "@/components/editable-story-title";
import { getAlreadySavedForStory, getDefaultChild, getStory } from "@/lib/storage";
import { formatNameInWorld } from "@/lib/dutch-title";
import { newlyIntroducedSideCharacters } from "@/lib/new-side-characters";

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
  const { sideNames: alreadySavedSideNames } = await getAlreadySavedForStory(child.id, story.id);
  const newSideCharacters = newlyIntroducedSideCharacters(
    story.chapters,
    story.bible.sideCharacters,
    alreadySavedSideNames,
    story.hero.name,
  );

  return (
    <PageShell size="wide">
      <div className="flex flex-col gap-0.5 sm:gap-1">
        <p className="text-sm font-semibold text-foreground/50 sm:text-base">
          <EditableStoryTitle storyId={story.id} title={story.title} />
        </p>
        <h1 className="font-heading text-xl font-extrabold text-foreground sm:text-2xl md:text-3xl">
          {formatNameInWorld(story.hero.name, story.hero.world)}
        </h1>
      </div>

      <HeroPanel
        storyId={story.id}
        heroName={story.hero.name}
        portraitUrl={story.character.portraitUrl}
        items={story.character.items}
        hasUnseenPortrait={Boolean(story.character.hasUnseenPortrait)}
      />

      {/* Begint op de eerste bladzijde van het laatste hoofdstuk: eerst lezen, daarna
          tekening, daarna keuzes. Terugbladeren kan altijd. */}
      <BookPager
        chapters={story.chapters}
        initialChapterIndex={story.chapters.length - 1}
        finished={story.status === "klaar"}
        storyId={story.id}
        heroName={story.hero.name}
        heroEnemy={story.hero.enemy}
        variant="lezen"
        newSideCharacters={newSideCharacters}
      />

      <Link
        href={`/verhaal/${story.id}/boek`}
        className="mt-2 text-center text-sm font-semibold text-foreground/50 underline-offset-4 hover:text-foreground/80 hover:underline sm:text-base"
      >
        Mijn boek tot hier
      </Link>
    </PageShell>
  );
}
