// Schoonmaak voor titels, "naam in wereld"-zinnen en slordige herhaling in AI-tekst.
// Kinderen typen de wereld soms als "in de bomenstad"; dan mag er niet nóg een "in" bij.

export function formatNameInWorld(name: string, world: string): string {
  const n = name.trim();
  const w = world.trim().replace(/\s+/g, " ");
  if (!n) return w;
  if (!w) return n;
  if (/^in\b/i.test(w)) return `${n} ${w}`;
  return `${n} in ${w}`;
}

export function polishDutchText(text: string): string {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\bin in\b/gi, "in")
    .replace(/\bop op\b/gi, "op")
    .replace(/\bvan van\b/gi, "van")
    .replace(/\bde de\b/gi, "de")
    .replace(/\bhet het\b/gi, "het")
    .replace(/\been een\b/gi, "een")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

export function cleanStoryTitle(title: string): string {
  return polishDutchText(title);
}
