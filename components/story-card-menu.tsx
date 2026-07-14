"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Star, Share2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Story } from "@/lib/types";

export function StoryCardMenu({ story }: { story: Story }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  function openMenu(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(false);
    setShareFeedback(null);
    setOpen(true);
  }

  async function toggleFavorite(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      await fetch(`/api/stories/${story.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: !story.favorite }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function share(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    const text = `Lees mee met "${story.title}" — het verhaal van ${story.hero.name} in ${story.hero.world}! 📖✨`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: story.title, text });
        setOpen(false);
        return;
      } catch {
        // Geannuleerd door het kind, of delen niet mogelijk — val terug op kopiëren.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareFeedback("Gekopieerd! Plak het waar je maar wilt. 📋");
    } catch {
      setShareFeedback("Kopiëren lukt niet op dit apparaat.");
    }
  }

  async function confirmAndDelete(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      const res = await fetch(`/api/stories/${story.id}`, { method: "DELETE" });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openMenu}
        aria-label="Meer opties"
        className="absolute top-2.5 left-2.5 flex size-9 items-center justify-center rounded-full bg-white/90 text-foreground/70 shadow-md transition-transform active:scale-90 hover:bg-white sm:size-10"
      >
        <MoreHorizontal className="size-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="gap-4 rounded-3xl p-5 sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold">{story.title}</DialogTitle>
            <DialogDescription>
              {story.hero.name} · {story.hero.world}
            </DialogDescription>
          </DialogHeader>

          {confirmDelete ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-foreground/80 sm:text-base">
                Weet je het zeker? Dit boek is dan helemaal weg.
              </p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={confirmAndDelete}
                  className="flex-1 rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all active:scale-[0.97] disabled:opacity-60 sm:text-base"
                >
                  {busy ? "Bezig…" : "Ja, verwijder"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmDelete(false);
                  }}
                  className="flex-1 rounded-xl border-2 border-foreground/15 px-4 py-3 text-sm font-bold text-foreground/70 transition-all active:scale-[0.97] sm:text-base"
                >
                  Toch niet
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={toggleFavorite}
                className="flex items-center gap-3 rounded-2xl border-2 border-foreground/10 p-3.5 text-left text-base font-semibold text-foreground transition-all hover:border-amber-400/50 hover:bg-amber-400/10 disabled:opacity-60 sm:p-4"
              >
                <Star
                  className={cn(
                    "size-5 shrink-0",
                    story.favorite && "fill-amber-400 text-amber-400",
                  )}
                />
                {story.favorite ? "Opgeslagen — zet uit" : "Bewaar dit boek"}
              </button>
              <button
                type="button"
                onClick={share}
                className="flex items-center gap-3 rounded-2xl border-2 border-foreground/10 p-3.5 text-left text-base font-semibold text-foreground transition-all hover:border-sky-400/50 hover:bg-sky-400/10 sm:p-4"
              >
                <Share2 className="size-5 shrink-0" />
                Deel dit verhaal
              </button>
              {shareFeedback && (
                <p className="px-1 text-sm font-semibold text-sky-600 dark:text-sky-300">
                  {shareFeedback}
                </p>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmDelete(true);
                }}
                className="flex items-center gap-3 rounded-2xl border-2 border-foreground/10 p-3.5 text-left text-base font-semibold text-rose-600 transition-all hover:border-rose-400/50 hover:bg-rose-400/10 sm:p-4 dark:text-rose-300"
              >
                <Trash2 className="size-5 shrink-0" />
                Verwijder dit boek
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
