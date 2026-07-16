"use client";

import { useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Laat het kind de titel van een boek aanpassen — bv. omdat Claude's verzonnen titel niet
// lekker klinkt. Rendert standaard als gewone tekst met een subtiel potloodje; een tik
// schakelt naar een invoerveld. Geeft `font`/`color: inherit` mee zodat de weergave-knop
// precies dezelfde stijl overneemt als de <h1>/<p> waarin hij staat, zonder dat elke
// aanroeper zelf de tekst-klassen moet herhalen.
export function EditableStoryTitle({
  storyId,
  title,
  className,
}: {
  storyId: string;
  title: string;
  className?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setValue(title);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setValue(title);
    setError(null);
  }

  async function save() {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Geef het boek een titel.");
      return;
    }
    if (trimmed === title) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error("opslaan mislukte");
      setEditing(false);
      router.refresh();
    } catch {
      setError("Opslaan mislukte. Probeer het nog eens.");
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void save();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={saving}
            className={cn(
              "min-w-0 flex-1 rounded-lg border-2 border-primary/50 bg-white/90 px-2.5 py-1 outline-none focus-visible:border-primary disabled:opacity-60 dark:bg-white/10",
              className,
            )}
            style={{ font: "inherit", color: "inherit" }}
            aria-label="Titel van het boek"
          />
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            aria-label="Titel opslaan"
            title="Opslaan"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform active:scale-90 disabled:opacity-60"
          >
            <Check className="size-4" />
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            aria-label="Bewerken annuleren"
            title="Annuleren"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground/60 transition-transform active:scale-90 disabled:opacity-60"
          >
            <X className="size-4" />
          </button>
        </div>
        {error && <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      title="Titel aanpassen"
      className={cn("group inline-flex max-w-full items-center gap-2 text-left", className)}
      style={{ font: "inherit", color: "inherit" }}
    >
      <span className="min-w-0">{title}</span>
      <Pencil className="size-[0.55em] shrink-0 opacity-40 transition-opacity group-hover:opacity-80" />
    </button>
  );
}
