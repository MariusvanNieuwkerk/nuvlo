import { Moon, Trophy } from "lucide-react";
import { computeProgress } from "@/lib/progress";

// Kindvriendelijke voortgang: een rustige, vullende "boekrug" met een maantje dat meeschuift —
// past bij het avondritueel, geen felle gamified XP-balk. Toont hoe ver het kind in ZIJN boek
// is (hoofdstukken tot nu toe t.o.v. het richtgetal), NOOIT iets over de geheime akte-structuur.
export function ReadingProgress({
  chaptersDone,
  finished,
}: {
  chaptersDone: number;
  finished: boolean;
}) {
  const progress = computeProgress(chaptersDone, finished);
  const pct = Math.round(progress.fraction * 100);

  return (
    <div className="flex flex-col gap-1.5" aria-label={`Voortgang: ${progress.label}`}>
      <div className="flex items-center justify-between text-xs font-semibold text-foreground/50 sm:text-sm">
        <span className="flex items-center gap-1.5">
          {finished ? (
            <Trophy className="size-3.5 text-amber-400 sm:size-4" />
          ) : (
            <Moon className="size-3.5 text-indigo-300 sm:size-4" />
          )}
          {progress.label}
        </span>
        <span>Hoofdstuk {chaptersDone}</span>
      </div>
      {/* De "boekrug": een zachte, warme balk die langzaam volloopt. */}
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-foreground/10 sm:h-3">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-400/80 via-violet-400/80 to-amber-300/90 transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
