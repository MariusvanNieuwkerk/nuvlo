import Link from "next/link";
import { Plus } from "lucide-react";

export function NewStoryTile() {
  return (
    <Link
      href="/nieuw-verhaal"
      className="group flex flex-col overflow-hidden rounded-2xl border-2 border-dashed border-amber-400/40 bg-amber-400/5 transition-all duration-200 hover:-translate-y-1 hover:border-amber-400/70 hover:bg-amber-400/10 active:translate-y-0"
    >
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 text-amber-700 dark:text-amber-300">
        <span className="flex size-12 items-center justify-center rounded-full bg-amber-400/15 transition-transform duration-200 group-hover:scale-110 sm:size-14">
          <Plus className="size-6 sm:size-7" />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="font-heading text-base font-bold text-amber-800 sm:text-lg dark:text-amber-200">
          Nieuw verhaal
        </p>
        <p className="text-sm text-foreground/50">Verzin een nieuwe held</p>
      </div>
    </Link>
  );
}
