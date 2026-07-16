import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";

// Deze tegel staat altijd als eerste op de boekenplank, tussen de echte boeken — hij moet er
// dus net zo uitnodigend uitzien als een boek-cover (warme kleurovergang, iets dat zachtjes
// beweegt), niet als een kaal, leeg vakje. De gestippelde rand blijft (dat zegt "hier begint
// iets nieuws"), maar erbinnen zit nu leven: een gloeiende knop met twee rondzwevende
// sterretjes, zoals een klein stukje magie dat wacht om aangeraakt te worden.
export function NewStoryTile() {
  return (
    <Link
      href="/nieuw-verhaal"
      className="group flex flex-col overflow-hidden rounded-2xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-background transition-all duration-200 hover:-translate-y-1 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/20 active:translate-y-0 dark:border-primary/50 dark:from-primary/15 dark:via-primary/5 dark:to-transparent dark:hover:border-primary/70"
    >
      <div className="relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden">
        <Sparkles
          className="float-soft absolute top-4 left-5 size-3.5 text-primary/50 sm:top-5 sm:left-7"
          style={{ animationDelay: "0.3s" }}
        />
        <Sparkles
          className="float-soft absolute bottom-5 right-6 size-3 text-primary/40 sm:bottom-6 sm:right-8"
          style={{ animationDelay: "1.1s" }}
        />
        <span className="float-soft flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-200 group-hover:scale-110 sm:size-16">
          <Plus className="size-7 sm:size-8" strokeWidth={2.5} />
        </span>
      </div>
      <div className="flex flex-1 flex-col items-center gap-1.5 p-4 text-center">
        <p className="font-heading text-xl font-bold text-primary sm:text-2xl dark:text-primary">
          Nieuw verhaal
        </p>
        <p className="text-base text-foreground/70 sm:text-lg">Verzin je eigen held en avontuur ✨</p>
      </div>
    </Link>
  );
}
