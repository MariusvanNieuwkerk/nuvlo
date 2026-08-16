import { PageShell } from "@/components/page-shell";
import { NewCharacterForm } from "@/components/new-character-form";

export default function NieuwPersonagePage() {
  return (
    <PageShell size="narrow">
      <div className="flex flex-col gap-1 sm:gap-2">
        <h1 className="font-heading text-2xl font-extrabold text-foreground sm:text-3xl">
          Nieuw personage
        </h1>
        <p className="text-base text-foreground/60 sm:text-lg">
          Verzin een held. De tekenstijl kies je nu, en blijft daarna vast.
        </p>
      </div>
      <NewCharacterForm />
    </PageShell>
  );
}
