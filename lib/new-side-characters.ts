import type { Chapter, SideCharacter } from "@/lib/types";

// Alleen figuren die in HET LAATSTE hoofdstuk voor het eerst opduiken, mogen een
// "opslaan"-knop krijgen. De held nooit. Figuren die al eerder meededen, of al in
// de bibliotheek staan, ook niet.
export function newlyIntroducedSideCharacters(
  chapters: Pick<Chapter, "sceneCharacterNames">[],
  sideCharacters: SideCharacter[],
  alreadySavedNames: Set<string>,
  heroName?: string,
): SideCharacter[] {
  if (chapters.length === 0) return [];

  const previous = new Set<string>();
  for (const chapter of chapters.slice(0, -1)) {
    for (const name of chapter.sceneCharacterNames ?? []) {
      const key = name.trim().toLowerCase();
      if (key) previous.add(key);
    }
  }

  const latest = chapters[chapters.length - 1];
  const latestSet = new Set(
    (latest.sceneCharacterNames ?? [])
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  );
  const heroKey = heroName?.trim().toLowerCase() ?? "";

  return sideCharacters.filter((character) => {
    if (character.dismissed) return false;
    const key = character.name.trim().toLowerCase();
    if (!key || key === heroKey) return false;
    if (alreadySavedNames.has(key)) return false;
    if (previous.has(key)) return false;
    if (latestSet.size === 0) return false;
    return latestSet.has(key);
  });
}
