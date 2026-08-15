// Kleine schoonmaak voor titels en "naam in wereld"-zinnen.
// Kinderen typen de wereld soms als "in de bomenstad"; dan mag er niet nóg een "in" bij.

export function formatNameInWorld(name: string, world: string): string {
  const n = name.trim();
  const w = world.trim().replace(/\s+/g, " ");
  if (!n) return w;
  if (!w) return n;
  if (/^in\b/i.test(w)) return `${n} ${w}`;
  return `${n} in ${w}`;
}

export function cleanStoryTitle(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bin in\b/gi, "in")
    .replace(/\bop op\b/gi, "op")
    .replace(/\bvan van\b/gi, "van")
    .replace(/\bde de\b/gi, "de");
}
