import { PageShell } from "@/components/page-shell";
import { HeroForm } from "@/components/hero-form";
import { getDefaultChild, listStories } from "@/lib/storage";

// Server-side lezen van ?held=ID / ?naam=... en doorgeven als prop — zo blijft de
// client-component eenvoudig (geen useSearchParams/Suspense nodig).
export default async function NieuwVerhaalPage({
  searchParams,
}: {
  searchParams: Promise<{ held?: string; naam?: string }>;
}) {
  const { held, naam } = await searchParams;
  const initialCharacterId = held && held.trim().length > 0 ? held.trim() : undefined;
  const initialHeroName = naam && naam.trim().length > 0 ? naam.trim() : undefined;
  const [child, stories] = await Promise.all([getDefaultChild(), listStories()]);

  return (
    <PageShell size="narrow">
      <div className="flex flex-col gap-1 sm:gap-2">
        <h1 className="font-heading text-2xl font-extrabold text-foreground sm:text-3xl">
          Nieuw avontuur
        </h1>
        <p className="text-base text-foreground/60 sm:text-lg">
          Drie korte stappen — daarna begint jouw verhaal.
        </p>
      </div>
      <HeroForm
        initialCharacterId={initialCharacterId}
        initialHeroName={initialHeroName}
        initialAuthorName={child.name}
        initialAge={child.age}
        initialStories={stories}
      />
    </PageShell>
  );
}
