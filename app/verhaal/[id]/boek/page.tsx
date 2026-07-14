import Image from "next/image";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { BookPager } from "@/components/book-pager";
import { HeroPanel } from "@/components/hero-panel";
import { SaveCharacterButton } from "@/components/save-character-button";
import { getStory } from "@/lib/storage";

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

  return (
    <PageShell size="wide">
      <div className="flex flex-col gap-0.5 sm:gap-1">
        <p className="text-sm font-semibold text-foreground/50 sm:text-base">Mijn boek</p>
        <h1 className="font-heading text-2xl font-extrabold text-foreground sm:text-3xl md:text-4xl">
          {story.title}
        </h1>
      </div>

      <HeroPanel
        storyId={story.id}
        heroName={story.hero.name}
        portraitUrl={story.character.portraitUrl}
        items={story.character.items}
        hasUnseenPortrait={Boolean(story.character.hasUnseenPortrait)}
      />

      {/* Ook op de boek-pagina: bekende nevenpersonages met een "Sla op als personage"-knop,
          zodat het kind een leuk bijfiguur kan hergebruiken in een nieuw boek. */}
      {story.bible.sideCharacters.length > 0 && (
        <SideCharacterSaver storyId={story.id} sideCharacters={story.bible.sideCharacters} />
      )}

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

function SideCharacterSaver({
  storyId,
  sideCharacters,
}: {
  storyId: string;
  sideCharacters: { name: string; appearance: unknown; referenceImageUrl: string | null }[];
}) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border-2 border-amber-300/60 bg-white/85 p-3 shadow-sm sm:p-4 dark:bg-white/10">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-foreground/50 sm:text-sm">
        <Sparkles className="size-3.5" />
        Bekende nevenpersonages
      </p>
      <ul className="flex flex-col gap-2">
        {sideCharacters.map((c) => (
          <li
            key={c.name}
            className="flex items-center gap-3 rounded-xl bg-foreground/5 p-2 sm:p-2.5"
          >
            <span className="relative size-10 shrink-0 overflow-hidden rounded-full ring-1 ring-foreground/10 bg-foreground/5 sm:size-12">
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
              {typeof c.appearance === "object" && c.appearance !== null && "freeform" in (c.appearance as Record<string, unknown>) && (
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
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
