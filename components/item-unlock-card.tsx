import { Gift } from "lucide-react";

// Klein, feestelijk-maar-rustig moment wanneer het kind in dit hoofdstuk een voorwerp
// verdiende. Hergebruikt de zachte onthul-animatie (.reward-reveal in globals.css), zodat het
// bij de bedtijd-sfeer past en niet als een schreeuwerige game-popup voelt.
export function ItemUnlockCard({ item }: { item: string }) {
  return (
    <div className="reward-reveal flex items-center gap-3 rounded-2xl border border-violet-400/30 bg-violet-400/10 p-4 sm:gap-4 sm:p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-violet-400/20 sm:size-12">
        <Gift className="size-5 text-violet-500 sm:size-6 dark:text-violet-300" />
      </span>
      <div className="flex flex-col">
        <p className="font-heading text-sm font-bold text-violet-700 sm:text-base dark:text-violet-200">
          Nieuw! Je hebt {item} verdiend
        </p>
        <p className="text-xs text-foreground/60 sm:text-sm">
          Je held draagt dit vanaf nu in de tekeningen.
        </p>
      </div>
    </div>
  );
}
