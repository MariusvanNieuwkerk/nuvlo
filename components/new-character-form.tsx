"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_IMAGE_STYLE_ID,
  IMAGE_STYLES,
  type ImageStyleId,
} from "@/lib/image-styles";
import { writeActiveHeroId } from "@/lib/active-hero";
import { cn } from "@/lib/utils";

const INPUT_CARD =
  "bg-white/85 dark:bg-white/10 border-2 border-primary/35 shadow-sm focus-visible:border-primary focus-visible:ring-primary/40";

export function NewCharacterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [appearance, setAppearance] = useState("");
  const [skills, setSkills] = useState("");
  const [styleId, setStyleId] = useState<ImageStyleId>(DEFAULT_IMAGE_STYLE_ID);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && appearance.trim().length > 0;

  async function saveCharacter() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          kind: "hero",
          appearance: appearance.trim(),
          skills: skills.trim() || undefined,
          styleId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string" ? data.error : "Opslaan is niet gelukt. Probeer het nog eens.",
        );
      }
      const data = await res.json();
      const id = data.character?.id;
      if (typeof id === "string" && id) writeActiveHeroId(id);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan is niet gelukt. Probeer het nog eens.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void saveCharacter();
      }}
      className="flex flex-col gap-6 sm:gap-8"
    >
      <section className="flex flex-col gap-2.5 sm:gap-3">
        <Label htmlFor="hero-name" className="text-base font-bold sm:text-lg">
          Naam van je held
        </Label>
        <Input
          id="hero-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bijv. Finn"
          maxLength={40}
          className={cn("h-12 rounded-xl text-base sm:h-14 sm:text-lg", INPUT_CARD)}
        />
      </section>

      <section className="flex flex-col gap-2.5 sm:gap-3">
        <Label htmlFor="hero-look" className="text-base font-bold sm:text-lg">
          Hoe ziet je held eruit?
        </Label>
        <p className="text-sm text-foreground/55 sm:text-base">
          Schrijf kleding, haar en schoenen erbij. Deze zin blijft de baas.
        </p>
        <Textarea
          id="hero-look"
          value={appearance}
          onChange={(e) => setAppearance(e.target.value)}
          placeholder="Bijv. groene krullen, rood trainingspak en grijze sneakers"
          maxLength={400}
          className={cn("min-h-[120px] rounded-xl text-base sm:min-h-[140px] sm:text-lg", INPUT_CARD)}
        />
      </section>

      <section className="flex flex-col gap-2.5 sm:gap-3">
        <Label htmlFor="hero-skills" className="text-base font-bold sm:text-lg">
          Superkrachten of skills
        </Label>
        <p className="text-sm text-foreground/55 sm:text-base">
          Mag leeg. Wat je hier zet, kan je held in elk nieuw verhaal.
        </p>
        <Textarea
          id="hero-skills"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder="Bijv. supersterk, kan praten met dieren, of heel goed bouwen"
          maxLength={200}
          className={cn("min-h-[88px] rounded-xl text-base sm:min-h-[100px] sm:text-lg", INPUT_CARD)}
        />
      </section>

      <section className="flex flex-col gap-2.5 sm:gap-3">
        <p className="text-base font-bold sm:text-lg">Kies een tekenstijl</p>
        <p className="text-sm text-foreground/55 sm:text-base">
          Eén keer kiezen. Daarna blijft deze stijl bij je held.
        </p>
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {IMAGE_STYLES.map((style) => {
            const Icon = style.icon;
            const selected = styleId === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => setStyleId(style.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-4 text-center text-xs font-bold transition-all active:scale-[0.97] sm:gap-2 sm:py-5 sm:text-sm",
                  "bg-white/85 shadow-sm dark:bg-white/10",
                  selected
                    ? "-translate-y-0.5 border-primary bg-primary/10 shadow-md dark:bg-primary/15"
                    : "border-primary/35 hover:border-primary/60 hover:shadow-md",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full sm:size-11",
                    style.swatch,
                  )}
                >
                  <Icon className="size-6 text-foreground sm:size-7" strokeWidth={2.5} />
                </span>
                <span className="text-slate-800 dark:text-slate-100">{style.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {error && <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="min-h-16 w-full rounded-2xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 sm:text-xl"
      >
        {submitting ? "Je held wordt bewaard…" : "Held bewaren"}
      </button>
    </form>
  );
}
