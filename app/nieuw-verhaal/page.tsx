import { PageShell } from "@/components/page-shell";
import { HeroForm } from "@/components/hero-form";
import { getDefaultChild } from "@/lib/storage";

// Server-side lezen van ?held=ID en doorgeven als prop — zo blijft de client-component
// eenvoudig (geen useSearchParams/Suspense nodig) en kan de server het direct afhandelen.
export default async function NieuwVerhaalPage({
  searchParams,
}: {
  searchParams: Promise<{ held?: string }>;
}) {
  const { held } = await searchParams;
  const initialCharacterId = held && held.trim().length > 0 ? held.trim() : undefined;
  const child = await getDefaultChild();

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
        initialAuthorName={child.name}
        initialAge={child.age}
      />
    </PageShell>
  );
}
