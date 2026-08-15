// Wat het kind zelf invult over de hoofdlijn, vóór het boek begint.
// Lege velden mag de AI verzinnen. Ingevulde velden zijn wet.

export type ChildStoryOutline = {
  goal: string;
  enemy: string;
  companions: string;
  freeform: string;
};

export function emptyOutline(): ChildStoryOutline {
  return { goal: "", enemy: "", companions: "", freeform: "" };
}

export function cleanChildOutline(raw: unknown): ChildStoryOutline {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const take = (key: string, max: number) =>
    typeof r[key] === "string" ? r[key].trim().slice(0, max) : "";
  return {
    goal: take("goal", 200),
    enemy: take("enemy", 200),
    companions: take("companions", 250),
    freeform: take("freeform", 800),
  };
}

export function outlineHasContent(outline: ChildStoryOutline | undefined | null): boolean {
  if (!outline) return false;
  return Boolean(outline.goal || outline.enemy || outline.companions || outline.freeform);
}

// Tekst voor Claude: alleen de velden die het kind écht invulde.
export function formatOutlineForPrompt(outline: ChildStoryOutline): string {
  if (!outlineHasContent(outline)) return "";

  const lines: string[] = [
    "HOOFDLIJN VAN HET KIND (dit is WET). Wat hier staat mag je vriendelijk herschrijven, maar NIET vervangen door een ander plot. Lege velden hieronder staan er expres niet — die mag je zelf verzinnen. Het kind moet in hoofdstuk 1 herkennen wat het zelf bedacht.",
  ];
  if (outline.goal) lines.push(`- Wat de held wil: ${outline.goal}`);
  if (outline.enemy) lines.push(`- Wie de boef is: ${outline.enemy}`);
  if (outline.companions) {
    lines.push(
      `- Wie meegaat en wat die kan (deze personages MOETEN in het verhaal voorkomen, met deze krachten): ${outline.companions}`,
    );
  }
  if (outline.freeform) {
    lines.push(`- Eigen idee van het kind, verwerk dit ZICHTBAAR: ${outline.freeform}`);
  }
  return `\n\n${lines.join("\n")}`;
}
