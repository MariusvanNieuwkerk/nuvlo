import Link from "next/link";
import Image from "next/image";
import { BookOpen, Trophy, Star } from "lucide-react";
import type { Story } from "@/lib/types";
import { GENRE_COVER } from "@/lib/genre-cover";
import { StoryCardMenu } from "@/components/story-card-menu";
import { computeProgress } from "@/lib/progress";

export function StoryCard({ story }: { story: Story }) {
  const finished = story.status === "klaar";
  const href = finished ? `/verhaal/${story.id}/boek` : `/verhaal/${story.id}/lezen`;
  const cover = GENRE_COVER[story.hero.genre];
  const progress = computeProgress(story.chapters.length, finished);
  const portraitUrl = story.character.portraitUrl;
  const hasUnseenPortrait = Boolean(story.character.hasUnseenPortrait);

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/5 transition-all duration-200 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-xl hover:shadow-black/20 active:translate-y-0"
    >
      <div
        className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br ${cover.gradient}`}
      >
        {story.coverUrl ? (
          <Image
            src={story.coverUrl}
            alt={`Boekomslag van ${story.title}`}
            fill
            className="object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <span className="text-5xl drop-shadow-sm transition-transform duration-200 group-hover:scale-110 sm:text-6xl">
            {cover.emoji}
          </span>
        )}
        <StoryCardMenu story={story} />
        {finished && (
          <span className="absolute top-2.5 right-2.5 flex size-9 items-center justify-center rounded-full bg-white/90 text-lg shadow-md">
            🏆
          </span>
        )}
        {story.favorite && (
          <span className="absolute bottom-2.5 right-2.5 flex size-9 items-center justify-center rounded-full bg-white/90 shadow-md">
            <Star className="size-4 fill-amber-400 text-amber-400" />
          </span>
        )}
        {/* Het huidige held-portret klein op de kaft, zodat het kind zijn held herkent — met een
            zacht sterretje als het portret sinds de vorige sessie veranderd is (nog niet gezien). */}
        {portraitUrl && (
          <span className="absolute bottom-2.5 left-2.5 flex size-9 items-center justify-center overflow-hidden rounded-full bg-white/90 shadow-md ring-2 ring-white/80">
            <Image src={portraitUrl} alt={`${story.hero.name}`} width={36} height={36} className="size-full object-cover" />
            {hasUnseenPortrait && (
              <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-amber-400 ring-2 ring-white" />
            )}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="line-clamp-2 font-heading text-base font-bold text-foreground sm:text-lg">
          {story.title}
        </p>
        <p className="truncate text-sm text-foreground/60">
          {story.hero.name} · {story.hero.world}
        </p>
        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          <div className="flex items-center gap-1.5 text-sm text-foreground/50">
            {finished ? (
              <Trophy className="size-4 text-amber-300" />
            ) : (
              <BookOpen className="size-4" />
            )}
            <span>{finished ? "Boek af!" : progress.label}</span>
          </div>
          {/* Kleine voortgangsbalk per boek — afgemaakte boeken staan vol met een gouden tint
              (het gevoel van een echte prestatie), lopende boeken lopen rustig vol. */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
            <div
              className={`h-full rounded-full ${finished ? "bg-amber-400" : "bg-gradient-to-r from-indigo-400/80 to-violet-400/80"}`}
              style={{ width: `${Math.round(progress.fraction * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
