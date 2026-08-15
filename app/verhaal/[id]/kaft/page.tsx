import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { CoverReveal } from "@/components/cover-reveal";
import { getStory } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function KaftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const story = await getStory(id);
  if (!story) notFound();

  const firstImage = story.chapters[0]?.imageUrl ?? null;
  const coverUrl = story.coverUrl ?? firstImage;

  return (
    <PageShell size="narrow">
      <CoverReveal
        storyId={story.id}
        title={story.title}
        heroName={story.hero.name}
        coverUrl={coverUrl}
      />
    </PageShell>
  );
}
